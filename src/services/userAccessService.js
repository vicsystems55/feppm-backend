import { prisma } from '../lib/prisma.js';

const authenticatedUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  organization: {
    select: { id: true, name: true, code: true },
  },
  facility: {
    select: { id: true, name: true, facilityCode: true },
  },
  scopes: {
    select: {
      administrativeUnit: {
        select: { id: true, name: true, type: true, parentId: true },
      },
    },
  },
  roles: {
    select: {
      role: {
        select: {
          key: true,
          name: true,
          permissions: {
            select: {
              permission: { select: { key: true } },
            },
          },
        },
      },
    },
  },
};

export function findUserForAuthentication(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: authenticatedUserSelect,
  });
}

export function findUserCredentialsByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      ...authenticatedUserSelect,
      passwordHash: true,
    },
  });
}

export function serializeAuthenticatedUser(user) {
  const roles = user.roles.map(({ role }) => ({ key: role.key, name: role.name }));
  const permissions = [
    ...new Set(
      user.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key),
      ),
    ),
  ].sort();

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    organization: user.organization,
    facility: user.facility,
    scopes: user.scopes.map(({ administrativeUnit }) => administrativeUnit),
    roles,
    permissions,
  };
}

export function userHasRole(user, roleKey) {
  return user.roles.some(({ role }) => role.key === roleKey);
}
