import { prisma } from '../lib/prisma.js';
import {
  maintenanceScope,
  maintenanceTicketWhere,
  maintenanceWorkOrderWhere,
} from '../services/maintenanceAccessService.js';
import { userHasRole } from '../services/userAccessService.js';

const decisions = ['INFORMATION_REQUIRED', 'REMOTE_SUPPORT', 'FIELD_VISIT', 'VENDOR_REFERRAL', 'PARTS_REQUIRED', 'REPLACEMENT_RECOMMENDED', 'NO_ACTION'];
const workOrderStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'AWAITING_VERIFICATION', 'COMPLETED', 'CANCELLED'];
const workerTypes = ['GOVERNMENT', 'VENDOR', 'PARTNER'];
const availabilityStatuses = ['AVAILABLE', 'ASSIGNED', 'ON_LEAVE', 'INACTIVE'];
const contractStatuses = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED'];
const activeTicketStatuses = ['OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR', 'ESCALATED', 'REOPENED'];
const technicianRoleKeys = ['TECHNICIAN', 'VENDOR_TECHNICIAN'];

const personSelect = { id: true, firstName: true, lastName: true, email: true, phone: true };
const ticketInclude = {
  facility: { select: { id: true, name: true, facilityCode: true } },
  administrativeUnit: { select: { id: true, name: true, type: true } },
  equipment: { select: { id: true, assetCode: true, functionalityStatus: true, equipmentType: { select: { id: true, name: true } } } },
  reportedBy: { select: personSelect },
  assignedTo: { select: personSelect },
  triage: { include: { triagedBy: { select: personSelect } } },
  workOrders: { select: { id: true, workOrderNumber: true, status: true } },
  _count: { select: { attachments: true, comments: true, escalations: true } },
};

const workOrderInclude = {
  ticket: { select: { id: true, ticketNumber: true, title: true, severity: true } },
  facility: { select: { id: true, name: true, facilityCode: true } },
  equipment: { select: { id: true, assetCode: true, equipmentType: { select: { id: true, name: true } } } },
  assignedTechnician: { include: { user: { select: personSelect }, skills: { include: { maintenanceSkill: true } } } },
  vendorContract: { include: { vendor: { select: { id: true, name: true } } } },
  createdBy: { select: personSelect },
};

function clean(value, length = 5000) { return String(value ?? '').trim().slice(0, length); }
function enumValue(value, allowed, fallback = null) {
  const normalized = clean(value, 100).toUpperCase();
  return allowed.includes(normalized) ? normalized : fallback;
}
function integer(value, fallback = null, min = 0, max = 1000000) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
function dateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }

async function accessibleTicket(id, user) {
  return prisma.maintenanceTicket.findFirst({ where: { id, ...(await maintenanceTicketWhere(user)) }, include: ticketInclude });
}

async function nextWorkOrderNumber() {
  const year = new Date().getFullYear();
  const sequence = await prisma.workOrderSequence.upsert({
    where: { year },
    update: { currentValue: { increment: 1 } },
    create: { year, currentValue: 1 },
    select: { currentValue: true },
  });
  return `FEPPM-WO-${year}-${String(sequence.currentValue).padStart(6, '0')}`;
}

export async function getMaintenanceDashboard(request, response) {
  const roleKey = ['NATIONAL_MAINTENANCE_MANAGER', 'STATE_MAINTENANCE_MANAGER', 'MAINTENANCE_SCHEDULER', 'TECHNICIAN', 'VENDOR_ADMIN', 'VENDOR_TECHNICIAN']
    .find((key) => userHasRole(request.authUser, key)) ?? 'STATE_MAINTENANCE_MANAGER';
  const scopedTicketWhere = await maintenanceTicketWhere(request.authUser);
  const [requestGroups, workOrderGroups, availableTechnicians, expiringContracts] = await Promise.all([
    prisma.maintenanceTicket.groupBy({
      by: ['status', 'priority'],
      where: { ...scopedTicketWhere, category: { in: ['EQUIPMENT_FAULT', 'MAINTENANCE', 'TEMPERATURE_SAFETY', 'CHECKLIST', 'TECHNICAL_SUPPORT'] } },
      _count: { _all: true },
    }),
    prisma.maintenanceWorkOrder.groupBy({ by: ['status'], where: await maintenanceWorkOrderWhere(request.authUser), _count: { _all: true } }),
    prisma.technicianProfile.count({ where: { organizationId: request.authUser.organization.id, status: 'ACTIVE', availabilityStatus: 'AVAILABLE' } }),
    prisma.vendorContract.count({ where: { organizationId: request.authUser.organization.id, status: 'ACTIVE', endsAt: { lte: new Date(Date.now() + 30 * 86400000), gte: new Date() } } }),
  ]);
  const activeRequests = requestGroups.filter(({ status }) => activeTicketStatuses.includes(status)).reduce((sum, item) => sum + item._count._all, 0);
  const criticalRequests = requestGroups.filter(({ status, priority }) => activeTicketStatuses.includes(status) && priority === 1).reduce((sum, item) => sum + item._count._all, 0);
  const workOrders = Object.fromEntries(workOrderGroups.map((item) => [item.status, item._count._all]));
  response.json({ success: true, data: { roleKey, summary: { activeRequests, criticalRequests, untriagedRequests: await prisma.maintenanceTicket.count({ where: { ...scopedTicketWhere, category: { in: ['EQUIPMENT_FAULT', 'MAINTENANCE', 'TEMPERATURE_SAFETY', 'CHECKLIST', 'TECHNICAL_SUPPORT'] }, status: { in: activeTicketStatuses }, triage: { is: null } } }), activeWorkOrders: workOrderGroups.filter(({ status }) => !['COMPLETED', 'CANCELLED'].includes(status)).reduce((sum, item) => sum + item._count._all, 0), awaitingApproval: workOrders.PENDING_APPROVAL ?? 0, availableTechnicians, expiringContracts }, workOrderStatus: workOrders } });
}

export async function listMaintenanceRequests(request, response) {
  const page = integer(request.query.page, 1, 1, 100000);
  const limit = integer(request.query.limit, 20, 1, 100);
  const search = clean(request.query.search, 160);
  const triageState = clean(request.query.triage, 20).toLowerCase();
  const where = {
    AND: [
      await maintenanceTicketWhere(request.authUser),
      { category: { in: ['EQUIPMENT_FAULT', 'MAINTENANCE', 'TEMPERATURE_SAFETY', 'CHECKLIST', 'TECHNICAL_SUPPORT'] } },
      ...(triageState === 'pending' ? [{ triage: { is: null } }] : triageState === 'completed' ? [{ triage: { isNot: null } }] : []),
      ...(search ? [{ OR: [{ ticketNumber: { contains: search, mode: 'insensitive' } }, { title: { contains: search, mode: 'insensitive' } }, { facility: { is: { name: { contains: search, mode: 'insensitive' } } } }] }] : []),
    ],
  };
  const [requests, total] = await Promise.all([
    prisma.maintenanceTicket.findMany({ where, include: ticketInclude, orderBy: [{ priority: 'asc' }, { reportedAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
    prisma.maintenanceTicket.count({ where }),
  ]);
  response.json({ success: true, data: { requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
}

export async function getMaintenanceRequest(request, response) {
  const ticket = await accessibleTicket(request.params.ticketId, request.authUser);
  if (!ticket) throw httpError(404, 'Maintenance request not found in your authorized scope.');
  response.json({ success: true, data: { request: ticket } });
}

export async function triageMaintenanceRequest(request, response) {
  const ticket = await accessibleTicket(request.params.ticketId, request.authUser);
  if (!ticket) throw httpError(404, 'Maintenance request not found in your authorized scope.');
  const decision = enumValue(request.body?.decision, decisions);
  const assessment = clean(request.body?.assessment, 10000);
  if (!decision) throw httpError(400, 'A valid triage decision is required.');
  if (assessment.length < 10) throw httpError(400, 'The technical assessment must contain at least 10 characters.');
  const data = { decision, assessment, recommendedAction: clean(request.body?.recommendedAction, 10000) || null, safetyRisk: request.body?.safetyRisk === true, vaccineRisk: request.body?.vaccineRisk === true, remoteResolutionPossible: request.body?.remoteResolutionPossible === true, triagedById: request.authUser.id, triagedAt: new Date() };
  const [triage] = await prisma.$transaction([
    prisma.maintenanceTriage.upsert({ where: { ticketId: ticket.id }, update: data, create: { ticketId: ticket.id, ...data }, include: { triagedBy: { select: personSelect } } }),
    prisma.ticketActivity.create({ data: { ticketId: ticket.id, userId: request.authUser.id, action: 'MAINTENANCE_TRIAGED', comment: assessment, metadata: { decision, safetyRisk: data.safetyRisk, vaccineRisk: data.vaccineRisk } } }),
  ]);
  response.json({ success: true, message: `${ticket.ticketNumber} triage saved.`, data: { triage } });
}

export async function createWorkOrderFromRequest(request, response) {
  const ticket = await accessibleTicket(request.params.ticketId, request.authUser);
  if (!ticket) throw httpError(404, 'Maintenance request not found in your authorized scope.');
  if (!ticket.triage) throw httpError(409, 'Complete technical triage before creating a work order.');
  const title = clean(request.body?.title, 160) || ticket.title;
  const description = clean(request.body?.description, 10000) || ticket.triage.recommendedAction || ticket.faultDescription;
  const assignedTechnicianId = clean(request.body?.assignedTechnicianId, 191) || null;
  const vendorContractId = clean(request.body?.vendorContractId, 191) || null;
  if (assignedTechnicianId && vendorContractId) throw httpError(400, 'Assign either an internal technician or a vendor contract, not both.');
  if (assignedTechnicianId) {
    const scope = await maintenanceScope(request.authUser);
    const technician = await prisma.technicianProfile.findFirst({
      where: {
        id: assignedTechnicianId,
        organizationId: ticket.organizationId,
        status: 'ACTIVE',
        ...(!scope.national && !userHasRole(request.authUser, 'SUPER_ADMIN')
          ? { OR: [{ baseAdministrativeUnit: { is: scope.administrativeUnitWhere } }, { baseAdministrativeUnitId: null }] }
          : {}),
      },
    });
    if (!technician) throw httpError(400, 'The selected technician is not active in this organization.');
  }
  if (vendorContractId) {
    const contract = await prisma.vendorContract.findFirst({ where: { id: vendorContractId, organizationId: ticket.organizationId, status: 'ACTIVE', startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }], facilities: ticket.facilityId ? { some: { facilityId: ticket.facilityId } } : undefined, equipmentTypes: ticket.equipment?.equipmentType?.id ? { some: { equipmentTypeId: ticket.equipment.equipmentType.id } } : undefined } });
    if (!contract) throw httpError(400, 'The selected vendor contract does not cover this request.');
  }
  const status = assignedTechnicianId || vendorContractId ? 'ASSIGNED' : 'DRAFT';
  const workOrderNumber = await nextWorkOrderNumber();
  const [workOrder] = await prisma.$transaction([
    prisma.maintenanceWorkOrder.create({ data: { workOrderNumber, ticketId: ticket.id, triageId: ticket.triage.id, organizationId: ticket.organizationId, administrativeUnitId: ticket.administrativeUnitId, facilityId: ticket.facilityId, equipmentId: ticket.equipmentId, assignedTechnicianId, vendorContractId, createdById: request.authUser.id, title, description, priority: ticket.priority, status, plannedStartAt: dateValue(request.body?.plannedStartAt), plannedEndAt: dateValue(request.body?.plannedEndAt), estimatedCost: request.body?.estimatedCost || null }, include: workOrderInclude }),
    prisma.ticketActivity.create({ data: { ticketId: ticket.id, userId: request.authUser.id, action: 'WORK_ORDER_CREATED', comment: `${workOrderNumber} created from maintenance triage.`, metadata: { workOrderNumber, assignedTechnicianId, vendorContractId } } }),
  ]);
  response.status(201).json({ success: true, message: `${workOrderNumber} created.`, data: { workOrder } });
}

export async function listMaintenanceWorkOrders(request, response) {
  const status = enumValue(request.query.status, workOrderStatuses);
  const where = { AND: [await maintenanceWorkOrderWhere(request.authUser), ...(status ? [{ status }] : [])] };
  const workOrders = await prisma.maintenanceWorkOrder.findMany({ where, include: workOrderInclude, orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }], take: 200 });
  response.json({ success: true, data: { workOrders } });
}

export async function listMaintenanceSkills(_request, response) {
  const skills = await prisma.maintenanceSkill.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } });
  response.json({ success: true, data: { skills } });
}

export async function listTechnicians(request, response) {
  const scope = await maintenanceScope(request.authUser);
  const technicians = await prisma.technicianProfile.findMany({ where: { organizationId: request.authUser.organization.id, ...(scope.vendorId ? { vendorId: scope.vendorId } : {}), ...(!scope.national && !scope.vendorId && Object.keys(scope.administrativeUnitWhere).length ? { OR: [{ baseAdministrativeUnit: { is: scope.administrativeUnitWhere } }, { baseAdministrativeUnitId: null }] } : {}) }, include: { user: { select: personSelect }, baseAdministrativeUnit: { select: { id: true, name: true, type: true } }, vendor: { select: { id: true, name: true } }, skills: { include: { maintenanceSkill: true } } }, orderBy: { user: { firstName: 'asc' } } });
  response.json({ success: true, data: { technicians } });
}

export async function upsertTechnician(request, response) {
  const userId = clean(request.body?.userId, 191);
  if (!userId) throw httpError(400, 'A FEPPM user account is required.');
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: request.authUser.organization.id,
      status: 'ACTIVE',
      roles: { some: { role: { key: { in: technicianRoleKeys } } } },
    },
  });
  if (!user) throw httpError(400, 'Select an active account with a Technician or Vendor Technician role.');
  const workerType = enumValue(request.body?.workerType, workerTypes, 'GOVERNMENT');
  const availabilityStatus = enumValue(request.body?.availabilityStatus, availabilityStatuses, 'AVAILABLE');
  const skillIds = [...new Set((Array.isArray(request.body?.skillIds) ? request.body.skillIds : []).map((id) => clean(id, 191)).filter(Boolean))];
  const scope = await maintenanceScope(request.authUser);
  const baseAdministrativeUnitId = clean(request.body?.baseAdministrativeUnitId, 191) || null;
  const vendorId = workerType === 'VENDOR' ? clean(request.body?.vendorId, 191) || null : null;
  if (baseAdministrativeUnitId) {
    const unit = await prisma.administrativeUnit.findFirst({ where: { id: baseAdministrativeUnitId, ...scope.administrativeUnitWhere, status: 'ACTIVE' }, select: { id: true } });
    if (!unit) throw httpError(403, 'The technician base is outside your authorized scope.');
  }
  if (vendorId) {
    const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, status: 'ACTIVE' }, select: { id: true } });
    if (!vendor) throw httpError(400, 'The selected vendor is not active.');
  }
  if (skillIds.length) {
    const skillCount = await prisma.maintenanceSkill.count({ where: { id: { in: skillIds }, status: 'ACTIVE' } });
    if (skillCount !== skillIds.length) throw httpError(400, 'One or more selected maintenance skills are invalid.');
  }
  const data = { organizationId: user.organizationId, baseAdministrativeUnitId, vendorId, workerType, jobTitle: clean(request.body?.jobTitle, 160) || null, yearsExperience: integer(request.body?.yearsExperience, null, 0, 80), cvUrl: clean(request.body?.cvUrl, 1000) || null, availabilityStatus, status: 'ACTIVE' };
  const technician = await prisma.$transaction(async (transaction) => {
    const profile = await transaction.technicianProfile.upsert({ where: { userId }, update: data, create: { userId, ...data } });
    await transaction.technicianSkill.deleteMany({ where: { technicianProfileId: profile.id } });
    if (skillIds.length) await transaction.technicianSkill.createMany({ data: skillIds.map((maintenanceSkillId) => ({ technicianProfileId: profile.id, maintenanceSkillId })) });
    return transaction.technicianProfile.findUnique({ where: { id: profile.id }, include: { user: { select: personSelect }, baseAdministrativeUnit: true, vendor: true, skills: { include: { maintenanceSkill: true } } } });
  });
  response.status(201).json({ success: true, message: 'Technician profile saved.', data: { technician } });
}

export async function listVendorContracts(request, response) {
  const scope = await maintenanceScope(request.authUser);
  const contracts = await prisma.vendorContract.findMany({ where: { organizationId: request.authUser.organization.id, ...(scope.vendorId ? { vendorId: scope.vendorId } : {}) }, include: { vendor: true, facilities: { include: { facility: { select: { id: true, name: true } } } }, equipmentTypes: { include: { equipmentType: { select: { id: true, name: true } } } }, _count: { select: { workOrders: true } } }, orderBy: { startsAt: 'desc' } });
  response.json({ success: true, data: { contracts } });
}

export async function createMaintenanceVendor(request, response) {
  const name = clean(request.body?.name, 180);
  if (!name) throw httpError(400, 'Vendor name is required.');
  const existing = await prisma.vendor.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  if (existing) throw httpError(409, 'A vendor with this name already exists.');
  const vendor = await prisma.vendor.create({
    data: {
      name,
      email: clean(request.body?.email, 191) || null,
      phone: clean(request.body?.phone, 60) || null,
      address: clean(request.body?.address, 1000) || null,
      status: 'ACTIVE',
    },
  });
  response.status(201).json({ success: true, message: 'Vendor created.', data: { vendor } });
}

export async function createVendorContract(request, response) {
  const vendorId = clean(request.body?.vendorId, 191);
  const contractNumber = clean(request.body?.contractNumber, 100);
  const name = clean(request.body?.name, 180);
  const startsAt = dateValue(request.body?.startsAt);
  if (!vendorId || !contractNumber || !name || !startsAt) throw httpError(400, 'Vendor, contract number, name, and start date are required.');
  const facilityIds = [...new Set((request.body?.facilityIds ?? []).map((id) => clean(id, 191)).filter(Boolean))];
  const equipmentTypeIds = [...new Set((request.body?.equipmentTypeIds ?? []).map((id) => clean(id, 191)).filter(Boolean))];
  if (!facilityIds.length || !equipmentTypeIds.length) throw httpError(400, 'Contract coverage requires at least one facility and equipment type.');
  const scope = await maintenanceScope(request.authUser);
  const [vendor, facilityCount, equipmentTypeCount] = await Promise.all([
    prisma.vendor.findFirst({ where: { id: vendorId, status: 'ACTIVE' }, select: { id: true } }),
    prisma.facility.count({ where: { id: { in: facilityIds }, ...scope.facilityWhere, status: 'ACTIVE' } }),
    prisma.equipmentType.count({ where: { id: { in: equipmentTypeIds } } }),
  ]);
  if (!vendor) throw httpError(400, 'The selected vendor is not active.');
  if (facilityCount !== facilityIds.length) throw httpError(403, 'One or more facilities are outside your authorized scope.');
  if (equipmentTypeCount !== equipmentTypeIds.length) throw httpError(400, 'One or more equipment types are invalid.');
  const contract = await prisma.vendorContract.create({ data: { organizationId: request.authUser.organization.id, vendorId, contractNumber, name, serviceDescription: clean(request.body?.serviceDescription, 10000) || null, startsAt, endsAt: dateValue(request.body?.endsAt), responseTargetHours: integer(request.body?.responseTargetHours, null, 1, 8760), spendingLimit: request.body?.spendingLimit || null, status: enumValue(request.body?.status, contractStatuses, 'DRAFT'), createdById: request.authUser.id, facilities: { create: facilityIds.map((facilityId) => ({ facilityId })) }, equipmentTypes: { create: equipmentTypeIds.map((equipmentTypeId) => ({ equipmentTypeId })) } }, include: { vendor: true, facilities: { include: { facility: true } }, equipmentTypes: { include: { equipmentType: true } } } });
  response.status(201).json({ success: true, message: 'Vendor contract created.', data: { contract } });
}

export async function updateVendorContract(request, response) {
  const scope = await maintenanceScope(request.authUser);
  const existing = await prisma.vendorContract.findFirst({
    where: { id: request.params.id, organizationId: request.authUser.organization.id },
  });
  if (!existing) throw httpError(404, 'Vendor contract not found.');
  const facilityIds = [...new Set((request.body?.facilityIds ?? []).map((id) => clean(id, 191)).filter(Boolean))];
  const equipmentTypeIds = [...new Set((request.body?.equipmentTypeIds ?? []).map((id) => clean(id, 191)).filter(Boolean))];
  if (!facilityIds.length || !equipmentTypeIds.length) throw httpError(400, 'Contract coverage requires at least one facility and equipment type.');
  const [facilityCount, equipmentTypeCount] = await Promise.all([
    prisma.facility.count({ where: { id: { in: facilityIds }, ...scope.facilityWhere, status: 'ACTIVE' } }),
    prisma.equipmentType.count({ where: { id: { in: equipmentTypeIds } } }),
  ]);
  if (facilityCount !== facilityIds.length) throw httpError(403, 'One or more facilities are outside your authorized scope.');
  if (equipmentTypeCount !== equipmentTypeIds.length) throw httpError(400, 'One or more equipment types are invalid.');
  const contract = await prisma.$transaction(async (transaction) => {
    await transaction.vendorContractFacility.deleteMany({ where: { vendorContractId: existing.id } });
    await transaction.vendorContractEquipmentType.deleteMany({ where: { vendorContractId: existing.id } });
    return transaction.vendorContract.update({
      where: { id: existing.id },
      data: {
        name: clean(request.body?.name, 180) || existing.name,
        serviceDescription: clean(request.body?.serviceDescription, 10000) || null,
        startsAt: dateValue(request.body?.startsAt) ?? existing.startsAt,
        endsAt: dateValue(request.body?.endsAt),
        responseTargetHours: integer(request.body?.responseTargetHours, null, 1, 8760),
        spendingLimit: request.body?.spendingLimit || null,
        status: enumValue(request.body?.status, contractStatuses, existing.status),
        facilities: { create: facilityIds.map((facilityId) => ({ facilityId })) },
        equipmentTypes: { create: equipmentTypeIds.map((equipmentTypeId) => ({ equipmentTypeId })) },
      },
      include: { vendor: true, facilities: { include: { facility: true } }, equipmentTypes: { include: { equipmentType: true } } },
    });
  });
  response.json({ success: true, message: 'Vendor contract updated.', data: { contract } });
}

export async function getMaintenanceOptions(request, response) {
  const scope = await maintenanceScope(request.authUser);
  const [users, units, facilities, vendors, equipmentTypes, skills] = await Promise.all([
    prisma.user.findMany({ where: { organizationId: request.authUser.organization.id, status: 'ACTIVE', roles: { some: { role: { key: { in: technicianRoleKeys } } } } }, select: { ...personSelect, roles: { select: { role: { select: { key: true, name: true } } } } }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
    prisma.administrativeUnit.findMany({ where: scope.administrativeUnitWhere, select: { id: true, name: true, type: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    prisma.facility.findMany({ where: scope.facilityWhere, select: { id: true, name: true, administrativeUnitId: true }, orderBy: { name: 'asc' } }),
    prisma.vendor.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.equipmentType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.maintenanceSkill.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
  ]);
  response.json({ success: true, data: { users, units, facilities, vendors, equipmentTypes, skills } });
}
