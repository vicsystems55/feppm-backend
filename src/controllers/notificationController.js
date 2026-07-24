import { prisma } from '../lib/prisma.js';

function notificationLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(1, parsed));
}

function serializeNotification(recipient) {
  return {
    id: recipient.id,
    readAt: recipient.readAt,
    deliveredAt: recipient.deliveredAt,
    createdAt: recipient.createdAt,
    alert: {
      id: recipient.alert.id,
      type: recipient.alert.alertType,
      severity: recipient.alert.severity,
      title: recipient.alert.title,
      message: recipient.alert.message,
      status: recipient.alert.status,
      triggeredAt: recipient.alert.triggeredAt,
      maintenanceTaskId: recipient.alert.maintenanceTaskId,
      facility: recipient.alert.facility,
      equipment: recipient.alert.equipment,
    },
  };
}

const notificationInclude = {
  alert: {
    select: {
      id: true,
      alertType: true,
      severity: true,
      title: true,
      message: true,
      status: true,
      triggeredAt: true,
      maintenanceTaskId: true,
      facility: { select: { id: true, name: true, facilityCode: true } },
      equipment: { select: { id: true, assetCode: true } },
    },
  },
};

export async function listTaskReminderTargets(request, response) {
  const managers = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      facilityId: { not: null },
      roles: { some: { role: { key: 'FACILITY_MANAGER' } } },
    },
    select: {
      facility: {
        select: { id: true, name: true, facilityCode: true },
      },
    },
    orderBy: { facility: { name: 'asc' } },
  });

  const facilities = new Map();
  for (const manager of managers) {
    if (!manager.facility) continue;
    const existing = facilities.get(manager.facility.id);
    facilities.set(manager.facility.id, {
      ...manager.facility,
      managerCount: (existing?.managerCount ?? 0) + 1,
    });
  }

  return response.json({
    success: true,
    data: { facilities: [...facilities.values()] },
  });
}

export async function sendTaskReminder(request, response) {
  const facilityId = String(request.body?.facilityId ?? '').trim() || null;
  const title =
    String(request.body?.title ?? '').trim().slice(0, 160) ||
    'Please update your maintenance tasks';
  const message =
    String(request.body?.message ?? '').trim().slice(0, 1000) ||
    'You have preventive maintenance work awaiting an update. Open Mazilu Fe-PPM and complete your assigned checklist.';

  const managers = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      ...(facilityId ? { facilityId } : { facilityId: { not: null } }),
      roles: { some: { role: { key: 'FACILITY_MANAGER' } } },
    },
    select: { id: true },
  });

  if (!managers.length) {
    return response.status(404).json({
      success: false,
      message: facilityId
        ? 'No active facility manager is assigned to that facility.'
        : 'No active facility managers were found.',
    });
  }

  const alert = await prisma.alert.create({
    data: {
      facilityId,
      alertType: 'TASK_UPDATE_REMINDER',
      severity: 'MEDIUM',
      title,
      message,
      status: 'OPEN',
      recipients: {
        create: managers.map(({ id: userId }) => ({
          userId,
          deliveryChannel: 'IN_APP',
        })),
      },
    },
    select: { id: true, triggeredAt: true },
  });

  return response.status(201).json({
    success: true,
    message: `Reminder sent to ${managers.length} facility manager${managers.length === 1 ? '' : 's'}.`,
    data: { alert, recipientCount: managers.length },
  });
}

export async function listNotifications(request, response) {
  const take = notificationLimit(request.query.limit);
  const recipients = await prisma.alertRecipient.findMany({
    where: {
      userId: request.authUser.id,
      deliveryChannel: 'IN_APP',
    },
    include: notificationInclude,
    orderBy: { createdAt: 'desc' },
    take,
  });

  const unreadCount = await prisma.alertRecipient.count({
    where: {
      userId: request.authUser.id,
      deliveryChannel: 'IN_APP',
      readAt: null,
    },
  });

  const undeliveredIds = recipients
    .filter((recipient) => !recipient.deliveredAt)
    .map((recipient) => recipient.id);
  if (undeliveredIds.length) {
    await prisma.alertRecipient.updateMany({
      where: { id: { in: undeliveredIds }, userId: request.authUser.id },
      data: { deliveredAt: new Date() },
    });
  }

  return response.json({
    success: true,
    data: {
      notifications: recipients.map(serializeNotification),
      unreadCount,
    },
  });
}

export async function markNotificationRead(request, response) {
  const result = await prisma.alertRecipient.updateMany({
    where: {
      id: request.params.id,
      userId: request.authUser.id,
      deliveryChannel: 'IN_APP',
    },
    data: { readAt: new Date() },
  });

  if (!result.count) {
    return response.status(404).json({
      success: false,
      message: 'Notification not found.',
    });
  }

  return response.json({ success: true, message: 'Notification marked as read.' });
}

export async function markAllNotificationsRead(request, response) {
  const result = await prisma.alertRecipient.updateMany({
    where: {
      userId: request.authUser.id,
      deliveryChannel: 'IN_APP',
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return response.json({
    success: true,
    message: 'Notifications marked as read.',
    data: { updated: result.count },
  });
}
