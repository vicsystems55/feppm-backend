import { Resend } from 'resend';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

const resend = env.emailEnabled ? new Resend(env.resendApiKey) : null;

const roleForLevel = {
  LGA: 'LGA_ADMIN',
  STATE: 'STATE_ADMIN',
  ZONE: 'ZONAL_ADMIN',
  NATIONAL: 'NATIONAL_ADMIN',
  PLATFORM: 'SUPER_ADMIN',
};

const ticketEmailInclude = {
  organization: { select: { id: true, name: true } },
  administrativeUnit: { select: { id: true, name: true, type: true, parentId: true } },
  facility: {
    select: {
      id: true,
      name: true,
      administrativeUnitId: true,
      manager: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
    },
  },
  equipment: {
    select: {
      id: true,
      assetCode: true,
      equipmentType: { select: { name: true } },
    },
  },
  reportedBy: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
};

function emailAddressValid(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && !email.endsWith('.demo')
    && !email.endsWith('@example.com');
}

function isDemoEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return email.endsWith('.demo') || email.endsWith('@example.com');
}

export function resolveEmailRecipients(users, {
  demoFallbackEnabled = env.emailDemoFallbackEnabled,
  testEmailTo = env.testEmailTo,
} = {}) {
  const recipients = new Map();
  let hasDemoRecipient = false;

  for (const user of users.filter(Boolean)) {
    const email = String(user.email ?? '').trim().toLowerCase();
    if (user.status === 'ACTIVE' && isDemoEmail(email)) hasDemoRecipient = true;
    if (user.status !== 'ACTIVE' || !emailAddressValid(email) || recipients.has(email)) continue;
    recipients.set(email, {
      id: user.id,
      email,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'FEPPM user',
    });
  }

  const fallbackEmail = String(testEmailTo ?? '').trim().toLowerCase();
  if (
    hasDemoRecipient
    && demoFallbackEnabled
    && emailAddressValid(fallbackEmail)
    && !recipients.has(fallbackEmail)
  ) {
    recipients.set(fallbackEmail, {
      id: 'demo-email-fallback',
      email: fallbackEmail,
      name: 'FEPPM Demo Tester',
    });
  }

  return [...recipients.values()];
}

async function administrativeAncestors(administrativeUnitId) {
  const units = [];
  let nextId = administrativeUnitId;

  while (nextId) {
    const unit = await prisma.administrativeUnit.findUnique({
      where: { id: nextId },
      select: { id: true, name: true, type: true, parentId: true },
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

  return prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      ...(level === 'PLATFORM' ? {} : { organizationId: ticket.organizationId }),
      roles: { some: { role: { key: roleKey } } },
      ...(['LGA', 'STATE', 'ZONE'].includes(level)
        ? { scopes: { some: { administrativeUnitId: unit?.id ?? '__none__' } } }
        : {}),
    },
    select: { id: true, firstName: true, lastName: true, email: true, status: true },
  });
}

function ticketLink(ticketId) {
  return `${env.appUrl.replace(/\/+$/, '')}/modules/issues/${encodeURIComponent(ticketId)}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function priorityName(priority) {
  return { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' }[priority] ?? 'Medium';
}

function emailDocument({ recipientName, preheader, heading, intro, ticket, eventMessage, actionLabel }) {
  const facility = ticket.facility?.name ?? ticket.administrativeUnit?.name ?? ticket.organization.name;
  const equipment = ticket.equipment
    ? `${ticket.equipment.assetCode} · ${ticket.equipment.equipmentType.name}`
    : 'No specific equipment';
  const link = ticketLink(ticket.id);

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#101828">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
        <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#0b55bc,#1264d8);color:#fff">
          <div style="font-size:26px;font-weight:800;letter-spacing:.5px">FE<span style="color:#5ee49b">PPM</span></div>
          <div style="margin-top:5px;font-size:12px;color:#dbeafe">Facility Equipment Planned Preventive Maintenance</div>
        </td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 8px;font-size:14px;color:#475467">Hello ${escapeHtml(recipientName)},</p>
          <h1 style="margin:0 0 10px;font-size:24px;line-height:1.3">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 20px;color:#475467;font-size:14px;line-height:1.65">${escapeHtml(intro)}</p>
          <div style="margin-bottom:20px;padding:15px 17px;border-left:4px solid #f79009;border-radius:8px;background:#fff8eb;color:#7a2e0e;font-size:13px;line-height:1.55">${escapeHtml(eventMessage)}</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px">
            <tr><td style="padding:11px 13px;color:#667085;font-size:12px;border-bottom:1px solid #edf0f4">Ticket</td><td style="padding:11px 13px;font-weight:700;font-size:13px;border-bottom:1px solid #edf0f4">${escapeHtml(ticket.ticketNumber)}</td></tr>
            <tr><td style="padding:11px 13px;color:#667085;font-size:12px;border-bottom:1px solid #edf0f4">Issue</td><td style="padding:11px 13px;font-weight:600;font-size:13px;border-bottom:1px solid #edf0f4">${escapeHtml(ticket.title)}</td></tr>
            <tr><td style="padding:11px 13px;color:#667085;font-size:12px;border-bottom:1px solid #edf0f4">Facility / scope</td><td style="padding:11px 13px;font-size:13px;border-bottom:1px solid #edf0f4">${escapeHtml(facility)}</td></tr>
            <tr><td style="padding:11px 13px;color:#667085;font-size:12px;border-bottom:1px solid #edf0f4">Equipment</td><td style="padding:11px 13px;font-size:13px;border-bottom:1px solid #edf0f4">${escapeHtml(equipment)}</td></tr>
            <tr><td style="padding:11px 13px;color:#667085;font-size:12px">Priority</td><td style="padding:11px 13px;font-weight:700;font-size:13px">P${ticket.priority} · ${escapeHtml(priorityName(ticket.priority))}</td></tr>
          </table>
          <div style="margin-top:24px">
            <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#1264d8;color:#fff;text-decoration:none;font-size:13px;font-weight:700">${escapeHtml(actionLabel)}</a>
          </div>
          <p style="margin:22px 0 0;color:#98a2b3;font-size:11px;line-height:1.55">This operational email was sent automatically by FEPPM. Sign in to review the complete ticket history and respond.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function textDocument({ recipientName, heading, intro, ticket, eventMessage }) {
  return [
    `Hello ${recipientName},`,
    '',
    heading,
    intro,
    eventMessage,
    '',
    `Ticket: ${ticket.ticketNumber}`,
    `Issue: ${ticket.title}`,
    `Facility / scope: ${ticket.facility?.name ?? ticket.administrativeUnit?.name ?? ticket.organization.name}`,
    `Priority: P${ticket.priority} (${priorityName(ticket.priority)})`,
    '',
    `Open ticket: ${ticketLink(ticket.id)}`,
  ].join('\n');
}

async function deliver(ticket, recipients, content, eventKey) {
  if (!env.emailEnabled || !resend) {
    return { enabled: false, sent: 0, failed: 0, recipients: recipients.length };
  }

  const attempts = await Promise.allSettled(recipients.map(async (recipient) => {
    const documentData = { ...content, recipientName: recipient.name, ticket };
    const result = await resend.emails.send({
      from: env.emailFrom,
      to: recipient.email,
      ...(env.emailReplyTo ? { replyTo: env.emailReplyTo } : {}),
      subject: content.subject,
      html: emailDocument(documentData),
      text: textDocument(documentData),
      tags: [
        { name: 'event', value: content.tag },
        { name: 'ticket', value: ticket.ticketNumber },
      ],
    }, {
      idempotencyKey: `${eventKey}-${recipient.id}`.slice(0, 256),
    });
    if (result.error) throw new Error(result.error.message);
    return { recipientId: recipient.id, emailId: result.data.id };
  }));
  const results = attempts
    .filter(({ status }) => status === 'fulfilled')
    .map(({ value }) => value);
  const errors = attempts
    .filter(({ status }) => status === 'rejected')
    .map(({ reason }) => String(reason?.message ?? reason).slice(0, 500));

  return {
    enabled: true,
    sent: results.length,
    failed: attempts.length - results.length,
    recipients: recipients.length,
    results,
    errors,
  };
}

async function recordDelivery(ticketId, actorId, action, delivery) {
  if (!delivery.enabled) return;
  await prisma.ticketActivity.create({
    data: {
      ticketId,
      userId: actorId,
      action,
      comment: `${delivery.sent} ticket email${delivery.sent === 1 ? '' : 's'} accepted by Resend${delivery.failed ? `; ${delivery.failed} failed` : ''}.`,
      metadata: {
        sent: delivery.sent,
        recipientCount: delivery.recipients,
        emailIds: delivery.results.map(({ emailId }) => emailId),
        errors: delivery.errors,
      },
    },
  });
}

async function recordFailure(ticketId, actorId, error) {
  await prisma.ticketActivity.create({
    data: {
      ticketId,
      userId: actorId,
      action: 'EMAIL_NOTIFICATION_FAILED',
      comment: String(error?.message ?? 'Email notification failed.').slice(0, 1000),
    },
  }).catch(() => {});
}

export async function notifyTicketCreated(ticketId, actorId) {
  try {
    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
      include: ticketEmailInclude,
    });
    if (!ticket) return;
    const ancestors = await administrativeAncestors(
      ticket.facility?.administrativeUnitId ?? ticket.administrativeUnitId,
    );
    const lgaAdmins = await administratorsForLevel(ticket, 'LGA', ancestors);
    const recipients = resolveEmailRecipients([
      ticket.facility?.manager,
      ticket.reportedBy,
      ...lgaAdmins,
    ]);
    if (!recipients.length) return;

    const delivery = await deliver(ticket, recipients, {
      tag: 'ticket_created',
      subject: `[${ticket.ticketNumber}] New P${ticket.priority} FEPPM issue`,
      preheader: `A new FEPPM ticket has been raised for ${ticket.facility?.name ?? ticket.organization.name}.`,
      heading: 'A new support ticket was raised',
      intro: 'An operational issue has been registered and requires visibility from the facility and LGA support team.',
      eventMessage: `${ticket.reportedBy.firstName} ${ticket.reportedBy.lastName} reported this issue. Current status: ${ticket.status}.`,
      actionLabel: 'Review ticket',
    }, `ticket-created-${ticket.id}`);
    if (delivery.enabled && !delivery.sent && delivery.failed) {
      throw new Error(delivery.errors.join('; '));
    }
    await recordDelivery(ticket.id, actorId, 'TICKET_CREATED_EMAIL_SENT', delivery);
  } catch (error) {
    console.error('Ticket creation email failed:', error);
    await recordFailure(ticketId, actorId, error);
  }
}

export async function notifyTicketEscalated(ticketId, actorId, escalationId) {
  try {
    const [ticket, escalation] = await Promise.all([
      prisma.maintenanceTicket.findUnique({
        where: { id: ticketId },
        include: ticketEmailInclude,
      }),
      prisma.ticketEscalation.findUnique({
        where: { id: escalationId },
        select: { id: true, fromLevel: true, toLevel: true, reason: true },
      }),
    ]);
    if (!ticket || !escalation) return;
    const ancestors = await administrativeAncestors(
      ticket.facility?.administrativeUnitId ?? ticket.administrativeUnitId,
    );
    const targetAdmins = await administratorsForLevel(ticket, escalation.toLevel, ancestors);
    const recipients = resolveEmailRecipients([
      ...targetAdmins,
      ticket.facility?.manager,
      ticket.reportedBy,
      ticket.assignedTo,
    ]);
    if (!recipients.length) return;

    const delivery = await deliver(ticket, recipients, {
      tag: 'ticket_escalated',
      subject: `[${ticket.ticketNumber}] Escalated to ${escalation.toLevel}`,
      preheader: `FEPPM ticket ${ticket.ticketNumber} has been escalated.`,
      heading: `Ticket escalated to ${escalation.toLevel}`,
      intro: 'This ticket now requires attention at a higher administrative level. The complete history remains available in FEPPM.',
      eventMessage: `Escalation reason: ${escalation.reason}`,
      actionLabel: 'Open escalated ticket',
    }, `ticket-escalated-${escalation.id}`);
    if (delivery.enabled && !delivery.sent && delivery.failed) {
      throw new Error(delivery.errors.join('; '));
    }
    await recordDelivery(ticket.id, actorId, 'TICKET_ESCALATION_EMAIL_SENT', delivery);
  } catch (error) {
    console.error('Ticket escalation email failed:', error);
    await recordFailure(ticketId, actorId, error);
  }
}

export async function sendResendConfigurationTest(to) {
  if (!env.emailEnabled || !resend) {
    throw new Error('Resend email is disabled. Configure RESEND_API_KEY and RESEND_FROM_EMAIL first.');
  }
  if (!emailAddressValid(to)) throw new Error('TEST_EMAIL_TO must be a valid email address.');

  const result = await resend.emails.send({
    from: env.emailFrom,
    to,
    ...(env.emailReplyTo ? { replyTo: env.emailReplyTo } : {}),
    subject: 'FEPPM Resend configuration test',
    html: '<div style="font-family:Arial,sans-serif;padding:24px"><h1 style="color:#1264d8">FEPPM email is configured</h1><p>Your backend successfully submitted this transactional email through Resend.</p></div>',
    text: 'FEPPM email is configured. Your backend successfully submitted this transactional email through Resend.',
    tags: [{ name: 'event', value: 'configuration_test' }],
  }, {
    idempotencyKey: `feppm-configuration-test-${new Date().toISOString().slice(0, 13)}`,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
