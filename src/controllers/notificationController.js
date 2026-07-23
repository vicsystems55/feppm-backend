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
