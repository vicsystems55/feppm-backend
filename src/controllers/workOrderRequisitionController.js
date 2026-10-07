import { randomUUID } from 'node:crypto';

import { prisma } from '../lib/prisma.js';
import { maintenanceWorkOrderWhere } from '../services/maintenanceAccessService.js';
import { userHasRole } from '../services/userAccessService.js';

const submitterRoles = ['WORKSHOP_MANAGER', 'SUPER_ADMIN'];
const reviewerRoles = ['STATE_MAINTENANCE_MANAGER', 'SUPER_ADMIN'];
const excludedWorkOrderStatuses = ['COMPLETED', 'CANCELLED'];

const personSelect = { id: true, firstName: true, lastName: true, email: true };
const requisitionInclude = {
  items: {
    include: {
      workOrder: {
        include: {
          facility: { select: { id: true, name: true, facilityCode: true } },
          equipment: { select: { id: true, assetCode: true, equipmentType: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
};

function hasAnyRole(user, roles) {
  return roles.some((role) => userHasRole(user, role));
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function periodStart(value) {
  const match = String(value ?? '').match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) throw httpError(400, 'Select a valid requisition month.');
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function nextMonth(value) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
}

function monthRange(value) {
  return { gte: value, lt: nextMonth(value) };
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000 ? amount : null;
}

function requisitionNumber(month) {
  const period = `${month.getUTCFullYear()}${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
  return `FEPPM-REQ-${period}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

async function notifyUsers(userIds, title, message) {
  if (!userIds.length) return;
  await prisma.alert.create({
    data: {
      alertType: 'WORK_ORDER_REQUISITION',
      severity: 'MEDIUM',
      title,
      message,
      recipients: { create: userIds.map((userId) => ({ userId, deliveryChannel: 'IN_APP' })) },
    },
  });
}

async function stateManagerIds(organizationId, administrativeUnitId) {
  const managers = await prisma.user.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      roles: { some: { role: { key: 'STATE_MAINTENANCE_MANAGER' } } },
      ...(administrativeUnitId ? { scopes: { some: { administrativeUnitId } } } : {}),
    },
    select: { id: true },
  });
  return managers.map(({ id }) => id);
}

async function accessibleRequisition(id, user) {
  const workOrderScope = await maintenanceWorkOrderWhere(user);
  return prisma.monthlyWorkOrderRequisition.findFirst({
    where: { id, items: { some: { workOrder: { is: workOrderScope } } } },
    include: requisitionInclude,
  });
}

async function attachPeople(requisitions) {
  const ids = [...new Set(requisitions.flatMap((item) => [item.submittedById, item.reviewedById]).filter(Boolean))];
  const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: personSelect });
  const byId = new Map(people.map((person) => [person.id, person]));
  return requisitions.map((item) => ({
    ...item,
    submittedBy: byId.get(item.submittedById) ?? null,
    reviewedBy: byId.get(item.reviewedById) ?? null,
  }));
}

export async function listMonthlyRequisitions(request, response) {
  if (!hasAnyRole(request.authUser, [...submitterRoles, ...reviewerRoles])) {
    throw httpError(403, 'Monthly work-order requisitions are available to workshop and state maintenance managers.');
  }
  const month = request.query.month ? periodStart(request.query.month) : null;
  const workOrderScope = await maintenanceWorkOrderWhere(request.authUser);
  const requisitions = await prisma.monthlyWorkOrderRequisition.findMany({
    where: {
      ...(month ? { periodMonth: monthRange(month) } : {}),
      items: { some: { workOrder: { is: workOrderScope } } },
    },
    include: requisitionInclude,
    orderBy: [{ periodMonth: 'desc' }, { submittedAt: 'desc' }],
    take: 100,
  });
  response.json({ success: true, data: { requisitions: await attachPeople(requisitions) } });
}

export async function submitMonthlyRequisition(request, response) {
  if (!hasAnyRole(request.authUser, submitterRoles)) {
    throw httpError(403, 'Only a Workshop Manager can submit a monthly requisition.');
  }
  const periodMonth = periodStart(request.body?.month);
  const submittedItems = Array.isArray(request.body?.items) ? request.body.items : [];
  const itemMap = new Map(submittedItems.map((item) => [String(item.workOrderId ?? ''), money(item.estimatedCost)]));
  if (!itemMap.size || [...itemMap.values()].some((amount) => amount === null)) {
    throw httpError(400, 'Select at least one work order and enter a valid approximate cost for every item.');
  }

  const scope = await maintenanceWorkOrderWhere(request.authUser);
  const workOrders = await prisma.maintenanceWorkOrder.findMany({
    where: { AND: [scope, { id: { in: [...itemMap.keys()] } }, { status: { notIn: excludedWorkOrderStatuses } }] },
    select: { id: true, workOrderNumber: true, administrativeUnitId: true, organizationId: true },
  });
  if (workOrders.length !== itemMap.size) throw httpError(403, 'One or more selected work orders are outside your scope or already closed.');

  const duplicate = await prisma.monthlyWorkOrderRequisitionItem.findFirst({
    where: {
      workOrderId: { in: workOrders.map(({ id }) => id) },
      requisition: { periodMonth: monthRange(periodMonth), status: { not: 'DEFERRED' } },
    },
    include: { workOrder: { select: { workOrderNumber: true } } },
  });
  if (duplicate) throw httpError(409, `${duplicate.workOrder.workOrderNumber} is already included in this month's requisition.`);

  const assignment = await prisma.workshopStaffAssignment.findFirst({
    where: { userId: request.authUser.id, position: 'WORKSHOP_MANAGER', status: 'ACTIVE' },
    include: { workshop: { select: { id: true, administrativeUnitId: true } } },
    orderBy: { isPrimary: 'desc' },
  });
  const organizationId = workOrders[0].organizationId;
  const administrativeUnitId = assignment?.workshop.administrativeUnitId ?? workOrders[0].administrativeUnitId;
  const totalEstimatedCost = [...itemMap.values()].reduce((sum, amount) => sum + amount, 0);
  const number = requisitionNumber(periodMonth);

  const requisition = await prisma.$transaction(async (transaction) => {
    const created = await transaction.monthlyWorkOrderRequisition.create({
      data: {
        requisitionNumber: number,
        organizationId,
        administrativeUnitId,
        workshopId: assignment?.workshop.id ?? null,
        periodMonth,
        status: 'SUBMITTED',
        notes: String(request.body?.notes ?? '').trim().slice(0, 5000) || null,
        totalEstimatedCost,
        submittedById: request.authUser.id,
        items: {
          create: workOrders.map((order) => ({
            workOrderId: order.id,
            estimatedCost: itemMap.get(order.id),
          })),
        },
      },
      include: requisitionInclude,
    });
    await transaction.maintenanceWorkOrderActivity.createMany({
      data: workOrders.map((order) => ({
        workOrderId: order.id,
        actorId: request.authUser.id,
        action: 'MONTHLY_REQUISITION_SUBMITTED',
        note: `${number} submitted for monthly funding review.`,
        metadata: { requisitionId: created.id, periodMonth, estimatedCost: itemMap.get(order.id) },
      })),
    });
    return created;
  });

  await notifyUsers(
    await stateManagerIds(organizationId, administrativeUnitId),
    'Monthly work-order requisition submitted',
    `${number} was submitted with ${workOrders.length} work order(s), totalling NGN ${totalEstimatedCost.toLocaleString('en-NG')}.`,
  );
  response.status(201).json({ success: true, message: `${number} submitted to the State Maintenance Manager.`, data: { requisition } });
}

export async function reviewMonthlyRequisition(request, response) {
  if (!hasAnyRole(request.authUser, reviewerRoles)) {
    throw httpError(403, 'Only a State Maintenance Manager can review monthly requisitions.');
  }
  const requisition = await accessibleRequisition(request.params.id, request.authUser);
  if (!requisition) throw httpError(404, 'Monthly requisition not found in your scope.');
  if (requisition.status !== 'SUBMITTED') throw httpError(409, 'Only submitted requisitions can be reviewed.');
  const action = String(request.body?.action ?? '').toUpperCase();
  if (!['FUND', 'DEFER'].includes(action)) throw httpError(400, 'Choose FUND or DEFER.');
  const reviewedAt = new Date();

  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.monthlyWorkOrderRequisition.update({
      where: { id: requisition.id },
      data: { status: action === 'FUND' ? 'FUNDED' : 'DEFERRED', reviewedById: request.authUser.id, reviewedAt },
      include: requisitionInclude,
    });
    await transaction.monthlyWorkOrderRequisitionItem.updateMany({
      where: { requisitionId: requisition.id },
      data: action === 'FUND' ? { fundingStatus: 'APPROVED' } : { fundingStatus: 'DEFERRED' },
    });
    await transaction.maintenanceWorkOrderActivity.createMany({
      data: requisition.items.map(({ workOrderId }) => ({
        workOrderId,
        actorId: request.authUser.id,
        action: action === 'FUND' ? 'REQUISITION_FUNDED' : 'REQUISITION_DEFERRED',
        note: action === 'FUND' ? `${requisition.requisitionNumber} approved for funding.` : `${requisition.requisitionNumber} deferred to the next month.`,
        metadata: { requisitionId: requisition.id },
      })),
    });

    let carryOver = null;
    if (action === 'DEFER') {
      const carryMonth = nextMonth(requisition.periodMonth);
      carryOver = await transaction.monthlyWorkOrderRequisition.create({
        data: {
          requisitionNumber: requisitionNumber(carryMonth),
          organizationId: requisition.organizationId,
          administrativeUnitId: requisition.administrativeUnitId,
          workshopId: requisition.workshopId,
          periodMonth: carryMonth,
          status: 'SUBMITTED',
          notes: `Carried over from ${requisition.requisitionNumber}.`,
          totalEstimatedCost: requisition.totalEstimatedCost,
          submittedById: requisition.submittedById,
          submittedAt: reviewedAt,
          carriedFromId: requisition.id,
          items: {
            create: requisition.items.map((item) => ({
              workOrderId: item.workOrderId,
              estimatedCost: item.estimatedCost,
              sourceItemId: item.id,
            })),
          },
        },
      });
    }
    return { updated, carryOver };
  });

  await notifyUsers(
    [requisition.submittedById],
    action === 'FUND' ? 'Work-order requisition funded' : 'Work-order requisition carried over',
    action === 'FUND'
      ? `${requisition.requisitionNumber} has been approved for funding.`
      : `${requisition.requisitionNumber} has been deferred and moved to the next month.`,
  );
  response.json({
    success: true,
    message: action === 'FUND' ? 'Monthly requisition marked as funded.' : 'Monthly requisition deferred to the next month.',
    data: result,
  });
}
