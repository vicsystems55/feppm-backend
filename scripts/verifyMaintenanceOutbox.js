import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const rollbackSignal = 'FEPPM_OUTBOX_VERIFIED_ROLLBACK';

try {
  const user = await prisma.user.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, organizationId: true, facility: { select: { id: true, administrativeUnitId: true } } },
  });

  if (!user) {
    console.log('Outbox verification skipped: no active user is available.');
  } else {
    try {
      await prisma.$transaction(async (transaction) => {
        const ticket = await transaction.maintenanceTicket.create({
          data: {
            ticketNumber: `OUTBOX-VERIFY-${Date.now()}`,
            organizationId: user.organizationId,
            administrativeUnitId: user.facility?.administrativeUnitId ?? null,
            facilityId: user.facility?.id ?? null,
            reportedById: user.id,
            sourceType: 'SYSTEM_ALERT',
            title: 'Outbox trigger verification',
            faultDescription: 'Rollback-only maintenance trigger verification record.',
          },
        });
        const triage = await transaction.maintenanceTriage.create({
          data: {
            ticketId: ticket.id,
            decision: 'INFORMATION_REQUIRED',
            assessment: 'Rollback-only verification of the maintenance event outbox trigger.',
            triagedById: user.id,
          },
        });
        const event = await transaction.outboxEvent.findFirst({
          where: {
            aggregateType: 'MaintenanceTriage',
            aggregateId: triage.id,
            eventType: 'MAINTENANCETRIAGE_INSERT',
          },
        });
        if (!event) throw new Error('The MaintenanceTriage trigger did not create an outbox event.');
        throw new Error(rollbackSignal);
      });
    } catch (error) {
      if (error.message !== rollbackSignal) throw error;
      console.log('Maintenance outbox trigger verified; all test writes were rolled back.');
    }
  }
} finally {
  await prisma.$disconnect();
}
