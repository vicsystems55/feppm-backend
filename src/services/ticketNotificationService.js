import { prisma } from '../lib/prisma.js';

const roleForLevel = {
  LGA: 'LGA_ADMIN',
  STATE: 'STATE_ADMIN',
  ZONE: 'ZONAL_ADMIN',
  NATIONAL: 'NATIONAL_ADMIN',
  PLATFORM: 'SUPER_ADMIN',
};

const ticketNotificationInclude = {
  organization: { select: { id: true, name: true } },
  administrativeUnit: { select: { id: true, name: true, type: true, parentId: true } },
  facility: {
    select: {
      id: true,
      name: true,
      administrativeUnitId: true,
      managerUserId: true,
    },
  },
  reportedBy: { select: { id: true } },
  assignedTo: { select: { id: true } },
};

export function uniqueRecipientIds(values, actorId = null) {
  return [...new Set(
    values
      .flat()
      .map((value) => typeof value === 'string' ? value : value?.id)
      .filter((id) => id && id !== actorId),
  )];
}

function ticketLocation(ticket) {
  return ticket.facility?.name
    ?? ticket.administrativeUnit?.name
    ?? ticket.organization.name;
}

export function ticketNotificationContent(event, ticket, context = {}) {
  const location = ticketLocation(ticket);
  const actorName = context.actorName || 'A FEPPM user';

  switch (event) {
    case 'CREATED':
      return {
        alertType: 'TICKET_CREATED',
        title: `New ticket ${ticket.ticketNumber}`,
        message: `${actorName} registered "${ticket.title}" for ${location}. Priority P${ticket.priority}.`,
      };
    case 'ASSIGNED':
      return {
        alertType: 'TICKET_ASSIGNED',
        title: `${ticket.ticketNumber} was assigned`,
        message: `${actorName} assigned "${ticket.title}" to ${context.assigneeName || 'a support officer'}.`,
      };
    case 'STATUS_CHANGED':
      return {
        alertType: 'TICKET_STATUS_CHANGED',
        title: `${ticket.ticketNumber} status updated`,
        message: `${actorName} changed the ticket status from ${context.oldStatus} to ${context.newStatus}.`,
      };
    case 'ESCALATED':
      return {
        alertType: 'TICKET_ESCALATED',
        title: `${ticket.ticketNumber} escalated`,
        message: `${actorName} escalated "${ticket.title}" from ${context.fromLevel} to ${context.toLevel}.`,
      };
    case 'COMMENT_ADDED':
      return {
        alertType: context.isInternal ? 'TICKET_INTERNAL_NOTE_ADDED' : 'TICKET_COMMENT_ADDED',
        title: context.isInternal
          ? `Internal note on ${ticket.ticketNumber}`
          : `New comment on ${ticket.ticketNumber}`,
        message: `${actorName} added ${context.isInternal ? 'an internal note' : 'a comment'} to "${ticket.title}".`,
      };
    default:
      throw new Error(`Unsupported ticket notification event: ${event}`);
  }
}

async function administrativeAncestors(administrativeUnitId) {
  const units = [];
  const visited = new Set();
  let nextId = administrativeUnitId;

  while (nextId && !visited.has(nextId)) {
    visited.add(nextId);
    const unit = await prisma.administrativeUnit.findUnique({
      where: { id: nextId },
      select: { id: true, type: true, parentId: true },
    });
    if (!unit) break;
    units.push(unit);
    nextId = unit.parentId;
  }
  return units;
}

async function administratorsForLevel(ticket, level, ancestors) {
  const roleKey = roleForLevel[level];
  if (!roleKey) return [];
  const unit = ancestors.find(({ type }) => type === level);
  if (['LGA', 'STATE', 'ZONE'].includes(level) && !unit) return [];

  return prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      ...(level === 'PLATFORM' ? {} : { organizationId: ticket.organizationId }),
      roles: { some: { role: { key: roleKey } } },
      ...(['LGA', 'STATE', 'ZONE'].includes(level)
        ? { scopes: { some: { administrativeUnitId: unit.id } } }
        : {}),
    },
    select: { id: true },
  });
}

async function facilityManagers(ticket) {
  if (!ticket.facilityId) return [];
  return prisma.user.findMany({
    where: {
      organizationId: ticket.organizationId,
      facilityId: ticket.facilityId,
      status: 'ACTIVE',
      roles: { some: { role: { key: 'FACILITY_MANAGER' } } },
    },
    select: { id: true },
  });
}

async function actorDisplayName(actorId) {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { firstName: true, lastName: true },
  });
  return [actor?.firstName, actor?.lastName].filter(Boolean).join(' ') || 'A FEPPM user';
}

async function createTicketNotification({
  ticketId,
  actorId,
  event,
  targetLevel = null,
  context = {},
}) {
  try {
    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
      include: ticketNotificationInclude,
    });
    if (!ticket) return { created: false, recipientCount: 0 };

    const [ancestors, managers, actorName] = await Promise.all([
      administrativeAncestors(
        ticket.facility?.administrativeUnitId ?? ticket.administrativeUnitId,
      ),
      facilityManagers(ticket),
      actorDisplayName(actorId),
    ]);
    const lgaAdmins = await administratorsForLevel(ticket, 'LGA', ancestors);
    const targetAdmins = targetLevel && targetLevel !== 'LGA'
      ? await administratorsForLevel(ticket, targetLevel, ancestors)
      : [];

    let candidates;
    if (event === 'COMMENT_ADDED' && context.isInternal) {
      candidates = [ticket.assignedTo, lgaAdmins, targetAdmins];
    } else if (event === 'ESCALATED') {
      candidates = [
        ticket.reportedBy,
        ticket.assignedTo,
        managers,
        ticket.facility?.managerUserId,
        lgaAdmins,
        targetAdmins,
      ];
    } else {
      candidates = [
        ticket.reportedBy,
        ticket.assignedTo,
        managers,
        ticket.facility?.managerUserId,
        lgaAdmins,
      ];
    }

    const recipientIds = uniqueRecipientIds(candidates, actorId);
    if (!recipientIds.length) return { created: false, recipientCount: 0 };

    const content = ticketNotificationContent(event, ticket, {
      ...context,
      actorName,
    });
    const alert = await prisma.alert.create({
      data: {
        ticketId: ticket.id,
        facilityId: ticket.facilityId,
        equipmentId: ticket.equipmentId,
        alertType: content.alertType,
        severity: ticket.severity,
        title: content.title,
        message: content.message,
        recipients: {
          create: recipientIds.map((userId) => ({
            userId,
            deliveryChannel: 'IN_APP',
          })),
        },
      },
      select: { id: true },
    });

    return { created: true, alertId: alert.id, recipientCount: recipientIds.length };
  } catch (error) {
    console.error(`Ticket ${event.toLowerCase()} in-app notification failed:`, error);
    return { created: false, recipientCount: 0, error: error.message };
  }
}

export function notifyTicketCreatedInApp(ticketId, actorId) {
  return createTicketNotification({ ticketId, actorId, event: 'CREATED' });
}

export function notifyTicketAssignedInApp(ticketId, actorId, context) {
  return createTicketNotification({ ticketId, actorId, event: 'ASSIGNED', context });
}

export function notifyTicketStatusChangedInApp(ticketId, actorId, context) {
  return createTicketNotification({ ticketId, actorId, event: 'STATUS_CHANGED', context });
}

export function notifyTicketEscalatedInApp(ticketId, actorId, context) {
  return createTicketNotification({
    ticketId,
    actorId,
    event: 'ESCALATED',
    targetLevel: context.toLevel,
    context,
  });
}

export function notifyTicketCommentAddedInApp(ticketId, actorId, context) {
  return createTicketNotification({
    ticketId,
    actorId,
    event: 'COMMENT_ADDED',
    targetLevel: context.escalationLevel,
    context,
  });
}
