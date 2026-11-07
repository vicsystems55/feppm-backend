import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { ensureManagerTasks } from '../src/controllers/checklistController.js';

const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY'];
const emailArgument = process.argv.find((argument) => argument.startsWith('--email='));
const email = emailArgument?.slice('--email='.length).trim().toLowerCase();

async function main() {
  const managers = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      facilityId: { not: null },
      ...(email ? { email: { equals: email, mode: 'insensitive' } } : {}),
      roles: { some: { role: { key: 'FACILITY_MANAGER' } } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      facility: { select: { id: true, name: true } },
    },
    orderBy: { email: 'asc' },
  });

  if (!managers.length) {
    throw new Error(email
      ? `No active Facility Manager was found for ${email}.`
      : 'No active Facility Managers with assigned facilities were found.');
  }

  for (const manager of managers) {
    for (const frequency of frequencies) {
      await ensureManagerTasks(manager, frequency);
    }
    console.log(`Materialized current checklist periods for ${manager.email} (${manager.facility.name}).`);
  }

  console.log(`Checklist task materialization completed for ${managers.length} Facility Manager(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
