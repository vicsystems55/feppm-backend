import { prisma } from '../lib/prisma.js';
import { resolveFacilityAccess } from '../services/facilityAccessService.js';

const taskFrequencies = new Set(['DAILY', 'WEEKLY', 'MONTHLY']);
const taskStatuses = new Set([
  'UPCOMING',
  'DUE',
  'IN_PROGRESS',
  'SUBMITTED',
  'COMPLETED_ON_TIME',
  'COMPLETED_LATE',
  'OVERDUE',
  'MISSED',
  'WAIVED',
  'NOT_APPLICABLE',
  'CANCELLED',
]);
const functionalityStatuses = new Set([
  'FUNCTIONAL',
  'PARTIALLY_FUNCTIONAL',
  'NON_FUNCTIONAL',
  'UNDER_REPAIR',
  'DECOMMISSIONED',
  'UNKNOWN',
]);
const conditionStatuses = new Set(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL', 'UNKNOWN']);

function integer(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function clean(value, maximum = 100) {
  return String(value ?? '').trim().slice(0, maximum);
}

function dateRange(request, frequency) {
  const now = new Date();
  const fromValue = clean(request.query.from, 10);
  const toValue = clean(request.query.to, 10);
  if (fromValue || toValue) {
    const from = fromValue ? new Date(`${fromValue}T00:00:00.000+01:00`) : new Date(0);
    const to = toValue ? new Date(`${toValue}T23:59:59.999+01:00`) : now;
    return {
      from: Number.isNaN(from.getTime()) ? new Date(0) : from,
      to: Number.isNaN(to.getTime()) ? now : to,
    };
  }

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (frequency === 'WEEKLY') {
    const mondayOffset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - mondayOffset);
  } else if (frequency === 'MONTHLY') {
    from.setDate(1);
  }
  const to = new Date(from);
  if (frequency === 'DAILY') to.setDate(to.getDate() + 1);
  if (frequency === 'WEEKLY') to.setDate(to.getDate() + 7);
  if (frequency === 'MONTHLY') to.setMonth(to.getMonth() + 1);
  to.setMilliseconds(to.getMilliseconds() - 1);
  return { from, to };
}

async function filterOptions(facilityWhere) {
  const [facilities, equipmentTypes] = await Promise.all([
    prisma.facility.findMany({
      where: facilityWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.equipmentType.findMany({
      where: { equipment: { some: { facility: facilityWhere } } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { facilities, equipmentTypes };
}

function equipmentWhere(request, facilityWhere) {
  const search = clean(request.query.search, 100);
  const facilityId = clean(request.query.facilityId, 191);
  const equipmentTypeId = clean(request.query.equipmentTypeId, 191);
  const functionality = clean(request.query.functionality, 40).toUpperCase();
  const condition = clean(request.query.condition, 40).toUpperCase();
  const recordStatus = clean(request.query.status, 20).toUpperCase();
  const conditions = [];
  if (search) {
    conditions.push({
      OR: [
        { assetCode: { contains: search } },
        { serialNumber: { contains: search } },
        { equipmentType: { name: { contains: search } } },
        { facility: { name: { contains: search } } },
      ],
    });
  }
  return {
    facility: facilityWhere,
    ...(facilityId ? { facilityId } : {}),
    ...(equipmentTypeId ? { equipmentTypeId } : {}),
    ...(functionalityStatuses.has(functionality) ? { functionalityStatus: functionality } : {}),
    ...(conditionStatuses.has(condition) ? { conditionStatus: condition } : {}),
    ...(['ACTIVE', 'INACTIVE'].includes(recordStatus) ? { status: recordStatus } : {}),
    ...(conditions.length ? { AND: conditions } : {}),
  };
}

const equipmentSelect = {
  id: true,
  assetCode: true,
  serialNumber: true,
  yearOfManufacture: true,
  installationDate: true,
  powerSource: true,
  functionalityStatus: true,
  conditionStatus: true,
  underWarranty: true,
  warrantyEndDate: true,
  nonFunctionalReason: true,
  source: true,
  status: true,
  facility: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  equipmentType: {
    select: {
      id: true,
      name: true,
      category: { select: { id: true, name: true } },
    },
  },
  equipmentModel: {
    select: {
      id: true,
      modelName: true,
      manufacturer: { select: { id: true, name: true } },
    },
  },
  _count: { select: { tasks: true, evidence: true, schedules: true } },
};

export async function listLgaEquipment(request, response) {
  const page = integer(request.query.page, 1, 1, 100000);
  const pageSize = integer(request.query.pageSize, 20, 5, 100);
  const access = await resolveFacilityAccess(request.authUser);
  const where = equipmentWhere(request, access.facilityWhere);
  const scopedWhere = { facility: access.facilityWhere, status: 'ACTIVE' };

  const [total, equipment, activeTotal, functional, partial, nonFunctional, underRepair, unknown, options] = await Promise.all([
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({
      where,
      select: equipmentSelect,
      orderBy: [{ facility: { name: 'asc' } }, { assetCode: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.equipment.count({ where: scopedWhere }),
    prisma.equipment.count({ where: { ...scopedWhere, functionalityStatus: 'FUNCTIONAL' } }),
    prisma.equipment.count({ where: { ...scopedWhere, functionalityStatus: 'PARTIALLY_FUNCTIONAL' } }),
    prisma.equipment.count({ where: { ...scopedWhere, functionalityStatus: 'NON_FUNCTIONAL' } }),
    prisma.equipment.count({ where: { ...scopedWhere, functionalityStatus: 'UNDER_REPAIR' } }),
    prisma.equipment.count({ where: { ...scopedWhere, functionalityStatus: 'UNKNOWN' } }),
    filterOptions(access.facilityWhere),
  ]);

  return response.json({
    success: true,
    data: {
      equipment,
      summary: {
        total: activeTotal,
        functional,
        partial,
        nonFunctional,
        underRepair,
        unknown,
      },
      filters: options,
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    },
  });
}

export async function getLgaEquipment(request, response) {
  const access = await resolveFacilityAccess(request.authUser);
  const equipment = await prisma.equipment.findFirst({
    where: { id: request.params.id, facility: access.facilityWhere },
    include: {
      facility: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      equipmentType: { include: { category: true } },
      equipmentModel: { include: { manufacturer: true } },
      vendor: true,
      documents: { orderBy: { createdAt: 'desc' } },
      statusHistory: { orderBy: { changedAt: 'desc' }, take: 10 },
      schedules: {
        include: {
          checklistTemplate: { select: { name: true, frequencyType: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { tasks: true, evidence: true, alerts: true, tickets: true } },
    },
  });
  if (!equipment) {
    return response.status(404).json({
      success: false,
      message: 'Equipment was not found in your LGA scope.',
    });
  }
  return response.json({ success: true, data: { equipment } });
}

function taskWhere(request, facilityWhere, frequency) {
  const status = clean(request.query.status, 40).toUpperCase();
  const facilityId = clean(request.query.facilityId, 191);
  const search = clean(request.query.search, 100);
  const period = dateRange(request, frequency);
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
    where: {
      facility: facilityWhere,
      scheduledAt: { gte: period.from, lte: period.to },
      maintenanceSchedule: { frequencyType: frequency },
      ...(facilityId ? { facilityId } : {}),
      ...(taskStatuses.has(status) ? { status } : {}),
      ...(conditions.length ? { AND: conditions } : {}),
    },
    period,
  };
}

export async function listLgaTasks(request, response) {
  const page = integer(request.query.page, 1, 1, 100000);
  const pageSize = integer(request.query.pageSize, 20, 5, 100);
  const requestedFrequency = clean(request.query.frequency, 20).toUpperCase();
  const frequency = taskFrequencies.has(requestedFrequency) ? requestedFrequency : 'DAILY';
  const access = await resolveFacilityAccess(request.authUser);
  const { where, period } = taskWhere(request, access.facilityWhere, frequency);

  const [total, tasks, completed, pending, inProgress, overdue, facilities] = await Promise.all([
    prisma.maintenanceTask.count({ where }),
    prisma.maintenanceTask.findMany({
      where,
      select: {
        id: true,
        scheduledAt: true,
        dueAt: true,
        submittedAt: true,
        status: true,
        submittedOffline: true,
        complianceScore: true,
        facility: { select: { id: true, name: true } },
        equipment: {
          select: {
            id: true,
            assetCode: true,
            equipmentType: { select: { name: true } },
          },
        },
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        maintenanceSchedule: {
          select: {
            checklistTemplate: { select: { id: true, name: true, version: true } },
          },
        },
        _count: { select: { responses: true, evidence: true } },
      },
      orderBy: [{ dueAt: 'asc' }, { facility: { name: 'asc' } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.maintenanceTask.count({
      where: { ...where, status: { in: ['COMPLETED_ON_TIME', 'COMPLETED_LATE'] } },
    }),
    prisma.maintenanceTask.count({ where: { ...where, status: { in: ['UPCOMING', 'DUE'] } } }),
    prisma.maintenanceTask.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    prisma.maintenanceTask.count({ where: { ...where, status: { in: ['OVERDUE', 'MISSED'] } } }),
    prisma.facility.findMany({
      where: access.facilityWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return response.json({
    success: true,
    data: {
      frequency,
      period,
      tasks: tasks.map((task) => ({
        ...task,
        complianceScore: task.complianceScore === null ? null : Number(task.complianceScore),
        checklist: task.maintenanceSchedule.checklistTemplate,
        maintenanceSchedule: undefined,
        assignedUser: task.assignedUser
          ? {
            ...task.assignedUser,
            fullName: `${task.assignedUser.firstName} ${task.assignedUser.lastName}`.trim(),
          }
          : null,
      })),
      summary: { total, completed, pending, inProgress, overdue },
      filters: { facilities },
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    },
  });
}
