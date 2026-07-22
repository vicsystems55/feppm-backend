import bcrypt from 'bcryptjs';

import { prisma } from '../lib/prisma.js';

const accountSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  organization: { select: { id: true, name: true } },
  facility: { select: { id: true, name: true } },
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
  scopes: { select: { administrativeUnit: { select: { id: true, name: true, type: true } } } },
};

function serializeAccount(user) {
  return {
    ...user,
    roles: user.roles.map(({ role }) => role),
    scopes: user.scopes.map(({ administrativeUnit }) => administrativeUnit),
  };
}

function integer(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function requiredScopeType(roleKey) {
  return {
    NATIONAL_ADMIN: 'NATIONAL',
    ZONAL_ADMIN: 'ZONE',
    STATE_ADMIN: 'STATE',
    LGA_ADMIN: 'LGA',
  }[roleKey] ?? null;
}

async function validateAssignment({ organizationId, roleId, scopeUnitId, facilityId }) {
  const [organization, role] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.role.findUnique({ where: { id: roleId } }),
  ]);
  if (!organization || !role) throw new Error('The selected organization or role is invalid.');

  const expectedScope = requiredScopeType(role.key);
  let scope = null;
  let facility = null;
  if (expectedScope) {
    scope = await prisma.administrativeUnit.findFirst({
      where: { id: scopeUnitId, organizationId, type: expectedScope },
    });
    if (!scope) throw new Error(`${role.name} requires a ${expectedScope.toLowerCase()} scope in the selected organization.`);
  }
  if (role.key === 'FACILITY_MANAGER') {
    facility = await prisma.facility.findFirst({ where: { id: facilityId, organizationId } });
    if (!facility) throw new Error('Facility Manager requires a facility in the selected organization.');
  }
  return { role, scope, facility };
}

export async function listAccounts(request, response) {
  const page = integer(request.query.page, 1, 1, 100000);
  const pageSize = integer(request.query.pageSize, 20, 5, 100);
  const search = String(request.query.search ?? '').trim().slice(0, 100);
  const status = ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(request.query.status) ? request.query.status : undefined;
  const roleKey = String(request.query.roleKey ?? '').trim() || undefined;
  const organizationId = String(request.query.organizationId ?? '').trim() || undefined;
  const where = {
    ...(search ? { OR: [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
    ] } : {}),
    ...(status ? { status } : {}),
    ...(organizationId ? { organizationId } : {}),
    ...(roleKey ? { roles: { some: { role: { key: roleKey } } } } : {}),
  };
  const [total, accounts] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: accountSelect,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return response.json({
    success: true,
    data: {
      accounts: accounts.map(serializeAccount),
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
    },
  });
}

export async function getAccessOptions(_request, response) {
  const [roles, permissions, organizations] = await Promise.all([
    prisma.role.findMany({
      select: {
        id: true, key: true, name: true, description: true,
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.permission.findMany({ orderBy: { key: 'asc' } }),
    prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        administrativeUnits: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, type: true, parentId: true },
          orderBy: [{ type: 'asc' }, { name: 'asc' }],
        },
        facilities: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, administrativeUnitId: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);
  return response.json({
    success: true,
    data: {
      roles: roles.map((role) => ({
        ...role,
        permissions: role.permissions.map(({ permission }) => permission.key),
      })),
      permissions,
      organizations,
    },
  });
}

export async function createAccount(request, response) {
  const email = normalizeEmail(request.body?.email);
  const firstName = String(request.body?.firstName ?? '').trim();
  const lastName = String(request.body?.lastName ?? '').trim();
  const password = String(request.body?.password ?? '');
  const organizationId = String(request.body?.organizationId ?? '');
  const roleId = String(request.body?.roleId ?? '');
  if (!email || !firstName || !lastName || password.length < 10) {
    return response.status(400).json({ success: false, message: 'First name, last name, valid email, and a password of at least 10 characters are required.' });
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return response.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }

  try {
    const assignment = await validateAssignment({
      organizationId,
      roleId,
      scopeUnitId: request.body?.scopeUnitId,
      facilityId: request.body?.facilityId,
    });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        organizationId,
        facilityId: assignment.facility?.id,
        firstName,
        lastName,
        email,
        phone: String(request.body?.phone ?? '').trim() || null,
        passwordHash,
        status: 'ACTIVE',
        roles: { create: { roleId } },
        ...(assignment.scope ? { scopes: { create: { administrativeUnitId: assignment.scope.id } } } : {}),
      },
      select: accountSelect,
    });
    return response.status(201).json({ success: true, message: 'Account created.', data: { account: serializeAccount(user) } });
  } catch (error) {
    return response.status(400).json({ success: false, message: error.message });
  }
}

export async function updateAccount(request, response) {
  const account = await prisma.user.findUnique({
    where: { id: request.params.id },
    select: { id: true, roles: { select: { role: { select: { key: true } } } } },
  });
  if (!account) return response.status(404).json({ success: false, message: 'Account not found.' });

  const organizationId = String(request.body?.organizationId ?? '');
  const roleId = String(request.body?.roleId ?? '');
  const status = ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(request.body?.status) ? request.body.status : 'ACTIVE';
  const firstName = String(request.body?.firstName ?? '').trim();
  const lastName = String(request.body?.lastName ?? '').trim();
  if (!firstName || !lastName) {
    return response.status(400).json({ success: false, message: 'First name and last name are required.' });
  }
  if (account.id === request.auth.id && status !== 'ACTIVE') {
    return response.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
  }

  try {
    const assignment = await validateAssignment({
      organizationId,
      roleId,
      scopeUnitId: request.body?.scopeUnitId,
      facilityId: request.body?.facilityId,
    });
    if (account.id === request.auth.id && assignment.role.key !== 'SUPER_ADMIN') {
      return response.status(400).json({ success: false, message: 'You cannot remove your own Super Admin role.' });
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: account.id },
        data: {
          organizationId,
          facilityId: assignment.facility?.id ?? null,
          firstName,
          lastName,
          phone: String(request.body?.phone ?? '').trim() || null,
          status,
        },
      }),
      prisma.userRole.deleteMany({ where: { userId: account.id } }),
      prisma.userScope.deleteMany({ where: { userId: account.id } }),
      prisma.userRole.create({ data: { userId: account.id, roleId } }),
      ...(assignment.scope ? [prisma.userScope.create({ data: { userId: account.id, administrativeUnitId: assignment.scope.id } })] : []),
    ]);
    const updated = await prisma.user.findUnique({ where: { id: account.id }, select: accountSelect });
    return response.json({ success: true, message: 'Account access updated.', data: { account: serializeAccount(updated) } });
  } catch (error) {
    return response.status(400).json({ success: false, message: error.message });
  }
}

export async function updateRolePermissions(request, response) {
  const role = await prisma.role.findUnique({ where: { id: request.params.id } });
  if (!role) return response.status(404).json({ success: false, message: 'Role not found.' });
  if (role.key === 'SUPER_ADMIN') {
    return response.status(400).json({ success: false, message: 'Super Admin permissions are protected.' });
  }
  const permissionKeys = [...new Set(Array.isArray(request.body?.permissionKeys) ? request.body.permissionKeys : [])];
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } }, select: { id: true, key: true } });
  if (permissions.length !== permissionKeys.length) {
    return response.status(400).json({ success: false, message: 'One or more permissions are invalid.' });
  }
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) }),
  ]);
  return response.json({ success: true, message: `${role.name} permissions updated.` });
}
