import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const permissions = [
  ['platform.manage', 'Manage platform-wide settings and operations'],
  ['countries.manage', 'Manage countries and country configuration'],
  ['organizations.view', 'View organizations'],
  ['organizations.manage', 'Create and update organizations'],
  ['audit_logs.view', 'View security and activity audit logs'],
  ['users.view', 'View users within the authorized scope'],
  ['users.create', 'Create users within the authorized scope'],
  ['users.update', 'Update users within the authorized scope'],
  ['users.deactivate', 'Suspend or deactivate users'],
  ['roles.view', 'View roles and assigned permissions'],
  ['roles.manage', 'Create, update, and assign roles'],
  ['permissions.manage', 'Manage the permission catalogue'],
  ['administrative_units.view', 'View the administrative hierarchy'],
  ['administrative_units.manage', 'Create and update administrative units'],
  ['facilities.view', 'View facilities within the authorized scope'],
  ['facilities.create', 'Create facilities within the authorized scope'],
  ['facilities.update', 'Update facilities within the authorized scope'],
  ['facilities.archive', 'Archive facilities'],
  ['departments.manage', 'Manage facility departments'],
  ['equipment.view', 'View equipment and equipment history'],
  ['equipment.create', 'Register equipment'],
  ['equipment.update', 'Update equipment records'],
  ['equipment.decommission', 'Decommission equipment'],
  ['equipment.documents.manage', 'Manage equipment documents'],
  ['equipment.status.change', 'Change equipment functionality status'],
  ['sops.view', 'View standard operating procedures'],
  ['sops.manage', 'Create, update, approve, and archive SOPs'],
  ['checklists.view', 'View checklist templates'],
  ['checklists.manage', 'Create, update, and publish checklist templates'],
  ['maintenance_schedules.view', 'View preventive maintenance schedules'],
  ['maintenance_schedules.manage', 'Create and update preventive maintenance schedules'],
  ['maintenance_tasks.view', 'View maintenance tasks'],
  ['maintenance_tasks.assign', 'Assign maintenance tasks'],
  ['maintenance_tasks.execute', 'Start, complete, and submit maintenance tasks'],
  ['maintenance_tasks.verify', 'Verify completed maintenance tasks'],
  ['maintenance_tasks.waive', 'Waive or mark maintenance tasks not applicable'],
  ['work_orders.view', 'View corrective maintenance work orders'],
  ['work_orders.create', 'Create corrective maintenance work orders'],
  ['work_orders.assign', 'Assign corrective maintenance work orders'],
  ['work_orders.update', 'Update work-order progress and activities'],
  ['work_orders.resolve', 'Resolve corrective maintenance work orders'],
  ['work_orders.verify', 'Verify and close corrective maintenance work orders'],
  ['evidence.view', 'View maintenance evidence'],
  ['evidence.submit', 'Upload maintenance evidence'],
  ['evidence.review', 'Accept, reject, or flag maintenance evidence'],
  ['alerts.view', 'View operational alerts'],
  ['alerts.manage', 'Acknowledge, resolve, or dismiss alerts'],
  ['compliance.view', 'View compliance results and trends'],
  ['reports.view', 'View operational and management reports'],
  ['reports.export', 'Export reports'],
  ['notifications.manage', 'Manage notification rules and delivery settings'],
];

const allPermissionKeys = permissions.map(([key]) => key);

const nationalExcluded = new Set([
  'platform.manage',
  'countries.manage',
  'organizations.manage',
  'permissions.manage',
]);

const scopedAdminExcluded = new Set([
  ...nationalExcluded,
  'roles.manage',
  'facilities.archive',
]);

const nationalAdminPermissions = allPermissionKeys.filter((key) => !nationalExcluded.has(key));
const scopedAdminPermissions = allPermissionKeys.filter((key) => !scopedAdminExcluded.has(key));

const facilityManagerPermissions = [
  'organizations.view',
  'users.view',
  'users.create',
  'users.update',
  'roles.view',
  'administrative_units.view',
  'facilities.view',
  'facilities.update',
  'departments.manage',
  'equipment.view',
  'equipment.create',
  'equipment.update',
  'equipment.decommission',
  'equipment.documents.manage',
  'equipment.status.change',
  'sops.view',
  'checklists.view',
  'maintenance_schedules.view',
  'maintenance_schedules.manage',
  'maintenance_tasks.view',
  'maintenance_tasks.assign',
  'maintenance_tasks.execute',
  'maintenance_tasks.verify',
  'maintenance_tasks.waive',
  'work_orders.view',
  'work_orders.create',
  'work_orders.assign',
  'work_orders.update',
  'work_orders.resolve',
  'work_orders.verify',
  'evidence.view',
  'evidence.submit',
  'evidence.review',
  'alerts.view',
  'alerts.manage',
  'compliance.view',
  'reports.view',
  'reports.export',
  'notifications.manage',
];

const roles = [
  {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Platform administrator with unrestricted access across all organizations and countries.',
    permissionKeys: allPermissionKeys,
  },
  {
    key: 'NATIONAL_ADMIN',
    name: 'National Admin',
    description: 'Organization administrator for all zones, states, LGAs, and facilities in an assigned national scope.',
    permissionKeys: nationalAdminPermissions,
  },
  {
    key: 'ZONAL_ADMIN',
    name: 'Zonal Admin',
    description: 'Organization administrator for states, LGAs, and facilities in an assigned zone.',
    permissionKeys: scopedAdminPermissions,
  },
  {
    key: 'STATE_ADMIN',
    name: 'State Admin',
    description: 'Organization administrator for LGAs and facilities in an assigned state.',
    permissionKeys: scopedAdminPermissions,
  },
  {
    key: 'LGA_ADMIN',
    name: 'LGA Admin',
    description: 'Organization administrator for facilities in an assigned local government area.',
    permissionKeys: scopedAdminPermissions,
  },
  {
    key: 'FACILITY_MANAGER',
    name: 'Facility Manager',
    description: 'Manager responsible for assigned facilities, equipment, users, and maintenance operations.',
    permissionKeys: facilityManagerPermissions,
  },
];

const defaultDemoPassword = 'Demo@FEPPM2026';

const demoUsers = [
  {
    roleKey: 'SUPER_ADMIN',
    firstName: 'Victor',
    lastName: 'Mensah',
    email: 'superadmin@feppm.demo',
  },
  {
    roleKey: 'NATIONAL_ADMIN',
    firstName: 'Amina',
    lastName: 'Bello',
    email: 'national.admin@feppm.demo',
    scope: 'national',
  },
  {
    roleKey: 'ZONAL_ADMIN',
    firstName: 'Chinedu',
    lastName: 'Okafor',
    email: 'zonal.admin@feppm.demo',
    scope: 'zone',
  },
  {
    roleKey: 'STATE_ADMIN',
    firstName: 'Fatima',
    lastName: 'Ibrahim',
    email: 'state.admin@feppm.demo',
    scope: 'state',
  },
  {
    roleKey: 'LGA_ADMIN',
    firstName: 'Tunde',
    lastName: 'Adeyemi',
    email: 'lga.admin@feppm.demo',
    scope: 'lga',
  },
  {
    roleKey: 'FACILITY_MANAGER',
    firstName: 'Grace',
    lastName: 'Eze',
    email: 'facility.manager@feppm.demo',
    facility: true,
  },
];

async function seedPermissions() {
  for (const [key, description] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }
}

async function seedRoles() {
  const permissionRecords = await prisma.permission.findMany({
    where: { key: { in: allPermissionKeys } },
    select: { id: true, key: true },
  });
  const permissionIds = new Map(permissionRecords.map((permission) => [permission.key, permission.id]));

  for (const roleDefinition of roles) {
    const role = await prisma.role.upsert({
      where: { key: roleDefinition.key },
      update: {
        name: roleDefinition.name,
        description: roleDefinition.description,
      },
      create: {
        key: roleDefinition.key,
        name: roleDefinition.name,
        description: roleDefinition.description,
      },
    });

    const assignments = roleDefinition.permissionKeys.map((permissionKey) => {
      const permissionId = permissionIds.get(permissionKey);
      if (!permissionId) throw new Error(`Permission not found during seed: ${permissionKey}`);
      return { roleId: role.id, permissionId };
    });

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({ data: assignments }),
    ]);
  }
}

async function upsertAdministrativeUnit(data) {
  const existing = await prisma.administrativeUnit.findFirst({
    where: {
      organizationId: data.organizationId,
      code: data.code,
    },
  });

  if (existing) {
    return prisma.administrativeUnit.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.administrativeUnit.create({ data });
}

async function seedDemoUsers() {
  const country = await prisma.country.upsert({
    where: { isoCode: 'NG' },
    update: {
      name: 'Nigeria',
      timezone: 'Africa/Lagos',
      currencyCode: 'NGN',
    },
    create: {
      name: 'Nigeria',
      isoCode: 'NG',
      timezone: 'Africa/Lagos',
      currencyCode: 'NGN',
    },
  });

  const organization = await prisma.organization.upsert({
    where: {
      countryId_name: {
        countryId: country.id,
        name: 'FEPPM Demo Organization',
      },
    },
    update: {
      code: 'FEPPM-DEMO',
      type: 'GOVERNMENT',
      status: 'ACTIVE',
    },
    create: {
      countryId: country.id,
      name: 'FEPPM Demo Organization',
      code: 'FEPPM-DEMO',
      type: 'GOVERNMENT',
      status: 'ACTIVE',
    },
  });

  const national = await upsertAdministrativeUnit({
    organizationId: organization.id,
    countryId: country.id,
    parentId: null,
    name: 'Nigeria',
    code: 'NG-NATIONAL',
    type: 'NATIONAL',
    timezone: 'Africa/Lagos',
    status: 'ACTIVE',
  });

  const zone = await upsertAdministrativeUnit({
    organizationId: organization.id,
    countryId: country.id,
    parentId: national.id,
    name: 'North Central Zone',
    code: 'NG-NCZ',
    type: 'ZONE',
    timezone: 'Africa/Lagos',
    status: 'ACTIVE',
  });

  const state = await upsertAdministrativeUnit({
    organizationId: organization.id,
    countryId: country.id,
    parentId: zone.id,
    name: 'Federal Capital Territory',
    code: 'NG-FCT',
    type: 'STATE',
    timezone: 'Africa/Lagos',
    status: 'ACTIVE',
  });

  const lga = await upsertAdministrativeUnit({
    organizationId: organization.id,
    countryId: country.id,
    parentId: state.id,
    name: 'Abuja Municipal Area Council',
    code: 'NG-FCT-AMAC',
    type: 'LGA',
    timezone: 'Africa/Lagos',
    status: 'ACTIVE',
  });

  const facility = await prisma.facility.upsert({
    where: {
      organizationId_facilityCode: {
        organizationId: organization.id,
        facilityCode: 'FEPPM-DEMO-001',
      },
    },
    update: {
      countryId: country.id,
      administrativeUnitId: lga.id,
      name: 'Abuja Demo General Hospital',
      facilityType: 'GENERAL_HOSPITAL',
      ownershipType: 'FEDERAL',
      address: 'Central Business District, Abuja',
      timezone: 'Africa/Lagos',
      status: 'ACTIVE',
    },
    create: {
      organizationId: organization.id,
      countryId: country.id,
      administrativeUnitId: lga.id,
      name: 'Abuja Demo General Hospital',
      facilityCode: 'FEPPM-DEMO-001',
      facilityType: 'GENERAL_HOSPITAL',
      ownershipType: 'FEDERAL',
      address: 'Central Business District, Abuja',
      timezone: 'Africa/Lagos',
      status: 'ACTIVE',
    },
  });

  const scopes = { national, zone, state, lga };
  const password = process.env.DEMO_USER_PASSWORD ?? defaultDemoPassword;
  const passwordHash = await bcrypt.hash(password, 12);
  const roleRecords = await prisma.role.findMany({
    where: { key: { in: demoUsers.map((user) => user.roleKey) } },
    select: { id: true, key: true },
  });
  const roleIds = new Map(roleRecords.map((role) => [role.key, role.id]));
  const seededUsers = [];

  for (const definition of demoUsers) {
    const roleId = roleIds.get(definition.roleKey);
    if (!roleId) throw new Error(`Role not found during demo-user seed: ${definition.roleKey}`);

    const user = await prisma.user.upsert({
      where: { email: definition.email },
      update: {
        organizationId: organization.id,
        facilityId: definition.facility ? facility.id : null,
        firstName: definition.firstName,
        lastName: definition.lastName,
        passwordHash,
        status: 'ACTIVE',
      },
      create: {
        organizationId: organization.id,
        facilityId: definition.facility ? facility.id : null,
        firstName: definition.firstName,
        lastName: definition.lastName,
        email: definition.email,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: user.id } }),
      prisma.userRole.create({ data: { userId: user.id, roleId } }),
      prisma.userScope.deleteMany({ where: { userId: user.id } }),
    ]);

    if (definition.scope) {
      await prisma.userScope.create({
        data: {
          userId: user.id,
          administrativeUnitId: scopes[definition.scope].id,
        },
      });
    }

    seededUsers.push({
      ...user,
      roleKey: definition.roleKey,
      scope: definition.scope ?? (definition.facility ? 'facility' : 'platform'),
    });
  }

  const facilityManager = seededUsers.find((user) => user.roleKey === 'FACILITY_MANAGER');
  await prisma.facility.update({
    where: { id: facility.id },
    data: { managerUserId: facilityManager.id },
  });

  return { seededUsers, password };
}

async function main() {
  await seedPermissions();
  await seedRoles();
  const { seededUsers, password } = await seedDemoUsers();

  const seededRoles = await prisma.role.findMany({
    where: { key: { in: roles.map((role) => role.key) } },
    select: { key: true, name: true, _count: { select: { permissions: true } } },
    orderBy: { key: 'asc' },
  });

  console.log(`Seeded ${permissions.length} permissions and ${seededRoles.length} roles.`);
  console.table(
    seededRoles.map((role) => ({
      key: role.key,
      name: role.name,
      permissions: role._count.permissions,
    })),
  );
  console.log(`Seeded ${seededUsers.length} demo users. Development password: ${password}`);
  console.table(
    seededUsers.map((user) => ({
      email: user.email,
      role: user.roleKey,
      scope: user.scope,
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
