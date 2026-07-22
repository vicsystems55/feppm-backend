import bcrypt from 'bcryptjs';

import { prisma } from '../src/lib/prisma.js';

const email = process.env.GOMBE_STATE_ADMIN_EMAIL ?? 'gombe.state.admin@feppm.demo';
const password = process.env.GOMBE_STATE_ADMIN_PASSWORD ?? 'Demo@FEPPM2026';

async function main() {
  const organization = await prisma.organization.findFirstOrThrow({
    where: { name: 'Gombe State Ministry of Health' },
  });
  const [state, role] = await Promise.all([
    prisma.administrativeUnit.findFirstOrThrow({
      where: { organizationId: organization.id, name: 'Gombe', type: 'STATE' },
    }),
    prisma.role.findUniqueOrThrow({ where: { key: 'STATE_ADMIN' } }),
  ]);
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      organizationId: organization.id,
      facilityId: null,
      firstName: 'Gombe',
      lastName: 'Administrator',
      passwordHash,
      status: 'ACTIVE',
    },
    create: {
      organizationId: organization.id,
      firstName: 'Gombe',
      lastName: 'Administrator',
      email,
      passwordHash,
      status: 'ACTIVE',
    },
  });

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: user.id } }),
    prisma.userScope.deleteMany({ where: { userId: user.id } }),
    prisma.userRole.create({ data: { userId: user.id, roleId: role.id } }),
    prisma.userScope.create({ data: { userId: user.id, administrativeUnitId: state.id } }),
  ]);

  console.log(`Gombe State Admin ready: ${email}`);
  console.log(`Development password: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
