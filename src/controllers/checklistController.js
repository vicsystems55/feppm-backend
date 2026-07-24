import { prisma } from '../lib/prisma.js';
import { awardDailyTaskCompletion } from '../services/rewardService.js';

const frequencies = new Set(['DAILY', 'WEEKLY', 'MONTHLY']);
const inputTypes = new Set(['CHECKBOX', 'YES_NO', 'PASS_FAIL', 'NUMBER', 'TEMPERATURE', 'HUMIDITY', 'DATE', 'TIME', 'SHORT_TEXT', 'LONG_TEXT', 'DROPDOWN', 'MULTI_SELECT', 'PHOTO', 'MULTIPLE_PHOTOS', 'SIGNATURE', 'GPS_CONFIRMATION']);
const photoTypes = new Set(['PHOTO', 'MULTIPLE_PHOTOS']);
const checklistTransactionTimeoutMs =
  Number.parseInt(process.env.CHECKLIST_TRANSACTION_TIMEOUT_MS, 10) || 20_000;

function clean(value, length = 255) {
  return typeof value === 'string' ? value.trim().slice(0, length) : '';
}

function completionStamp(date, timezone = 'Africa/Lagos') {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function periodBounds(frequency, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (frequency === 'WEEKLY') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  } else if (frequency === 'MONTHLY') {
    start.setDate(1);
  }
  const end = new Date(start);
  if (frequency === 'DAILY') end.setDate(end.getDate() + 1);
  if (frequency === 'WEEKLY') end.setDate(end.getDate() + 7);
  if (frequency === 'MONTHLY') end.setMonth(end.getMonth() + 1);
  return { start, end };
}

function validateItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Add at least one checklist question.');
  return items.map((item, index) => {
    const title = clean(item.title, 300);
    const inputType = clean(item.inputType, 40).toUpperCase();
    if (!title) throw new Error(`Question ${index + 1} requires a title.`);
    if (!inputTypes.has(inputType)) throw new Error(`Question ${index + 1} has an unsupported answer type.`);
    return {
      title,
      instruction: clean(item.instruction, 1000) || null,
      inputType,
      isRequired: item.isRequired !== false,
      evidenceRequirement: photoTypes.has(inputType) || item.evidenceRequirement === 'REQUIRED' ? 'REQUIRED' : item.evidenceRequirement === 'OPTIONAL' ? 'OPTIONAL' : 'NONE',
      sequenceOrder: index + 1,
      riskLevel: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(item.riskLevel) ? item.riskLevel : 'LOW',
    };
  });
}

const templateInclude = {
  equipmentType: { include: { category: { select: { id: true, name: true } } } },
  items: { orderBy: { sequenceOrder: 'asc' }, include: { options: { orderBy: { sequenceOrder: 'asc' } } } },
  _count: { select: { schedules: true } },
};

export async function listEquipmentTypes(_request, response) {
  const equipmentTypes = await prisma.equipmentType.findMany({
    include: { category: { select: { id: true, name: true } }, _count: { select: { equipment: true } } },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  });
  return response.json({ success: true, data: { equipmentTypes } });
}

export async function listTemplates(request, response) {
  const frequency = frequencies.has(request.query.frequency) ? request.query.frequency : undefined;
  const templates = await prisma.checklistTemplate.findMany({
    where: { ...(frequency ? { frequencyType: frequency } : {}) },
    include: templateInclude,
    orderBy: [{ frequencyType: 'asc' }, { name: 'asc' }, { version: 'desc' }],
  });
  return response.json({ success: true, data: { templates } });
}

export async function createTemplate(request, response) {
  try {
    const name = clean(request.body?.name, 180);
    const version = clean(request.body?.version, 30) || '1.0';
    const frequencyType = clean(request.body?.frequencyType, 30).toUpperCase();
    const equipmentTypeId = clean(request.body?.equipmentTypeId, 191);
    if (!name || !equipmentTypeId || !frequencies.has(frequencyType)) {
      return response.status(400).json({ success: false, message: 'Name, equipment type, and a daily, weekly, or monthly frequency are required.' });
    }
    const items = validateItems(request.body?.items);
    const template = await prisma.checklistTemplate.create({
      data: {
        equipmentTypeId, name, version, frequencyType, status: 'INACTIVE',
        estimatedDurationMinutes: Number.isFinite(Number(request.body?.estimatedDurationMinutes)) ? Math.max(1, Number(request.body.estimatedDurationMinutes)) : null,
        items: { create: items },
      },
      include: templateInclude,
    });
    return response.status(201).json({ success: true, message: 'Checklist draft created.', data: { template } });
  } catch (error) {
    if (error.code === 'P2002') return response.status(409).json({ success: false, message: 'This checklist version already exists.' });
    return response.status(400).json({ success: false, message: error.message });
  }
}

export async function updateTemplate(request, response) {
  const existing = await prisma.checklistTemplate.findUnique({ where: { id: request.params.id }, include: { _count: { select: { schedules: true } } } });
  if (!existing) return response.status(404).json({ success: false, message: 'Checklist template not found.' });
  if (existing.status !== 'INACTIVE' || existing._count.schedules) return response.status(409).json({ success: false, message: 'Published templates are immutable. Create a new version instead.' });
  try {
    const items = validateItems(request.body?.items);
    await prisma.$transaction([
      prisma.checklistItem.deleteMany({ where: { checklistTemplateId: existing.id } }),
      prisma.checklistTemplate.update({
        where: { id: existing.id },
        data: {
          name: clean(request.body?.name, 180) || existing.name,
          version: clean(request.body?.version, 30) || existing.version,
          frequencyType: frequencies.has(request.body?.frequencyType) ? request.body.frequencyType : existing.frequencyType,
          estimatedDurationMinutes: Number.isFinite(Number(request.body?.estimatedDurationMinutes)) ? Math.max(1, Number(request.body.estimatedDurationMinutes)) : null,
          items: { create: items },
        },
      }),
    ]);
    const template = await prisma.checklistTemplate.findUnique({ where: { id: existing.id }, include: templateInclude });
    return response.json({ success: true, message: 'Checklist draft updated.', data: { template } });
  } catch (error) {
    return response.status(400).json({ success: false, message: error.message });
  }
}

export async function publishTemplate(request, response) {
  const template = await prisma.checklistTemplate.findUnique({ where: { id: request.params.id }, include: { items: true } });
  if (!template) return response.status(404).json({ success: false, message: 'Checklist template not found.' });
  if (!template.items.length) return response.status(400).json({ success: false, message: 'A checklist must contain questions before publishing.' });
  const [facilityManagerRole, equipment] = await Promise.all([
    prisma.role.findUnique({ where: { key: 'FACILITY_MANAGER' } }),
    prisma.equipment.findMany({ where: { equipmentTypeId: template.equipmentTypeId, status: 'ACTIVE' }, select: { id: true } }),
  ]);
  await prisma.$transaction(async (tx) => {
    await tx.checklistTemplate.updateMany({
      where: { equipmentTypeId: template.equipmentTypeId, frequencyType: template.frequencyType, name: template.name, status: 'ACTIVE', id: { not: template.id } },
      data: { status: 'ARCHIVED' },
    });
    await tx.checklistTemplate.update({ where: { id: template.id }, data: { status: 'ACTIVE' } });
    for (const item of equipment) {
      const schedule = await tx.maintenanceSchedule.findFirst({ where: { equipmentId: item.id, checklistTemplateId: template.id } });
      if (!schedule) await tx.maintenanceSchedule.create({ data: { equipmentId: item.id, checklistTemplateId: template.id, assignedRoleId: facilityManagerRole?.id, frequencyType: template.frequencyType, startDate: new Date(), active: true } });
    }
  });
  return response.json({ success: true, message: `Checklist published and applied to ${equipment.length} registered equipment records.`, data: { equipmentScheduled: equipment.length } });
}

export async function archiveTemplate(request, response) {
  const template = await prisma.checklistTemplate.update({ where: { id: request.params.id }, data: { status: 'ARCHIVED', schedules: { updateMany: { where: {}, data: { active: false } } } } });
  return response.json({ success: true, message: 'Checklist archived.', data: { template } });
}

async function ensureManagerTasks(user, frequency) {
  const facilityId = user.facility?.id;
  if (!facilityId) return;
  const { start, end } = periodBounds(frequency);
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { active: true, frequencyType: frequency, equipment: { facilityId, status: 'ACTIVE' }, checklistTemplate: { status: 'ACTIVE' } },
    include: { equipment: { select: { facilityId: true } } },
  });
  for (const schedule of schedules) {
    const exists = await prisma.maintenanceTask.findFirst({ where: { maintenanceScheduleId: schedule.id, scheduledAt: { gte: start, lt: end } } });
    if (!exists) await prisma.maintenanceTask.create({ data: { maintenanceScheduleId: schedule.id, equipmentId: schedule.equipmentId, facilityId: schedule.equipment.facilityId, assignedUserId: user.id, scheduledAt: start, dueAt: end, overdueAt: end, status: 'DUE' } });
  }
}

export async function listMyChecklistTasks(request, response) {
  const frequency = frequencies.has(request.query.frequency) ? request.query.frequency : 'DAILY';
  await ensureManagerTasks(request.authUser, frequency);
  const { start, end } = periodBounds(frequency);
  const tasks = await prisma.maintenanceTask.findMany({
    where: { facilityId: request.authUser.facility?.id ?? '__none__', assignedUserId: request.authUser.id, scheduledAt: { gte: start, lt: end }, maintenanceSchedule: { frequencyType: frequency } },
    include: {
      equipment: { select: { id: true, assetCode: true, equipmentType: { select: { name: true } } } },
      maintenanceSchedule: { include: { checklistTemplate: { include: { items: { orderBy: { sequenceOrder: 'asc' } } } } } },
      responses: { include: { evidence: true } },
    },
    orderBy: { dueAt: 'asc' },
  });
  return response.json({ success: true, data: { frequency, period: { start, end }, tasks } });
}

export async function startChecklistTask(request, response) {
  const task = await prisma.maintenanceTask.findFirst({ where: { id: request.params.id, assignedUserId: request.authUser.id, facilityId: request.authUser.facility?.id ?? '__none__' } });
  if (!task) return response.status(404).json({ success: false, message: 'Checklist task not found.' });
  const updated = await prisma.maintenanceTask.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS', startedAt: task.startedAt ?? new Date() } });
  return response.json({ success: true, data: { task: updated } });
}

export async function submitChecklistTask(request, response) {
  const task = await prisma.maintenanceTask.findFirst({
    where: { id: request.params.id, assignedUserId: request.authUser.id, facilityId: request.authUser.facility?.id ?? '__none__' },
    include: {
      equipment: { select: { assetCode: true } },
      facility: {
        select: {
          id: true,
          name: true,
          organizationId: true,
          administrativeUnitId: true,
          managerUserId: true,
          timezone: true,
        },
      },
      maintenanceSchedule: { include: { checklistTemplate: { include: { items: true } } } },
    },
  });
  if (!task) return response.status(404).json({ success: false, message: 'Checklist task not found.' });
  if (['COMPLETED_ON_TIME', 'COMPLETED_LATE'].includes(task.status)) {
    return response.json({
      success: true,
      message: 'This checklist task was already submitted.',
    });
  }
  const submitted = new Map((Array.isArray(request.body?.responses) ? request.body.responses : []).map((item) => [item.checklistItemId, item]));
  for (const item of task.maintenanceSchedule.checklistTemplate.items) {
    const answer = submitted.get(item.id);
    const hasValue = answer && [answer.boolean, answer.number, answer.text, answer.optionId].some((value) => value !== undefined && value !== null && value !== '');
    const photos = Array.isArray(answer?.photos) ? answer.photos.filter((photo) => clean(photo.fileUrl, 1000)) : [];
    if (item.isRequired && !hasValue && !photoTypes.has(item.inputType)) return response.status(400).json({ success: false, message: `Answer required: ${item.title}` });
    if (item.evidenceRequirement === 'REQUIRED' && !photos.length) return response.status(400).json({ success: false, message: `Photo required: ${item.title}` });
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const item of task.maintenanceSchedule.checklistTemplate.items) {
      const answer = submitted.get(item.id) ?? {};
      const itemResponse = await tx.taskItemResponse.upsert({
        where: { maintenanceTaskId_checklistItemId: { maintenanceTaskId: task.id, checklistItemId: item.id } },
        update: { responseBoolean: typeof answer.boolean === 'boolean' ? answer.boolean : null, responseNumber: Number.isFinite(Number(answer.number)) ? Number(answer.number) : null, responseText: clean(answer.text, 4000) || null, responseOptionId: clean(answer.optionId, 191) || null, comment: clean(answer.comment, 1000) || null, completedAt: now },
        create: { maintenanceTaskId: task.id, checklistItemId: item.id, responseBoolean: typeof answer.boolean === 'boolean' ? answer.boolean : null, responseNumber: Number.isFinite(Number(answer.number)) ? Number(answer.number) : null, responseText: clean(answer.text, 4000) || null, responseOptionId: clean(answer.optionId, 191) || null, comment: clean(answer.comment, 1000) || null, completedAt: now },
      });
      for (const photo of Array.isArray(answer.photos) ? answer.photos : []) {
        const fileUrl = clean(photo.fileUrl, 1000);
        if (!fileUrl) continue;
        const alreadySaved = await tx.evidenceFile.findFirst({ where: { taskItemResponseId: itemResponse.id, fileUrl } });
        if (!alreadySaved) await tx.evidenceFile.create({ data: { maintenanceTaskId: task.id, taskItemResponseId: itemResponse.id, equipmentId: task.equipmentId, facilityId: task.facilityId, userId: request.authUser.id, fileUrl, thumbnailUrl: clean(photo.thumbnailUrl, 1000) || null, capturedAtDevice: photo.capturedAt ? new Date(photo.capturedAt) : now, latitude: Number.isFinite(Number(photo.latitude)) ? Number(photo.latitude) : null, longitude: Number.isFinite(Number(photo.longitude)) ? Number(photo.longitude) : null, capturedOffline: photo.capturedOffline === true, syncedAt: now } });
      }
    }
    await tx.maintenanceTask.update({ where: { id: task.id }, data: { status: now <= task.dueAt ? 'COMPLETED_ON_TIME' : 'COMPLETED_LATE', submittedAt: now, completedAt: now, completedById: request.authUser.id, submittedOffline: request.body?.submittedOffline === true, syncedAt: now, complianceScore: 100 } });

    if (task.maintenanceSchedule.frequencyType === 'DAILY') {
      await awardDailyTaskCompletion(tx, {
        userId: request.authUser.id,
        taskId: task.id,
        completedAt: now,
        timezone: task.facility.timezone,
      });
    }

    const existingCompletionAlerts = await tx.alert.findMany({
      where: {
        maintenanceTaskId: task.id,
        alertType: {
          in: ['TASK_COMPLETED_MANAGER', 'TASK_COMPLETED_LGA'],
        },
      },
      select: { alertType: true },
    });
    const existingTypes = new Set(
      existingCompletionAlerts.map((alert) => alert.alertType),
    );
    const managerName = [
      request.authUser.firstName,
      request.authUser.lastName,
    ].filter(Boolean).join(' ') || 'A Facility Manager';
    const frequency = task.maintenanceSchedule.frequencyType.toLowerCase();
    const completedOn = completionStamp(now, task.facility.timezone);

    if (!existingTypes.has('TASK_COMPLETED_MANAGER')) {
      const facilityManagers = await tx.user.findMany({
        where: {
          organizationId: task.facility.organizationId,
          status: 'ACTIVE',
          OR: [
            {
              id: {
                in: [
                  request.authUser.id,
                  task.assignedUserId,
                  task.facility.managerUserId,
                ].filter(Boolean),
              },
            },
            {
              facilityId: task.facilityId,
              roles: { some: { role: { key: 'FACILITY_MANAGER' } } },
            },
          ],
        },
        select: { id: true },
      });

      const managerIds = [
        ...new Set(facilityManagers.map((user) => user.id)),
      ];
      if (managerIds.length) {
        await tx.alert.create({
          data: {
            facilityId: task.facilityId,
            equipmentId: task.equipmentId,
            maintenanceTaskId: task.id,
            alertType: 'TASK_COMPLETED_MANAGER',
            severity: 'LOW',
            title: "Today's task has been completed",
            message: `Your ${frequency} maintenance task for ${task.equipment.assetCode} at ${task.facility.name} was completed on ${completedOn}.`,
            status: 'RESOLVED',
            resolvedAt: now,
            recipients: {
              create: managerIds.map((userId) => ({
                userId,
                deliveryChannel: 'IN_APP',
              })),
            },
          },
        });
      }
    }

    if (!existingTypes.has('TASK_COMPLETED_LGA')) {
      const lgaAdmins = await tx.user.findMany({
        where: {
          organizationId: task.facility.organizationId,
          status: 'ACTIVE',
          roles: { some: { role: { key: 'LGA_ADMIN' } } },
          scopes: {
            some: {
              administrativeUnitId: task.facility.administrativeUnitId,
            },
          },
        },
        select: { id: true },
      });

      if (lgaAdmins.length) {
        await tx.alert.create({
          data: {
            facilityId: task.facilityId,
            equipmentId: task.equipmentId,
            maintenanceTaskId: task.id,
            alertType: 'TASK_COMPLETED_LGA',
            severity: 'LOW',
            title: 'Facility task completed',
            message: `${managerName} completed the ${frequency} maintenance task for ${task.equipment.assetCode} at ${task.facility.name} on ${completedOn}.`,
            status: 'RESOLVED',
            resolvedAt: now,
            recipients: {
              create: lgaAdmins.map(({ id: userId }) => ({
                userId,
                deliveryChannel: 'IN_APP',
              })),
            },
          },
        });
      }
    }
  }, {
    timeout: checklistTransactionTimeoutMs,
  });
  return response.json({ success: true, message: 'Checklist submitted successfully.' });
}
