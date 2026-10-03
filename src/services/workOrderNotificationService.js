import { Resend } from 'resend';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

const resend = env.emailEnabled ? new Resend(env.resendApiKey) : null;
const workOrderInclude = {
  ticket: { select: { id: true } },
  facility: { select: { id: true, name: true } },
  equipment: { select: { assetCode: true, equipmentType: { select: { name: true } } } },
  assignedTechnician: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } } } },
};

function prioritySeverity(priority) {
  return { 1: 'CRITICAL', 2: 'HIGH', 3: 'MEDIUM', 4: 'LOW' }[priority] ?? 'MEDIUM';
}

function isDemoEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return email.endsWith('.demo') || email.endsWith('@example.com');
}

function validEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !isDemoEmail(email);
}

function resolveRecipient(user) {
  const email = String(user?.email ?? '').trim().toLowerCase();
  if (user?.status === 'ACTIVE' && validEmail(email)) {
    return { email, name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'FEPPM technician' };
  }
  const fallback = String(env.testEmailTo ?? '').trim().toLowerCase();
  return env.emailDemoFallbackEnabled && validEmail(fallback)
    ? { email: fallback, name: 'FEPPM Demo Tester' }
    : null;
}

async function sendAssignmentEmail(workOrder, recipient) {
  if (!env.emailEnabled || !resend) return { enabled: false };
  const facility = workOrder.facility?.name ?? 'your assigned facility';
  const equipment = workOrder.equipment?.assetCode ?? workOrder.equipment?.equipmentType?.name ?? 'assigned equipment';
  const subject = `[${workOrder.workOrderNumber}] Work order assigned`;
  const text = `Hello ${recipient.name},\n\nWork order ${workOrder.workOrderNumber} has been assigned to you.\nTitle: ${workOrder.title}\nFacility: ${facility}\nEquipment: ${equipment}\n\nOpen FEPPM to accept the assignment and start work: ${env.appUrl}/modules/maintenance-operations?tab=work-orders`;
  const html = `<div style="font-family:Arial,sans-serif;color:#101828;line-height:1.6"><h2 style="color:#1264d8">Work order assigned</h2><p>Hello ${recipient.name},</p><p><strong>${workOrder.workOrderNumber}</strong> has been assigned to you.</p><p><strong>${workOrder.title}</strong><br>Facility: ${facility}<br>Equipment: ${equipment}</p><p><a href="${env.appUrl}/modules/maintenance-operations?tab=work-orders">Open work orders</a></p></div>`;
  let lastError;
  for (let attempt = 1; attempt <= env.emailNotificationMaxRetries; attempt += 1) {
    try {
      const result = await resend.emails.send({
        from: env.emailFrom,
        to: recipient.email,
        ...(env.emailReplyTo ? { replyTo: env.emailReplyTo } : {}),
        subject,
        text,
        html,
        tags: [{ name: 'event', value: 'work_order_assigned' }, { name: 'work_order', value: workOrder.workOrderNumber }],
      }, { idempotencyKey: `work-order-assigned-${workOrder.id}-${recipient.email}`.slice(0, 256) });
      if (result.error) throw new Error(result.error.message);
      return { enabled: true, sent: true, emailId: result.data.id };
    } catch (error) {
      lastError = error;
      if (attempt < env.emailNotificationMaxRetries) await new Promise((resolve) => setTimeout(resolve, env.emailNotificationRetryDelayMs * attempt));
    }
  }
  throw lastError;
}

export async function notifyWorkOrderAssigned(workOrderId, actorId) {
  const workOrder = await prisma.maintenanceWorkOrder.findUnique({ where: { id: workOrderId }, include: workOrderInclude });
  const user = workOrder?.assignedTechnician?.user;
  if (!workOrder || !user) return { recipientCount: 0 };

  const alert = await prisma.alert.create({
    data: {
      ticketId: workOrder.ticket?.id,
      facilityId: workOrder.facility?.id,
      equipmentId: workOrder.equipmentId,
      alertType: 'WORK_ORDER_ASSIGNED',
      severity: prioritySeverity(workOrder.priority),
      title: `${workOrder.workOrderNumber} assigned to you`,
      message: `Accept the assignment and start work on "${workOrder.title}" at ${workOrder.facility?.name ?? 'your facility'}.`,
      recipients: { create: { userId: user.id, deliveryChannel: 'IN_APP' } },
    },
    select: { id: true },
  });

  const recipient = resolveRecipient(user);
  if (!recipient) return { recipientCount: 1, alertId: alert.id };
  try {
    const delivery = await sendAssignmentEmail(workOrder, recipient);
    if (workOrder.ticket?.id) {
      await prisma.ticketActivity.create({
        data: {
          ticketId: workOrder.ticket.id,
          userId: actorId,
          action: delivery.sent ? 'WORK_ORDER_ASSIGNMENT_EMAIL_SENT' : 'WORK_ORDER_ASSIGNMENT_EMAIL_DISABLED',
          comment: delivery.sent ? `Work-order assignment email accepted by Resend for ${recipient.email}.` : 'Work-order email notifications are disabled.',
          metadata: { workOrderId: workOrder.id, alertId: alert.id, emailId: delivery.emailId ?? null },
        },
      });
    }
  } catch (error) {
    if (workOrder.ticket?.id) await prisma.ticketActivity.create({
      data: { ticketId: workOrder.ticket.id, userId: actorId, action: 'WORK_ORDER_ASSIGNMENT_EMAIL_FAILED', comment: String(error?.message ?? error).slice(0, 1000), metadata: { workOrderId: workOrder.id, alertId: alert.id } },
    }).catch(() => {});
  }
  return { recipientCount: 1, alertId: alert.id };
}
