import { prisma } from '../lib/prisma.js';
import { maintenanceScope, maintenanceWorkOrderWhere } from '../services/maintenanceAccessService.js';
import { normalizeTicketAttachments } from '../services/ticketAttachmentService.js';
import { userHasRole } from '../services/userAccessService.js';
import { resolveWorkOrderTransition } from '../services/workOrderWorkflowService.js';

const personSelect = { id: true, firstName: true, lastName: true, email: true, phone: true };
const evidenceCategories = ['ARRIVAL', 'BEFORE_REPAIR', 'DURING_REPAIR', 'AFTER_REPAIR', 'PART_USED', 'OTHER'];
const partSources = ['STATE_STORE', 'LOCAL_PURCHASE', 'VENDOR', 'TECHNICIAN_STOCK', 'OTHER'];
const equipmentStatuses = ['FUNCTIONAL', 'PARTIALLY_FUNCTIONAL', 'NON_FUNCTIONAL', 'DECOMMISSIONED', 'UNKNOWN'];

export const maintenanceExecutionInclude = {
  ticket: { select: { id: true, ticketNumber: true, title: true, status: true, severity: true, faultDescription: true } },
  facility: { select: { id: true, name: true, facilityCode: true, latitude: true, longitude: true } },
  equipment: { select: { id: true, assetCode: true, serialNumber: true, functionalityStatus: true, equipmentType: { select: { id: true, name: true } } } },
  assignedTechnician: { include: { user: { select: personSelect }, skills: { include: { maintenanceSkill: true } } } },
  vendorContract: { include: { vendor: { select: { id: true, name: true } } } },
  createdBy: { select: personSelect },
  approvedBy: { select: personSelect },
  fieldReport: { include: { submittedBy: { select: personSelect } } },
  partsUsed: { orderBy: { createdAt: 'asc' } },
  evidence: { include: { uploadedBy: { select: personSelect } }, orderBy: { createdAt: 'asc' } },
  activities: { include: { actor: { select: personSelect } }, orderBy: { createdAt: 'desc' }, take: 100 },
};

function clean(value, length = 5000) { return String(value ?? '').trim().slice(0, length); }
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }
function integer(value, fallback = null, minimum = 0, maximum = 1000000) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
function decimal(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function dateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function enumValue(value, allowed, fallback = null) {
  const normalized = clean(value, 100).toUpperCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

async function accessibleWorkOrder(id, user) {
  return prisma.maintenanceWorkOrder.findFirst({
    where: { id, ...(await maintenanceWorkOrderWhere(user)) },
    include: maintenanceExecutionInclude,
  });
}

async function requireWorkOrder(id, user) {
  const workOrder = await accessibleWorkOrder(id, user);
  if (!workOrder) throw httpError(404, 'Work order not found in your authorized scope.');
  return workOrder;
}

async function requireAssignedExecutor(workOrder, user) {
  if (userHasRole(user, 'SUPER_ADMIN')) return;
  const profile = await prisma.technicianProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile || profile.id !== workOrder.assignedTechnicianId) {
    throw httpError(403, 'Only the technician assigned to this work order can perform field actions.');
  }
}

async function activity(transaction, workOrder, actorId, action, toStatus = null, note = null, metadata = null) {
  return transaction.maintenanceWorkOrderActivity.create({
    data: { workOrderId: workOrder.id, actorId, action, fromStatus: workOrder.status, toStatus, note: clean(note, 10000) || null, metadata },
  });
}

async function releaseTechnicianIfIdle(technicianProfileId) {
  if (!technicianProfileId) return;
  const active = await prisma.maintenanceWorkOrder.count({
    where: { assignedTechnicianId: technicianProfileId, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'AWAITING_VERIFICATION'] } },
  });
  if (!active) await prisma.technicianProfile.update({ where: { id: technicianProfileId }, data: { availabilityStatus: 'AVAILABLE' } });
}

export async function getMaintenanceWorkOrder(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  response.json({ success: true, data: { workOrder } });
}

export async function submitWorkOrderForApproval(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  const nextStatus = resolveWorkOrderTransition('submit', workOrder.status);
  const updated = await prisma.$transaction(async (transaction) => {
    await activity(transaction, workOrder, request.authUser.id, 'SUBMITTED_FOR_APPROVAL', nextStatus, request.body?.note);
    return transaction.maintenanceWorkOrder.update({ where: { id: workOrder.id }, data: { status: nextStatus }, include: maintenanceExecutionInclude });
  });
  response.json({ success: true, message: `${workOrder.workOrderNumber} submitted for approval.`, data: { workOrder: updated } });
}

export async function approveWorkOrder(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  const nextStatus = resolveWorkOrderTransition('approve', workOrder.status, { hasAssignment: Boolean(workOrder.assignedTechnicianId || workOrder.vendorContractId) });
  const now = new Date();
  const updated = await prisma.$transaction(async (transaction) => {
    await activity(transaction, workOrder, request.authUser.id, 'APPROVED', nextStatus, request.body?.note);
    const result = await transaction.maintenanceWorkOrder.update({ where: { id: workOrder.id }, data: { status: nextStatus, approvedById: request.authUser.id, approvedAt: now, approvalNote: clean(request.body?.note, 10000) || null, ...(nextStatus === 'ASSIGNED' ? { assignedAt: now } : {}) }, include: maintenanceExecutionInclude });
    if (nextStatus === 'ASSIGNED' && workOrder.assignedTechnicianId) await transaction.technicianProfile.update({ where: { id: workOrder.assignedTechnicianId }, data: { availabilityStatus: 'ASSIGNED' } });
    return result;
  });
  response.json({ success: true, message: `${workOrder.workOrderNumber} approved.`, data: { workOrder: updated } });
}

export async function assignWorkOrder(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  const nextStatus = resolveWorkOrderTransition('assign', workOrder.status);
  const assignedTechnicianId = clean(request.body?.assignedTechnicianId, 191) || null;
  const vendorContractId = clean(request.body?.vendorContractId, 191) || null;
  if (!assignedTechnicianId && !vendorContractId) throw httpError(400, 'Select a technician or vendor contract.');
  if (assignedTechnicianId && vendorContractId) throw httpError(400, 'Assign either a technician or a vendor contract, not both.');
  const scope = await maintenanceScope(request.authUser);
  if (assignedTechnicianId) {
    const technician = await prisma.technicianProfile.findFirst({ where: { id: assignedTechnicianId, organizationId: workOrder.organizationId, status: 'ACTIVE', availabilityStatus: { not: 'INACTIVE' }, ...(!scope.national && !userHasRole(request.authUser, 'SUPER_ADMIN') ? { OR: [{ baseAdministrativeUnit: { is: scope.administrativeUnitWhere } }, { baseAdministrativeUnitId: null }] } : {}) } });
    if (!technician) throw httpError(400, 'The selected technician is unavailable or outside your scope.');
  }
  if (vendorContractId) {
    const contract = await prisma.vendorContract.findFirst({ where: { id: vendorContractId, organizationId: workOrder.organizationId, status: 'ACTIVE', startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }], facilities: workOrder.facilityId ? { some: { facilityId: workOrder.facilityId } } : undefined, equipmentTypes: workOrder.equipment?.equipmentType?.id ? { some: { equipmentTypeId: workOrder.equipment.equipmentType.id } } : undefined } });
    if (!contract) throw httpError(400, 'The vendor contract does not cover this facility and equipment type.');
  }
  const previousTechnicianId = workOrder.assignedTechnicianId;
  const now = new Date();
  const updated = await prisma.$transaction(async (transaction) => {
    await activity(transaction, workOrder, request.authUser.id, 'ASSIGNED', nextStatus, request.body?.note, { assignedTechnicianId, vendorContractId });
    const result = await transaction.maintenanceWorkOrder.update({ where: { id: workOrder.id }, data: { status: nextStatus, assignedTechnicianId, vendorContractId, assignedAt: now, plannedStartAt: dateValue(request.body?.plannedStartAt) ?? workOrder.plannedStartAt, plannedEndAt: dateValue(request.body?.plannedEndAt) ?? workOrder.plannedEndAt }, include: maintenanceExecutionInclude });
    if (assignedTechnicianId) await transaction.technicianProfile.update({ where: { id: assignedTechnicianId }, data: { availabilityStatus: 'ASSIGNED' } });
    return result;
  });
  if (previousTechnicianId && previousTechnicianId !== assignedTechnicianId) await releaseTechnicianIfIdle(previousTechnicianId);
  response.json({ success: true, message: `${workOrder.workOrderNumber} assignment updated.`, data: { workOrder: updated } });
}

export async function startWorkOrder(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  await requireAssignedExecutor(workOrder, request.authUser);
  const nextStatus = resolveWorkOrderTransition('start', workOrder.status);
  const now = new Date();
  const updated = await prisma.$transaction(async (transaction) => {
    await activity(transaction, workOrder, request.authUser.id, 'FIELD_WORK_STARTED', nextStatus, request.body?.note);
    await transaction.maintenanceTicket.update({ where: { id: workOrder.ticketId }, data: { status: 'IN_PROGRESS', workStartedAt: now } });
    return transaction.maintenanceWorkOrder.update({ where: { id: workOrder.id }, data: { status: nextStatus, startedAt: now }, include: maintenanceExecutionInclude });
  });
  response.json({ success: true, message: `${workOrder.workOrderNumber} started.`, data: { workOrder: updated } });
}

export async function updateWorkOrderFieldReport(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  await requireAssignedExecutor(workOrder, request.authUser);
  if (!['IN_PROGRESS', 'AWAITING_PARTS'].includes(workOrder.status)) throw httpError(409, 'Start the work order before recording a field report.');
  const data = {
    submittedById: request.authUser.id,
    arrivedAt: dateValue(request.body?.arrivedAt),
    departedAt: dateValue(request.body?.departedAt),
    staffPresentCount: integer(request.body?.staffPresentCount, 0, 0, 10000),
    staffSupportCount: integer(request.body?.staffSupportCount, 0, 0, 10000),
    diagnosis: clean(request.body?.diagnosis, 10000) || null,
    rootCause: clean(request.body?.rootCause, 10000) || null,
    actionTaken: clean(request.body?.actionTaken, 10000) || null,
    observation: clean(request.body?.observation, 10000) || null,
    repairOutcome: clean(request.body?.repairOutcome, 10000) || null,
    equipmentStatusAfterRepair: enumValue(request.body?.equipmentStatusAfterRepair, equipmentStatuses),
    laborMinutes: integer(request.body?.laborMinutes, null, 0, 100000),
  };
  const report = await prisma.$transaction(async (transaction) => {
    const result = await transaction.workOrderFieldReport.upsert({ where: { workOrderId: workOrder.id }, update: data, create: { workOrderId: workOrder.id, ...data }, include: { submittedBy: { select: personSelect } } });
    await activity(transaction, workOrder, request.authUser.id, 'FIELD_REPORT_UPDATED', workOrder.status, request.body?.observation);
    return result;
  });
  response.json({ success: true, message: 'Field report saved.', data: { fieldReport: report } });
}

export async function addWorkOrderPart(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  await requireAssignedExecutor(workOrder, request.authUser);
  if (!['IN_PROGRESS', 'AWAITING_PARTS'].includes(workOrder.status)) throw httpError(409, 'Parts can only be recorded while field work is active.');
  const partName = clean(request.body?.partName, 180);
  const quantity = integer(request.body?.quantity, null, 1, 100000);
  if (!partName || !quantity) throw httpError(400, 'Part name and a valid quantity are required.');
  const unitCost = decimal(request.body?.unitCost);
  const part = await prisma.$transaction(async (transaction) => {
    const result = await transaction.workOrderPartUsage.create({ data: { workOrderId: workOrder.id, partName, partNumber: clean(request.body?.partNumber, 120) || null, quantity, unitCost, totalCost: unitCost === null ? null : unitCost * quantity, source: enumValue(request.body?.source, partSources, 'OTHER'), notes: clean(request.body?.notes, 5000) || null } });
    await activity(transaction, workOrder, request.authUser.id, 'PART_RECORDED', workOrder.status, `${quantity} × ${partName}`);
    return result;
  });
  response.status(201).json({ success: true, message: 'Part usage recorded.', data: { part } });
}

export async function removeWorkOrderPart(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  await requireAssignedExecutor(workOrder, request.authUser);
  const part = await prisma.workOrderPartUsage.findFirst({ where: { id: request.params.partId, workOrderId: workOrder.id } });
  if (!part) throw httpError(404, 'Part record not found.');
  await prisma.$transaction(async (transaction) => {
    await transaction.workOrderPartUsage.delete({ where: { id: part.id } });
    await activity(transaction, workOrder, request.authUser.id, 'PART_REMOVED', workOrder.status, `${part.quantity} × ${part.partName}`);
  });
  response.json({ success: true, message: 'Part record removed.' });
}

export async function addWorkOrderEvidence(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  await requireAssignedExecutor(workOrder, request.authUser);
  if (!['IN_PROGRESS', 'AWAITING_PARTS'].includes(workOrder.status)) throw httpError(409, 'Evidence can only be added while field work is active.');
  const [attachment] = normalizeTicketAttachments([request.body]);
  const evidence = await prisma.$transaction(async (transaction) => {
    const result = await transaction.workOrderEvidence.create({ data: { workOrderId: workOrder.id, uploadedById: request.authUser.id, ...attachment, category: enumValue(request.body?.category, evidenceCategories, 'OTHER'), caption: clean(request.body?.caption, 2000) || null, capturedAt: dateValue(request.body?.capturedAt) ?? new Date(), latitude: request.body?.latitude ?? null, longitude: request.body?.longitude ?? null }, include: { uploadedBy: { select: personSelect } } });
    await activity(transaction, workOrder, request.authUser.id, 'EVIDENCE_ADDED', workOrder.status, result.caption, { category: result.category });
    return result;
  });
  response.status(201).json({ success: true, message: 'Work evidence added.', data: { evidence } });
}

export async function changeFieldWorkState(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  await requireAssignedExecutor(workOrder, request.authUser);
  const action = clean(request.body?.action, 50).toLowerCase();
  if (!['request_parts', 'resume'].includes(action)) throw httpError(400, 'Action must be request_parts or resume.');
  const nextStatus = resolveWorkOrderTransition(action, workOrder.status);
  const updated = await prisma.$transaction(async (transaction) => {
    await activity(transaction, workOrder, request.authUser.id, action.toUpperCase(), nextStatus, request.body?.note);
    await transaction.maintenanceTicket.update({ where: { id: workOrder.ticketId }, data: { status: nextStatus === 'AWAITING_PARTS' ? 'AWAITING_PARTS' : 'IN_PROGRESS' } });
    return transaction.maintenanceWorkOrder.update({ where: { id: workOrder.id }, data: { status: nextStatus }, include: maintenanceExecutionInclude });
  });
  response.json({ success: true, message: `Work order is now ${nextStatus.toLowerCase().replaceAll('_', ' ')}.`, data: { workOrder: updated } });
}

export async function submitWorkOrderCompletion(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  await requireAssignedExecutor(workOrder, request.authUser);
  const nextStatus = resolveWorkOrderTransition('submit_completion', workOrder.status);
  if (!workOrder.fieldReport?.actionTaken || workOrder.fieldReport.actionTaken.trim().length < 10 || !workOrder.fieldReport?.repairOutcome) throw httpError(409, 'Complete the field report, including action taken and repair outcome, before submission.');
  if (!workOrder.evidence.length) throw httpError(409, 'Add at least one field evidence image before submission.');
  const partTotal = workOrder.partsUsed.reduce((sum, part) => sum + Number(part.totalCost ?? 0), 0);
  const actualCost = decimal(request.body?.actualCost) ?? partTotal;
  const now = new Date();
  const updated = await prisma.$transaction(async (transaction) => {
    await activity(transaction, workOrder, request.authUser.id, 'COMPLETION_SUBMITTED', nextStatus, request.body?.note, { actualCost });
    return transaction.maintenanceWorkOrder.update({ where: { id: workOrder.id }, data: { status: nextStatus, actualCost, completionSubmittedAt: now }, include: maintenanceExecutionInclude });
  });
  response.json({ success: true, message: `${workOrder.workOrderNumber} submitted for verification.`, data: { workOrder: updated } });
}

export async function verifyWorkOrderCompletion(request, response) {
  const workOrder = await requireWorkOrder(request.params.workOrderId, request.authUser);
  const approved = request.body?.approved === true;
  const action = approved ? 'verify' : 'return';
  const nextStatus = resolveWorkOrderTransition(action, workOrder.status);
  const note = clean(request.body?.note, 10000);
  if (!approved && note.length < 10) throw httpError(400, 'Explain what the technician must correct before resubmission.');
  const now = new Date();
  const updated = await prisma.$transaction(async (transaction) => {
    await activity(transaction, workOrder, request.authUser.id, approved ? 'COMPLETION_VERIFIED' : 'COMPLETION_RETURNED', nextStatus, note);
    const result = await transaction.maintenanceWorkOrder.update({ where: { id: workOrder.id }, data: { status: nextStatus, verificationNote: note || null, verifiedAt: approved ? now : null, completedAt: approved ? now : null }, include: maintenanceExecutionInclude });
    if (approved) {
      await transaction.maintenanceTicket.update({ where: { id: workOrder.ticketId }, data: { status: 'RESOLVED', resolvedAt: now, actualCost: workOrder.actualCost, resolutionSummary: workOrder.fieldReport?.repairOutcome ?? note } });
      if (workOrder.equipmentId && workOrder.fieldReport?.equipmentStatusAfterRepair) await transaction.equipment.update({ where: { id: workOrder.equipmentId }, data: { functionalityStatus: workOrder.fieldReport.equipmentStatusAfterRepair } });
    } else {
      await transaction.maintenanceTicket.update({ where: { id: workOrder.ticketId }, data: { status: 'IN_PROGRESS' } });
    }
    return result;
  });
  if (approved) await releaseTechnicianIfIdle(workOrder.assignedTechnicianId);
  response.json({ success: true, message: approved ? `${workOrder.workOrderNumber} completed and verified.` : `${workOrder.workOrderNumber} returned for correction.`, data: { workOrder: updated } });
}
