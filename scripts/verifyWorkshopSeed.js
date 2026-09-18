import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const workshopCodes = ['GOMBE-CENTRAL-WORKSHOP', 'ANAMBRA-CENTRAL-WORKSHOP'];

try {
  const workshops = await prisma.maintenanceWorkshop.findMany({
    where: { code: { in: workshopCodes } },
    include: {
      organization: { select: { id: true, name: true } },
      administrativeUnit: { select: { id: true, name: true, type: true } },
      stores: { select: { id: true, code: true, name: true } },
      staffAssignments: {
        where: { status: 'ACTIVE' },
        include: {
          user: {
            select: {
              email: true,
              organizationId: true,
              roles: { select: { role: { select: { key: true } } } },
              scopes: { select: { administrativeUnitId: true } },
            },
          },
        },
      },
      kitAssignments: {
        where: { status: 'ACTIVE' },
        include: { kitTemplate: { select: { code: true, _count: { select: { items: true } } } } },
      },
    },
    orderBy: { code: 'asc' },
  });

  const problems = [];
  if (workshops.length !== workshopCodes.length) problems.push(`Expected 2 workshops; found ${workshops.length}.`);

  for (const workshop of workshops) {
    if (workshop.administrativeUnit.type !== 'STATE') problems.push(`${workshop.code} is not attached to a state.`);
    if (workshop.stores.length !== 1) problems.push(`${workshop.code} should have one seeded store.`);
    if (workshop.staffAssignments.length !== 2) problems.push(`${workshop.code} should have two active staff assignments.`);
    if (workshop.kitAssignments.length !== 1) problems.push(`${workshop.code} should have one active kit assignment.`);
    if (workshop.kitAssignments[0]?.kitTemplate._count.items !== 24) problems.push(`${workshop.code} toolkit should contain 24 catalog items.`);

    for (const assignment of workshop.staffAssignments) {
      if (assignment.user.organizationId !== workshop.organization.id) {
        problems.push(`${assignment.user.email} crosses the ${workshop.organization.name} tenant boundary.`);
      }
      if (!assignment.user.scopes.some((scope) => scope.administrativeUnitId === workshop.administrativeUnit.id)) {
        problems.push(`${assignment.user.email} lacks the ${workshop.administrativeUnit.name} state scope.`);
      }
      if (!assignment.user.roles.some(({ role }) => role.key === assignment.position)) {
        problems.push(`${assignment.user.email} does not have the ${assignment.position} role.`);
      }
    }
  }

  const seededStoreIds = workshops.flatMap((workshop) => workshop.stores.map((store) => store.id));
  const [toolAssets, stockBalances] = await Promise.all([
    prisma.toolAsset.count({ where: { storeId: { in: seededStoreIds } } }),
    prisma.stockBalance.count({ where: { storeId: { in: seededStoreIds } } }),
  ]);
  // Tool assets and stock balances are operational records. They may legitimately
  // exist after the seed has been applied, so report their counts without treating
  // them as seed integrity failures.

  const summary = workshops.map((workshop) => ({
    state: workshop.administrativeUnit.name,
    organization: workshop.organization.name,
    workshop: workshop.name,
    store: workshop.stores[0]?.name,
    staff: workshop.staffAssignments.map(({ position, user }) => ({ position, email: user.email })),
    toolkitItems: workshop.kitAssignments[0]?.kitTemplate._count.items || 0,
  }));

  console.log(JSON.stringify({ success: problems.length === 0, summary, toolAssets, stockBalances, problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
