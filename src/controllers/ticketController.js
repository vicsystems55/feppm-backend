import { prisma } from '../lib/prisma.js';
import { resolveFacilityAccess } from '../services/facilityAccessService.js';
import { notifyTicketCreated, notifyTicketEscalated } from '../services/ticketEmailService.js';
import { normalizeTicketAttachments } from '../services/ticketAttachmentService.js';
import {
  notifyTicketAssignedInApp,
  notifyTicketCommentAddedInApp,
  notifyTicketCreatedInApp,
  notifyTicketEscalatedInApp,
  notifyTicketStatusChangedInApp,
} from '../services/ticketNotificationService.js';
import { findUserForAuthentication, userHasRole } from '../services/userAccessService.js';
import {
  calculateSlaTargets,
  calculateTicketPriority,
  canTransitionTicket,
  deriveTicketSeverity,
  nextEscalationLevel,
  normalizeRiskLevel,
  statusTimestampChanges,
  ticketEscalationLevels,
  ticketStatuses,
} from '../services/ticketPolicyService.js';

const ticketTypes = ['INCIDENT', 'SERVICE_REQUEST', 'COMPLAINT', 'SUGGESTION', 'TECHNICAL_SUPPORT'];
const ticketCategories = [
  'EQUIPMENT_FAULT',
  'MAINTENANCE',
  'TEMPERATURE_SAFETY',
  'CHECKLIST',
  'INVENTORY',
  'ACCESS_ACCOUNT',
  'DATA_QUALITY',
  'COMPLAINT',
  'SUGGESTION',
  'TECHNICAL_SUPPORT',
  'OTHER',
];
const sourceTypes = [
  'FAILED_CHECKLIST',
  'ABNORMAL_READING',
  'USER_REPORT',
  'SUPERVISOR_OBSERVATION',
  'SCHEDULED_INSPECTION',
  'SYSTEM_ALERT',
];

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
};

const ticketListInclude = {
  facility: { select: { id: true, name: true, facilityCode: true } },
  administrativeUnit: { select: { id: true, name: true, type: true } },
  equipment: {
    select: {
      id: true,
      assetCode: true,
      equipmentType: { select: { id: true, name: true } },
    },
  },
  reportedBy: { select: personSelect },
  assignedTo: { select: personSelect },
  _count: { select: { comments: true, attachments: true, escalations: true } },
};

const ticketDetailsInclude = {
  ...ticketListInclude,
  organization: { select: { id: true, name: true, code: true } },
  maintenanceTask: { select: { id: true, scheduledAt: true, dueAt: true, status: true } },
  activities: {
    include: { user: { select: personSelect } },
    orderBy: { createdAt: 'desc' },
  },
  comments: {
    where: { deletedAt: null },
    include: {
      author: { select: personSelect },
      attachments: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  assignments: {
    include: {
      assignedTo: { select: personSelect },
      assignedBy: { select: personSelect },
    },
    orderBy: { startedAt: 'desc' },
  },
  escalations: {
    include: { escalatedBy: { select: personSelect } },
    orderBy: { createdAt: 'desc' },
  },
  attachments: {
    where: { commentId: null },
    orderBy: { createdAt: 'desc' },
  },
};

function clean(value, maxLength = 5000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function enumValue(value, allowed, fallback = null) {
  const normalized = clean(value, 100).toUpperCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function paginationValue(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function hasPermission(request, key) {
  return request.auth?.permissions?.includes(key);
}

function isSuperAdmin(user) {
  return userHasRole(user, 'SUPER_ADMIN');
}

function isFacilityManager(user) {
  return userHasRole(user, 'FACILITY_MANAGER');
}

function initialEscalationLevel(user) {
  if (userHasRole(user, 'SUPER_ADMIN')) return 'PLATFORM';
  if (userHasRole(user, 'NATIONAL_ADMIN')) return 'NATIONAL';
  if (userHasRole(user, 'ZONAL_ADMIN')) return 'ZONE';
  if (userHasRole(user, 'STATE_ADMIN')) return 'STATE';
  if (userHasRole(user, 'LGA_ADMIN')) return 'LGA';
  return 'FACILITY';
}

async function ticketScopeWhere(user) {
  if (isSuperAdmin(user)) return {};

  const organizationId = user.organization.id;
  if (isFacilityManager(user)) {
    return {
      organizationId,
      OR: [
        { facilityId: user.facility?.id ?? '__none__' },
        { reportedById: user.id },
        { assignedToId: user.id },
      ],
    };
  }

  if (userHasRole(user, 'NATIONAL_ADMIN')) return { organizationId };

  const access = await resolveFacilityAccess(user);
  return {
    organizationId,
    OR: [
      { facility: { is: access.facilityWhere } },
      { administrativeUnit: { is: access.administrativeUnitWhere } },
      { reportedById: user.id },
      { assignedToId: user.id },
    ],
  };
}

async function accessibleTicket(ticketId, user, include = ticketDetailsInclude) {
  const effectiveInclude = include === ticketDetailsInclude && isFacilityManager(user)
    ? {
      ...ticketDetailsInclude,
      comments: {
        ...ticketDetailsInclude.comments,
        where: { deletedAt: null, isInternal: false },
      },
      activities: {
        ...ticketDetailsInclude.activities,
        where: { action: { not: 'INTERNAL_NOTE_ADDED' } },
      },
    }
    : include;
  return prisma.maintenanceTicket.findFirst({
    where: { id: ticketId, ...(await ticketScopeWhere(user)) },
    include: effectiveInclude,
  });
}

async function nextTicketNumber() {
  const year = new Date().getFullYear();
  const sequence = await prisma.ticketSequence.upsert({
    where: { year },
    update: { currentValue: { increment: 1 } },
    create: { year, currentValue: 1 },
    select: { currentValue: true },
  });
  return `FEPPM-${year}-${String(sequence.currentValue).padStart(6, '0')}`;
}

async function validateCreateScope(request) {
  const user = request.authUser;
  const superAdmin = isSuperAdmin(user);
  const organizationId = superAdmin
    ? clean(request.body?.organizationId, 191) || user.organization.id
    : user.organization.id;

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!organization) throw httpError(400, 'A valid active organization is required.');

  const access = await resolveFacilityAccess(user);
  const requestedFacilityId = clean(request.body?.facilityId, 191) || null;
  const facilityId = isFacilityManager(user) ? user.facility?.id ?? null : requestedFacilityId;
  let facility = null;

  if (isFacilityManager(user) && !facilityId) {
    throw httpError(400, 'Your account must be assigned to a facility before reporting an issue.');
  }

  if (facilityId) {
    facility = await prisma.facility.findFirst({
      where: {
        id: facilityId,
        organizationId,
        status: 'ACTIVE',
        ...(superAdmin ? {} : access.facilityWhere),
      },
      select: { id: true, organizationId: true, administrativeUnitId: true },
    });
    if (!facility) throw httpError(403, 'The selected facility is outside your authorized scope.');
  }

  let administrativeUnitId = facility?.administrativeUnitId
    ?? (clean(request.body?.administrativeUnitId, 191)
      || (!superAdmin && !userHasRole(user, 'NATIONAL_ADMIN')
        ? user.scopes?.[0]?.administrativeUnit?.id
        : null)
      || null);
  if (administrativeUnitId) {
    const unit = await prisma.administrativeUnit.findFirst({
      where: {
        id: administrativeUnitId,
        organizationId,
        status: 'ACTIVE',
        ...(superAdmin ? {} : access.administrativeUnitWhere),
      },
      select: { id: true },
    });
    if (!unit) throw httpError(403, 'The selected administrative unit is outside your authorized scope.');
    administrativeUnitId = unit.id;
  }

  return { organizationId, facility, administrativeUnitId };
}

async function validateRelatedRecords({ equipmentId, maintenanceTaskId, facility }) {
  let equipment = null;
  let maintenanceTask = null;

  if (equipmentId) {
    if (!facility) throw httpError(400, 'A facility is required when equipment is selected.');
    equipment = await prisma.equipment.findFirst({
      where: { id: equipmentId, facilityId: facility.id, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!equipment) throw httpError(400, 'The selected equipment does not belong to the selected facility.');
  }

  if (maintenanceTaskId) {
    if (!facility) throw httpError(400, 'A facility is required when a maintenance task is selected.');
    maintenanceTask = await prisma.maintenanceTask.findFirst({
      where: { id: maintenanceTaskId, facilityId: facility.id },
      select: { id: true, equipmentId: true },
    });
    if (!maintenanceTask) throw httpError(400, 'The maintenance task does not belong to the selected facility.');
    if (equipment && maintenanceTask.equipmentId !== equipment.id) {
      throw httpError(400, 'The maintenance task and equipment do not match.');
    }
  }

  return { equipment, maintenanceTask };
}

export async function createTicket(request, response) {
  const title = clean(request.body?.title, 160);
  const description = clean(request.body?.description ?? request.body?.faultDescription, 10000);
  if (title.length < 5) throw httpError(400, 'Ticket title must contain at least 5 characters.');
  if (description.length < 10) throw httpError(400, 'Ticket description must contain at least 10 characters.');

  const type = enumValue(request.body?.type, ticketTypes, 'INCIDENT');
  const category = enumValue(request.body?.category, ticketCategories, 'OTHER');
  const sourceType = enumValue(request.body?.sourceType, sourceTypes, 'USER_REPORT');
  const impact = normalizeRiskLevel(request.body?.impact);
  const urgency = normalizeRiskLevel(request.body?.urgency);
  const priority = calculateTicketPriority(impact, urgency);
  const severity = deriveTicketSeverity(impact, urgency);
  const { organizationId, facility, administrativeUnitId } = await validateCreateScope(request);
  const equipmentId = clean(request.body?.equipmentId, 191) || null;
  const maintenanceTaskId = clean(request.body?.maintenanceTaskId, 191) || null;
  const { equipment, maintenanceTask } = await validateRelatedRecords({
    equipmentId,
    maintenanceTaskId,
    facility,
  });
  const now = new Date();
  const sla = calculateSlaTargets(priority, now);
  const ticketNumber = await nextTicketNumber();
  const attachments = normalizeTicketAttachments(request.body?.attachments);

  const ticket = await prisma.maintenanceTicket.create({
    data: {
      ticketNumber,
      organizationId,
      administrativeUnitId,
      facilityId: facility?.id ?? null,
      equipmentId: equipment?.id ?? maintenanceTask?.equipmentId ?? null,
      maintenanceTaskId: maintenanceTask?.id ?? null,
      reportedById: request.authUser.id,
      type,
      category,
      sourceType,
      sourceId: clean(request.body?.sourceId, 191) || null,
      title,
      faultDescription: description,
      impact,
      urgency,
      severity,
      priority,
      escalationLevel: initialEscalationLevel(request.authUser),
      reportedAt: now,
      ...sla,
      activities: {
        create: {
          userId: request.authUser.id,
          action: 'TICKET_CREATED',
          newStatus: 'OPEN',
          comment: 'Ticket created.',
          metadata: { priority, impact, urgency, type, category },
        },
      },
      ...(attachments.length
        ? {
          attachments: {
            create: attachments.map((attachment) => ({
              ...attachment,
              uploadedBy: { connect: { id: request.authUser.id } },
            })),
          },
        }
        : {}),
    },
    include: ticketDetailsInclude,
  });
  await notifyTicketCreatedInApp(ticket.id, request.authUser.id);
  void notifyTicketCreated(ticket.id, request.authUser.id);

  return response.status(201).json({
    success: true,
    message: `Ticket ${ticket.ticketNumber} created.`,
    data: { ticket },
  });
}

export async function listTickets(request, response) {
  const page = paginationValue(request.query.page, 1, 100000);
  const limit = paginationValue(request.query.limit, 20, 100);
  const search = clean(request.query.search, 160);
  const status = enumValue(request.query.status, ticketStatuses);
  const type = enumValue(request.query.type, ticketTypes);
  const category = enumValue(request.query.category, ticketCategories);
  const priority = Number.parseInt(request.query.priority, 10);
  const scopeWhere = await ticketScopeWhere(request.authUser);
  const filters = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(category ? { category } : {}),
    ...(priority >= 1 && priority <= 4 ? { priority } : {}),
    ...(clean(request.query.facilityId, 191) ? { facilityId: clean(request.query.facilityId, 191) } : {}),
  };
  const where = {
    AND: [
      scopeWhere,
      filters,
      ...(search
        ? [{
        OR: [
          { ticketNumber: { contains: search } },
          { title: { contains: search } },
          { faultDescription: { contains: search } },
        ],
      }]
        : []),
    ],
  };

  const [tickets, total, summaryGroups] = await Promise.all([
    prisma.maintenanceTicket.findMany({
      where,
      include: ticketListInclude,
      orderBy: [{ priority: 'asc' }, { reportedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.maintenanceTicket.count({ where }),
    prisma.maintenanceTicket.groupBy({
      by: ['status', 'priority'],
      where: scopeWhere,
      _count: { _all: true },
    }),
  ]);
  const summary = summaryGroups.reduce((result, item) => {
    const count = item._count._all;
    result.total += count;
    if (!['RESOLVED', 'VERIFIED', 'CLOSED', 'CANCELLED', 'DUPLICATE'].includes(item.status)) {
      result.active += count;
      if (item.priority === 1) result.critical += count;
    }
    if (['RESOLVED', 'VERIFIED', 'CLOSED'].includes(item.status)) result.resolved += count;
    if (item.status === 'ESCALATED') result.escalated += count;
    return result;
  }, { total: 0, active: 0, critical: 0, resolved: 0, escalated: 0 });

  return response.json({
    success: true,
    data: {
      tickets,
      summary,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

export async function getTicketOptions(request, response) {
  const requestedOrganizationId = clean(request.query.organizationId, 191);
  const organizationId = isSuperAdmin(request.authUser) && requestedOrganizationId
    ? requestedOrganizationId
    : request.authUser.organization.id;
  const access = await resolveFacilityAccess(request.authUser);

  const [organizations, facilities, administrativeUnits, assignees] = await Promise.all([
    isSuperAdmin(request.authUser)
      ? prisma.organization.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      })
      : Promise.resolve([request.authUser.organization]),
    prisma.facility.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(isSuperAdmin(request.authUser) ? {} : access.facilityWhere),
      },
      select: {
        id: true,
        name: true,
        facilityCode: true,
        administrativeUnitId: true,
        equipment: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            assetCode: true,
            equipmentType: { select: { name: true } },
          },
          orderBy: { assetCode: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.administrativeUnit.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(isSuperAdmin(request.authUser) ? {} : access.administrativeUnitWhere),
      },
      select: { id: true, name: true, type: true, parentId: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    hasPermission(request, 'tickets.assign')
      ? prisma.user.findMany({
        where: {
          organizationId,
          status: 'ACTIVE',
          roles: { some: {} },
        },
        select: {
          ...personSelect,
          facilityId: true,
          roles: { select: { role: { select: { key: true, name: true } } } },
          scopes: {
            select: {
              administrativeUnit: { select: { id: true, name: true, type: true } },
            },
          },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      })
      : Promise.resolve([]),
  ]);

  return response.json({
    success: true,
    data: { organizations, facilities, administrativeUnits, assignees },
  });
}

export async function getTicket(request, response) {
  const ticket = await accessibleTicket(request.params.id, request.authUser);
  if (!ticket) throw httpError(404, 'Ticket not found in your authorized scope.');
  return response.json({ success: true, data: { ticket } });
}

export async function updateTicketStatus(request, response) {
  const ticket = await accessibleTicket(request.params.id, request.authUser, undefined);
  if (!ticket) throw httpError(404, 'Ticket not found in your authorized scope.');

  const status = enumValue(request.body?.status, ticketStatuses);
  if (!status) throw httpError(400, 'A valid ticket status is required.');
  if (!canTransitionTicket(ticket.status, status)) {
    throw httpError(409, `Ticket cannot move from ${ticket.status} to ${status}.`);
  }
  if (['RESOLVED', 'VERIFIED', 'CLOSED'].includes(status) && !hasPermission(request, 'tickets.resolve')) {
    throw httpError(403, 'You do not have permission to resolve or close tickets.');
  }

  const comment = clean(request.body?.comment, 2000);
  const resolutionSummary = clean(request.body?.resolutionSummary, 10000);
  if (status === 'RESOLVED' && resolutionSummary.length < 10) {
    throw httpError(400, 'A resolution summary of at least 10 characters is required.');
  }

  const now = new Date();
  const timestampData = statusTimestampChanges(status, now);
  if (ticket.slaPausedAt && !['WAITING_ON_REPORTER', 'AWAITING_PARTS', 'WAITING_ON_VENDOR'].includes(status)) {
    timestampData.totalPausedMinutes = ticket.totalPausedMinutes
      + Math.max(0, Math.round((now.getTime() - ticket.slaPausedAt.getTime()) / 60000));
  }

  await prisma.$transaction([
    prisma.maintenanceTicket.update({
      where: { id: ticket.id },
      data: {
        status,
        ...timestampData,
        ...(status === 'RESOLVED' ? { resolutionSummary } : {}),
      },
    }),
    prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        userId: request.authUser.id,
        action: 'STATUS_CHANGED',
        comment: comment || null,
        oldStatus: ticket.status,
        newStatus: status,
      },
    }),
  ]);
  await notifyTicketStatusChangedInApp(ticket.id, request.authUser.id, {
    oldStatus: ticket.status,
    newStatus: status,
  });

  const updated = await accessibleTicket(ticket.id, request.authUser);
  return response.json({
    success: true,
    message: `${ticket.ticketNumber} moved to ${status}.`,
    data: { ticket: updated },
  });
}

export async function assignTicket(request, response) {
  const ticket = await accessibleTicket(request.params.id, request.authUser, undefined);
  if (!ticket) throw httpError(404, 'Ticket not found in your authorized scope.');
  if (['RESOLVED', 'VERIFIED', 'CLOSED', 'CANCELLED', 'DUPLICATE'].includes(ticket.status)) {
    throw httpError(409, 'This ticket cannot be assigned in its current status.');
  }

  const assignedToId = clean(request.body?.assignedToId, 191);
  if (!assignedToId) throw httpError(400, 'An assignee is required.');
  const assignee = await findUserForAuthentication(assignedToId);
  if (!assignee || assignee.status !== 'ACTIVE') throw httpError(400, 'The selected assignee is not active.');

  const assigneeCanAccess = await prisma.maintenanceTicket.count({
    where: { id: ticket.id, ...(await ticketScopeWhere(assignee)) },
  });
  if (!assigneeCanAccess) {
    throw httpError(400, 'The selected assignee does not have access to this ticket scope.');
  }

  const now = new Date();
  const nextStatus = ['OPEN', 'ACKNOWLEDGED', 'REOPENED', 'ESCALATED'].includes(ticket.status)
    ? 'ASSIGNED'
    : ticket.status;
  await prisma.$transaction([
    prisma.ticketAssignment.updateMany({
      where: { ticketId: ticket.id, endedAt: null },
      data: { endedAt: now },
    }),
    prisma.ticketAssignment.create({
      data: {
        ticketId: ticket.id,
        assignedToId,
        assignedById: request.authUser.id,
        reason: clean(request.body?.reason, 500) || null,
        startedAt: now,
      },
    }),
    prisma.maintenanceTicket.update({
      where: { id: ticket.id },
      data: {
        assignedToId,
        status: nextStatus,
        acknowledgedAt: ticket.acknowledgedAt ?? now,
        firstResponseAt: ticket.firstResponseAt ?? now,
      },
    }),
    prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        userId: request.authUser.id,
        action: 'TICKET_ASSIGNED',
        comment: clean(request.body?.reason, 500) || null,
        oldStatus: ticket.status,
        newStatus: nextStatus,
        metadata: { assignedToId },
      },
    }),
  ]);
  await notifyTicketAssignedInApp(ticket.id, request.authUser.id, {
    assigneeName: `${assignee.firstName} ${assignee.lastName}`.trim(),
  });

  const updated = await accessibleTicket(ticket.id, request.authUser);
  return response.json({
    success: true,
    message: `${ticket.ticketNumber} assigned successfully.`,
    data: { ticket: updated },
  });
}

export async function escalateTicket(request, response) {
  const ticket = await accessibleTicket(request.params.id, request.authUser, undefined);
  if (!ticket) throw httpError(404, 'Ticket not found in your authorized scope.');
  if (['RESOLVED', 'VERIFIED', 'CLOSED', 'CANCELLED', 'DUPLICATE'].includes(ticket.status)) {
    throw httpError(409, 'This ticket cannot be escalated in its current status.');
  }

  const expectedLevel = nextEscalationLevel(ticket.escalationLevel);
  const toLevel = enumValue(request.body?.toLevel, ticketEscalationLevels, expectedLevel);
  if (!expectedLevel) throw httpError(409, 'This ticket is already at the highest escalation level.');
  if (toLevel !== expectedLevel) {
    throw httpError(400, `The next valid escalation level is ${expectedLevel}.`);
  }
  const reason = clean(request.body?.reason, 5000);
  if (reason.length < 10) throw httpError(400, 'An escalation reason of at least 10 characters is required.');

  const [escalation] = await prisma.$transaction([
    prisma.ticketEscalation.create({
      data: {
        ticketId: ticket.id,
        fromLevel: ticket.escalationLevel,
        toLevel,
        reason,
        automatic: false,
        escalatedById: request.authUser.id,
      },
    }),
    prisma.maintenanceTicket.update({
      where: { id: ticket.id },
      data: { escalationLevel: toLevel, status: 'ESCALATED' },
    }),
    prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        userId: request.authUser.id,
        action: 'TICKET_ESCALATED',
        comment: reason,
        oldStatus: ticket.status,
        newStatus: 'ESCALATED',
        metadata: { fromLevel: ticket.escalationLevel, toLevel },
      },
    }),
  ]);
  await notifyTicketEscalatedInApp(ticket.id, request.authUser.id, {
    fromLevel: ticket.escalationLevel,
    toLevel,
  });
  void notifyTicketEscalated(ticket.id, request.authUser.id, escalation.id);

  const updated = await accessibleTicket(ticket.id, request.authUser);
  return response.json({
    success: true,
    message: `${ticket.ticketNumber} escalated to ${toLevel}.`,
    data: { ticket: updated },
  });
}

export async function addTicketComment(request, response) {
  const ticket = await accessibleTicket(request.params.id, request.authUser, undefined);
  if (!ticket) throw httpError(404, 'Ticket not found in your authorized scope.');
  const body = clean(request.body?.body, 10000);
  if (!body) throw httpError(400, 'Comment text is required.');
  const isInternal = request.body?.isInternal === true;
  if (isInternal && isFacilityManager(request.authUser)) {
    throw httpError(403, 'Facility managers cannot create internal support notes.');
  }
  const attachments = normalizeTicketAttachments(request.body?.attachments);

  const [comment] = await prisma.$transaction([
    prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: request.authUser.id,
        body,
        isInternal,
        ...(attachments.length
          ? {
            attachments: {
              create: attachments.map((attachment) => ({
                ...attachment,
                ticket: { connect: { id: ticket.id } },
                uploadedBy: { connect: { id: request.authUser.id } },
              })),
            },
          }
          : {}),
      },
      include: { author: { select: personSelect }, attachments: true },
    }),
    prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        userId: request.authUser.id,
        action: isInternal ? 'INTERNAL_NOTE_ADDED' : 'COMMENT_ADDED',
      },
    }),
  ]);
  await notifyTicketCommentAddedInApp(ticket.id, request.authUser.id, {
    isInternal,
    escalationLevel: ticket.escalationLevel,
  });

  return response.status(201).json({
    success: true,
    message: 'Comment added.',
    data: { comment },
  });
}
