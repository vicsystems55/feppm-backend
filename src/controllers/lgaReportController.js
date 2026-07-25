import { prisma } from '../lib/prisma.js';
import { resolveFacilityAccess } from '../services/facilityAccessService.js';

const completedStatuses = ['COMPLETED_ON_TIME', 'COMPLETED_LATE'];
const reportFrequencies = new Set(['DAILY', 'WEEKLY', 'MONTHLY']);

function integer(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function clean(value, maximum = 100) {
  return String(value ?? '').trim().slice(0, maximum);
}

function reportDates(request) {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const fromValue = clean(request.query.from, 10);
  const toValue = clean(request.query.to, 10);
  const from = fromValue
    ? new Date(`${fromValue}T00:00:00.000+01:00`)
    : defaultFrom;
  const to = toValue
    ? new Date(`${toValue}T23:59:59.999+01:00`)
    : now;
  return {
    from: Number.isNaN(from.getTime()) ? defaultFrom : from,
    to: Number.isNaN(to.getTime()) ? now : to,
  };
}

function taskWhere(request, facilityWhere, { includeFrequency = true } = {}) {
  const frequency = clean(request.query.frequency, 20).toUpperCase();
  const completion = clean(request.query.completion, 20).toUpperCase();
  const facilityId = clean(request.query.facilityId, 191);
  const search = clean(request.query.search, 100);
  const { from, to } = reportDates(request);
  const conditions = [];

  if (search) {
    conditions.push({
      OR: [
        { facility: { name: { contains: search } } },
        { equipment: { assetCode: { contains: search } } },
        { maintenanceSchedule: { checklistTemplate: { name: { contains: search } } } },
      ],
    });
  }

  return {
    facility: facilityWhere,
    submittedAt: { gte: from, lte: to },
    status: completion === 'ON_TIME'
      ? 'COMPLETED_ON_TIME'
      : completion === 'LATE'
        ? 'COMPLETED_LATE'
        : { in: completedStatuses },
    ...(facilityId ? { facilityId } : {}),
    ...(includeFrequency && reportFrequencies.has(frequency)
      ? { maintenanceSchedule: { frequencyType: frequency } }
      : {}),
    ...(conditions.length ? { AND: conditions } : {}),
  };
}

const reportSelect = {
  id: true,
  scheduledAt: true,
  dueAt: true,
  submittedAt: true,
  completedAt: true,
  status: true,
  complianceScore: true,
  submittedOffline: true,
  facility: { select: { id: true, name: true } },
  equipment: {
    select: {
      id: true,
      assetCode: true,
      equipmentType: { select: { name: true } },
    },
  },
  completedBy: { select: { id: true, firstName: true, lastName: true } },
  maintenanceSchedule: {
    select: {
      frequencyType: true,
      checklistTemplate: { select: { id: true, name: true, version: true } },
    },
  },
  _count: { select: { responses: true, evidence: true } },
};

function serializeReport(task) {
  return {
    ...task,
    complianceScore: task.complianceScore === null ? null : Number(task.complianceScore),
    frequency: task.maintenanceSchedule.frequencyType,
    checklist: task.maintenanceSchedule.checklistTemplate,
    maintenanceSchedule: undefined,
    completedBy: task.completedBy
      ? {
        ...task.completedBy,
        fullName: `${task.completedBy.firstName} ${task.completedBy.lastName}`.trim(),
      }
      : null,
  };
}

async function scopedFacilities(facilityWhere) {
  return prisma.facility.findMany({
    where: facilityWhere,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function listLgaTaskReports(request, response) {
  const page = integer(request.query.page, 1, 1, 100000);
  const pageSize = integer(request.query.pageSize, 20, 5, 100);
  const access = await resolveFacilityAccess(request.authUser);
  const where = taskWhere(request, access.facilityWhere);
  const frequencyBase = taskWhere(request, access.facilityWhere, { includeFrequency: false });

  const [
    total,
    tasks,
    onTime,
    late,
    daily,
    weekly,
    monthly,
    facilities,
  ] = await Promise.all([
    prisma.maintenanceTask.count({ where }),
    prisma.maintenanceTask.findMany({
      where,
      select: reportSelect,
      orderBy: [{ submittedAt: 'desc' }, { facility: { name: 'asc' } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.maintenanceTask.count({ where: { ...where, status: 'COMPLETED_ON_TIME' } }),
    prisma.maintenanceTask.count({ where: { ...where, status: 'COMPLETED_LATE' } }),
    prisma.maintenanceTask.count({
      where: { ...frequencyBase, maintenanceSchedule: { frequencyType: 'DAILY' } },
    }),
    prisma.maintenanceTask.count({
      where: { ...frequencyBase, maintenanceSchedule: { frequencyType: 'WEEKLY' } },
    }),
    prisma.maintenanceTask.count({
      where: { ...frequencyBase, maintenanceSchedule: { frequencyType: 'MONTHLY' } },
    }),
    scopedFacilities(access.facilityWhere),
  ]);

  return response.json({
    success: true,
    data: {
      reports: tasks.map(serializeReport),
      summary: { total, onTime, late, daily, weekly, monthly },
      filters: { facilities },
      period: reportDates(request),
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    },
  });
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportLgaTaskReports(request, response) {
  const access = await resolveFacilityAccess(request.authUser);
  const tasks = await prisma.maintenanceTask.findMany({
    where: taskWhere(request, access.facilityWhere),
    select: reportSelect,
    orderBy: [{ submittedAt: 'desc' }, { facility: { name: 'asc' } }],
  });

  const headers = [
    'Submitted at',
    'Frequency',
    'Facility',
    'Checklist',
    'Equipment asset code',
    'Equipment type',
    'Completed by',
    'Completion status',
    'Compliance score',
    'Submitted offline',
    'Responses',
    'Evidence images',
  ];
  const rows = tasks.map((task) => {
    const report = serializeReport(task);
    return [
      report.submittedAt?.toISOString() ?? '',
      report.frequency,
      report.facility.name,
      report.checklist.name,
      report.equipment.assetCode,
      report.equipment.equipmentType.name,
      report.completedBy?.fullName ?? '',
      report.status,
      report.complianceScore ?? '',
      report.submittedOffline ? 'Yes' : 'No',
      report._count.responses,
      report._count.evidence,
    ];
  });
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');

  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="lga-task-reports-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  return response.send(`\uFEFF${csv}`);
}

function serializeEvidence(evidence) {
  return {
    ...evidence,
    latitude: evidence.latitude === null ? null : Number(evidence.latitude),
    longitude: evidence.longitude === null ? null : Number(evidence.longitude),
    gpsAccuracy: evidence.gpsAccuracy === null ? null : Number(evidence.gpsAccuracy),
    distanceFromFacilityMeters: evidence.distanceFromFacilityMeters === null
      ? null
      : Number(evidence.distanceFromFacilityMeters),
    uploadedBy: {
      ...evidence.user,
      fullName: `${evidence.user.firstName} ${evidence.user.lastName}`.trim(),
    },
    user: undefined,
    frequency: evidence.maintenanceTask?.maintenanceSchedule.frequencyType ?? null,
    taskStatus: evidence.maintenanceTask?.status ?? null,
    question: evidence.taskItemResponse?.checklistItem.title ?? null,
    maintenanceTask: undefined,
    taskItemResponse: undefined,
    source: evidence.fileUrl.includes('res.cloudinary.com') ? 'CLOUDINARY' : 'LOCAL',
  };
}

function serializeReportEvidence(evidence) {
  return {
    ...evidence,
    latitude: evidence.latitude === null ? null : Number(evidence.latitude),
    longitude: evidence.longitude === null ? null : Number(evidence.longitude),
    gpsAccuracy: evidence.gpsAccuracy === null ? null : Number(evidence.gpsAccuracy),
    distanceFromFacilityMeters: evidence.distanceFromFacilityMeters === null
      ? null
      : Number(evidence.distanceFromFacilityMeters),
    source: evidence.fileUrl.includes('res.cloudinary.com') ? 'CLOUDINARY' : 'LOCAL',
  };
}

export async function listLgaMedia(request, response) {
  const page = integer(request.query.page, 1, 1, 100000);
  const pageSize = integer(request.query.pageSize, 24, 6, 60);
  const access = await resolveFacilityAccess(request.authUser);
  const frequency = clean(request.query.frequency, 20).toUpperCase();
  const facilityId = clean(request.query.facilityId, 191);
  const { from, to } = reportDates(request);
  const where = {
    facility: access.facilityWhere,
    capturedAtDevice: { gte: from, lte: to },
    ...(facilityId ? { facilityId } : {}),
    ...(reportFrequencies.has(frequency) ? {
      maintenanceTask: { maintenanceSchedule: { frequencyType: frequency } },
    } : {}),
  };

  const [total, evidence, facilities] = await Promise.all([
    prisma.evidenceFile.count({ where }),
    prisma.evidenceFile.findMany({
      where,
      include: {
        facility: { select: { id: true, name: true } },
        equipment: { select: { id: true, assetCode: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
        maintenanceTask: {
          select: {
            id: true,
            status: true,
            maintenanceSchedule: { select: { frequencyType: true } },
          },
        },
        taskItemResponse: {
          select: { checklistItem: { select: { title: true } } },
        },
      },
      orderBy: { capturedAtDevice: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    scopedFacilities(access.facilityWhere),
  ]);

  return response.json({
    success: true,
    data: {
      media: evidence.map(serializeEvidence),
      filters: { facilities },
      period: { from, to },
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    },
  });
}

export async function getLgaTaskReport(request, response) {
  const access = await resolveFacilityAccess(request.authUser);
  const task = await prisma.maintenanceTask.findFirst({
    where: {
      id: request.params.id,
      facility: access.facilityWhere,
      status: { in: completedStatuses },
    },
    include: {
      facility: { select: { id: true, name: true } },
      equipment: {
        select: {
          id: true,
          assetCode: true,
          equipmentType: { select: { name: true } },
        },
      },
      completedBy: { select: { id: true, firstName: true, lastName: true } },
      maintenanceSchedule: {
        select: {
          frequencyType: true,
          checklistTemplate: { select: { id: true, name: true, version: true } },
        },
      },
      responses: {
        include: {
          checklistItem: {
            select: {
              id: true,
              title: true,
              inputType: true,
              sequenceOrder: true,
            },
          },
          evidence: true,
        },
        orderBy: { checklistItem: { sequenceOrder: 'asc' } },
      },
      _count: { select: { responses: true, evidence: true } },
    },
  });

  if (!task) {
    return response.status(404).json({
      success: false,
      message: 'Submitted task report not found in your LGA scope.',
    });
  }

  const report = serializeReport(task);
  report.responses = task.responses.map((item) => ({
    ...item,
    responseNumber: item.responseNumber === null ? null : Number(item.responseNumber),
    evidence: item.evidence.map(serializeReportEvidence),
  }));
  return response.json({ success: true, data: { report } });
}
