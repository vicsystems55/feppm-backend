import { prisma } from '../lib/prisma.js';
import { maintenanceScope, maintenanceWorkOrderWhere } from '../services/maintenanceAccessService.js';
import {
  assertIndependentReviewer,
  assertIndependentStoreReviewer,
  positiveQuantity,
  storeReviewTransition,
  workshopReviewTransition,
} from '../services/resourceRequestWorkflowService.js';
import { userHasRole } from '../services/userAccessService.js';

const personSelect = { id: true, firstName: true, lastName: true, email: true, phone: true };
const activeWorkOrderStatuses = ['APPROVED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'AWAITING_PARTS'];
const requestStatuses = ['SUBMITTED', 'WORKSHOP_APPROVED', 'AWAITING_STOCK', 'APPROVED_FOR_ISSUE', 'PARTIALLY_ISSUED', 'ISSUED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
const technicianRoles = new Set(['TECHNICIAN', 'VENDOR_TECHNICIAN']);
const requestInclude = {
  workshop: { include: { administrativeUnit: { select: { id: true, name: true, type: true } }, stores: { where: { status: 'ACTIVE' }, select: { id: true, name: true, code: true } } } },
  workOrder: { select: { id: true, workOrderNumber: true, title: true, status: true, facility: { select: { id: true, name: true } }, equipment: { select: { id: true, assetCode: true, equipmentType: { select: { name: true } } } } } },
  requestedBy: { select: personSelect },
  workshopReviewedBy: { select: personSelect },
  storeReviewedBy: { select: personSelect },
  items: { include: { toolCatalogItem: true, sparePart: true }, orderBy: { createdAt: 'asc' } },
  activities: { include: { actor: { select: personSelect } }, orderBy: { createdAt: 'desc' } },
};

function clean(value, max = 5000) { return String(value ?? '').trim().slice(0, max); }
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }
function hasAnyRole(user, roleSet) { return user.roles.some(({ role }) => roleSet.has(role.key)); }

async function scopedWorkshopWhere(user) {
  if (userHasRole(user, 'SUPER_ADMIN')) return {};
  const scope = await maintenanceScope(user);
  return { organizationId: user.organization.id, administrativeUnit: { is: scope.administrativeUnitWhere } };
}

async function requestWhere(user) {
  if (hasAnyRole(user, technicianRoles)) return { organizationId: user.organization.id, requestedById: user.id };
  return { workshop: { is: await scopedWorkshopWhere(user) } };
}

async function accessibleRequest(id, user) {
  if (!id) return null;
  return prisma.resourceRequest.findFirst({ where: { id, ...(await requestWhere(user)) }, include: requestInclude });
}

async function nextRequestNumber() {
  const year = new Date().getFullYear();
  const sequence = await prisma.resourceRequestSequence.upsert({
    where: { year },
    update: { currentValue: { increment: 1 } },
    create: { year, currentValue: 1 },
    select: { currentValue: true },
  });
  return `FEPPM-RR-${year}-${String(sequence.currentValue).padStart(6, '0')}`;
}

async function unitBelongsToWorkshopScope(unitId, workshopUnitId) {
  let currentId = unitId;
  const visited = new Set();
  while (currentId && !visited.has(currentId)) {
    if (currentId === workshopUnitId) return true;
    visited.add(currentId);
    const unit = await prisma.administrativeUnit.findUnique({ where: { id: currentId }, select: { parentId: true } });
    currentId = unit?.parentId ?? null;
  }
  return false;
}

function serializeRequest(resourceRequest) {
  return {
    ...resourceRequest,
    items: resourceRequest.items.map((item) => ({
      ...item,
      requestedQuantity: Number(item.requestedQuantity),
      approvedQuantity: item.approvedQuantity === null ? null : Number(item.approvedQuantity),
      issuedQuantity: Number(item.issuedQuantity),
      returnedQuantity: Number(item.returnedQuantity),
      consumedQuantity: Number(item.consumedQuantity),
    })),
  };
}

export async function listResourceRequests(request, response) {
  const status = clean(request.query.status, 40).toUpperCase();
  if (status && !requestStatuses.includes(status)) throw httpError(400, 'Resource request status filter is invalid.');
  const search = clean(request.query.search, 100);
  const where = {
    ...(await requestWhere(request.authUser)),
    ...(status ? { status } : {}),
    ...(search ? { OR: [{ requestNumber: { contains: search, mode: 'insensitive' } }, { purpose: { contains: search, mode: 'insensitive' } }, { workOrder: { is: { workOrderNumber: { contains: search, mode: 'insensitive' } } } }] } : {}),
  };
  const requests = await prisma.resourceRequest.findMany({ where, include: requestInclude, orderBy: { requestedAt: 'desc' }, take: 100 });
  response.json({ success: true, data: { requests: requests.map(serializeRequest) } });
}

export async function getResourceRequest(request, response) {
  const resourceRequest = await accessibleRequest(request.params.id, request.authUser);
  if (!resourceRequest) throw httpError(404, 'Resource request not found in your authorized scope.');
  response.json({ success: true, data: { request: serializeRequest(resourceRequest) } });
}

export async function getResourceRequestOptions(request, response) {
  const [workshops, workOrders] = await Promise.all([
    prisma.maintenanceWorkshop.findMany({ where: { ...(await scopedWorkshopWhere(request.authUser)), status: 'ACTIVE' }, include: { administrativeUnit: { select: { id: true, name: true } }, stores: { where: { status: 'ACTIVE' }, select: { id: true, name: true } } }, orderBy: { name: 'asc' } }),
    prisma.maintenanceWorkOrder.findMany({ where: { ...(await maintenanceWorkOrderWhere(request.authUser)), status: { in: activeWorkOrderStatuses } }, select: { id: true, workOrderNumber: true, title: true, status: true, organizationId: true, administrativeUnitId: true, facility: { select: { name: true } }, equipment: { select: { assetCode: true, equipmentType: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } }),
  ]);
  const organizationIds = [...new Set(workshops.map(({ organizationId }) => organizationId))];
  const [tools, spareParts] = await Promise.all([
    prisma.toolCatalogItem.findMany({ where: { status: 'ACTIVE' }, select: { id: true, code: true, name: true, category: true, unitOfMeasure: true }, orderBy: { name: 'asc' } }),
    prisma.sparePart.findMany({ where: { organizationId: { in: organizationIds }, status: 'ACTIVE' }, select: { id: true, organizationId: true, code: true, name: true, category: true, unitOfMeasure: true }, orderBy: { name: 'asc' } }),
  ]);
  response.json({ success: true, data: { workshops, workOrders, tools, spareParts } });
}

export async function createResourceRequest(request, response) {
  const purpose = clean(request.body?.purpose, 5000);
  const urgency = clean(request.body?.urgency, 30).toUpperCase() || 'ROUTINE';
  if (!purpose) throw httpError(400, 'Explain why these resources are required.');
  if (!['ROUTINE', 'URGENT', 'CRITICAL'].includes(urgency)) throw httpError(400, 'Request urgency is invalid.');
  const workshop = await prisma.maintenanceWorkshop.findFirst({ where: { id: request.body?.workshopId, ...(await scopedWorkshopWhere(request.authUser)), status: 'ACTIVE' } });
  if (!workshop) throw httpError(404, 'Workshop not found in your authorized scope.');
  const workOrder = await prisma.maintenanceWorkOrder.findFirst({ where: { id: request.body?.workOrderId, ...(await maintenanceWorkOrderWhere(request.authUser)), status: { in: activeWorkOrderStatuses } } });
  if (!workOrder) throw httpError(404, 'Select an active work order in your authorized scope.');
  if (workOrder.organizationId !== workshop.organizationId) throw httpError(400, 'The work order and workshop must belong to the same organization.');
  let workOrderUnitId = workOrder.administrativeUnitId;
  if (!workOrderUnitId && workOrder.facilityId) {
    workOrderUnitId = (await prisma.facility.findUnique({ where: { id: workOrder.facilityId }, select: { administrativeUnitId: true } }))?.administrativeUnitId;
  }
  if (!workOrderUnitId || !await unitBelongsToWorkshopScope(workOrderUnitId, workshop.administrativeUnitId)) {
    throw httpError(400, "The selected work order is outside this workshop's state scope.");
  }

  const submittedItems = Array.isArray(request.body?.items) ? request.body.items.slice(0, 20) : [];
  if (!submittedItems.length) throw httpError(400, 'Add at least one tool or spare part.');
  const seen = new Set();
  const items = [];
  for (const submitted of submittedItems) {
    const itemType = clean(submitted.itemType, 30).toUpperCase();
    if (!['TOOL', 'SPARE_PART'].includes(itemType)) throw httpError(400, 'Every request item must be a tool or spare part.');
    const itemId = itemType === 'TOOL' ? submitted.toolCatalogItemId : submitted.sparePartId;
    if (!itemId || seen.has(`${itemType}:${itemId}`)) throw httpError(400, 'Request items must be selected and cannot be duplicated.');
    seen.add(`${itemType}:${itemId}`);
    const requestedQuantity = positiveQuantity(submitted.requestedQuantity, { whole: itemType === 'TOOL', maximum: itemType === 'TOOL' ? 100 : 100000 });
    if (itemType === 'TOOL') {
      const exists = await prisma.toolCatalogItem.count({ where: { id: itemId, status: 'ACTIVE' } });
      if (!exists) throw httpError(400, 'A selected tool is not available in the catalogue.');
    } else {
      const exists = await prisma.sparePart.count({ where: { id: itemId, organizationId: workshop.organizationId, status: 'ACTIVE' } });
      if (!exists) throw httpError(400, 'A selected spare part is not available in this organization.');
    }
    items.push({ itemType, toolCatalogItemId: itemType === 'TOOL' ? itemId : null, sparePartId: itemType === 'SPARE_PART' ? itemId : null, requestedQuantity, notes: clean(submitted.notes, 2000) || null });
  }

  const requestNumber = await nextRequestNumber();
  const resourceRequest = await prisma.$transaction(async (transaction) => {
    const created = await transaction.resourceRequest.create({ data: { requestNumber, organizationId: workshop.organizationId, workshopId: workshop.id, workOrderId: workOrder.id, requestedById: request.authUser.id, urgency, purpose, items: { create: items } } });
    await transaction.resourceRequestActivity.create({ data: { resourceRequestId: created.id, actorId: request.authUser.id, action: 'REQUEST_SUBMITTED', toStatus: 'SUBMITTED', note: purpose, metadata: { itemCount: items.length } } });
    return created;
  });
  response.status(201).json({ success: true, message: `Resource request ${requestNumber} submitted.`, data: { request: serializeRequest(await accessibleRequest(resourceRequest.id, request.authUser)) } });
}

export async function reviewResourceRequestByWorkshop(request, response) {
  const resourceRequest = await accessibleRequest(request.params.id, request.authUser);
  if (!resourceRequest) throw httpError(404, 'Resource request not found in your authorized scope.');
  assertIndependentReviewer(resourceRequest, request.authUser.id);
  const decision = clean(request.body?.decision, 30).toUpperCase();
  const nextStatus = workshopReviewTransition(resourceRequest.status, decision);
  const note = clean(request.body?.note, 5000);
  if (decision === 'REJECT' && !note) throw httpError(400, 'A rejection reason is required.');
  const quantities = new Map((Array.isArray(request.body?.items) ? request.body.items : []).map((item) => [item.id, item.approvedQuantity]));

  await prisma.$transaction(async (transaction) => {
    if (decision === 'APPROVE') {
      for (const item of resourceRequest.items) {
        const proposed = quantities.has(item.id) ? quantities.get(item.id) : Number(item.requestedQuantity);
        const approvedQuantity = positiveQuantity(proposed, { whole: item.itemType === 'TOOL', maximum: Number(item.requestedQuantity) });
        await transaction.resourceRequestItem.update({ where: { id: item.id }, data: { approvedQuantity } });
      }
    }
    await transaction.resourceRequest.update({ where: { id: resourceRequest.id }, data: { status: nextStatus, workshopReviewedById: request.authUser.id, workshopReviewedAt: new Date(), workshopReviewNote: note || null } });
    await transaction.resourceRequestActivity.create({ data: { resourceRequestId: resourceRequest.id, actorId: request.authUser.id, action: decision === 'APPROVE' ? 'WORKSHOP_APPROVED' : 'WORKSHOP_REJECTED', fromStatus: resourceRequest.status, toStatus: nextStatus, note: note || null } });
  });
  response.json({ success: true, message: decision === 'APPROVE' ? 'Workshop review approved.' : 'Resource request rejected.', data: { request: serializeRequest(await accessibleRequest(resourceRequest.id, request.authUser)) } });
}

async function itemAvailability(resourceRequest) {
  const storeIds = resourceRequest.workshop.stores.map(({ id }) => id);
  const availability = new Map();
  for (const item of resourceRequest.items) {
    if (item.itemType === 'TOOL') {
      const count = await prisma.toolAsset.count({ where: { storeId: { in: storeIds }, toolCatalogItemId: item.toolCatalogItemId, status: 'AVAILABLE', currentCustodianId: null } });
      availability.set(item.id, count);
    } else {
      const balances = await prisma.stockBalance.findMany({ where: { storeId: { in: storeIds }, sparePartId: item.sparePartId }, select: { quantityOnHand: true, quantityReserved: true } });
      availability.set(item.id, balances.reduce((sum, balance) => sum + Number(balance.quantityOnHand) - Number(balance.quantityReserved), 0));
    }
  }
  return availability;
}

export async function reviewResourceRequestByStore(request, response) {
  const resourceRequest = await accessibleRequest(request.params.id, request.authUser);
  if (!resourceRequest) throw httpError(404, 'Resource request not found in your authorized scope.');
  assertIndependentStoreReviewer(resourceRequest, request.authUser.id);
  const decision = clean(request.body?.decision, 30).toUpperCase();
  const nextStatus = storeReviewTransition(resourceRequest.status, decision);
  const note = clean(request.body?.note, 5000);
  if (['REJECT', 'AWAITING_STOCK'].includes(decision) && !note) throw httpError(400, 'Explain the rejection or stock shortage.');

  if (decision === 'APPROVE') {
    const availability = await itemAvailability(resourceRequest);
    const shortages = resourceRequest.items.filter((item) => availability.get(item.id) < Number(item.approvedQuantity ?? item.requestedQuantity)).map((item) => item.toolCatalogItem?.name ?? item.sparePart?.name);
    if (shortages.length) throw httpError(409, `Insufficient verified availability for: ${shortages.join(', ')}. Mark the request as awaiting stock instead.`);
  }

  await prisma.$transaction([
    prisma.resourceRequest.update({ where: { id: resourceRequest.id }, data: { status: nextStatus, storeReviewedById: request.authUser.id, storeReviewedAt: new Date(), storeReviewNote: note || null } }),
    prisma.resourceRequestActivity.create({ data: { resourceRequestId: resourceRequest.id, actorId: request.authUser.id, action: decision === 'APPROVE' ? 'STORE_AUTHORIZED' : decision === 'AWAITING_STOCK' ? 'AWAITING_STOCK' : 'STORE_REJECTED', fromStatus: resourceRequest.status, toStatus: nextStatus, note: note || null } }),
  ]);
  response.json({ success: true, message: decision === 'APPROVE' ? 'Store availability confirmed; request is approved for issue.' : decision === 'AWAITING_STOCK' ? 'Request marked as awaiting stock.' : 'Resource request rejected.', data: { request: serializeRequest(await accessibleRequest(resourceRequest.id, request.authUser)) } });
}

export async function cancelResourceRequest(request, response) {
  const resourceRequest = await accessibleRequest(request.params.id, request.authUser);
  if (!resourceRequest || resourceRequest.requestedById !== request.authUser.id) throw httpError(404, 'Resource request not found.');
  if (resourceRequest.status !== 'SUBMITTED') throw httpError(409, 'Only an unreviewed submitted request can be cancelled.');
  const note = clean(request.body?.note, 1000) || 'Cancelled by requester.';
  await prisma.$transaction([
    prisma.resourceRequest.update({ where: { id: resourceRequest.id }, data: { status: 'CANCELLED' } }),
    prisma.resourceRequestActivity.create({ data: { resourceRequestId: resourceRequest.id, actorId: request.authUser.id, action: 'REQUEST_CANCELLED', fromStatus: resourceRequest.status, toStatus: 'CANCELLED', note } }),
  ]);
  response.json({ success: true, message: 'Resource request cancelled.' });
}
