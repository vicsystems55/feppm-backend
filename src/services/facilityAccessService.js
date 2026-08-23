import { prisma } from '../lib/prisma.js';

function hasRole(user, key) {
  return user.roles.some(({ role }) => role.key === key);
}

const organizationWideRoles = new Set(['NATIONAL_ADMIN', 'NATIONAL_MAINTENANCE_MANAGER']);

function hasOrganizationWideRole(user) {
  return user.roles.some(({ role }) => organizationWideRoles.has(role.key));
}

async function descendantUnitIds(rootIds) {
  const ids = new Set(rootIds);
  let frontier = [...rootIds];

  while (frontier.length) {
    const children = await prisma.administrativeUnit.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map(({ id }) => id).filter((id) => !ids.has(id));
    frontier.forEach((id) => ids.add(id));
  }

  return [...ids];
}

export async function resolveFacilityAccess(user) {
  if (hasRole(user, 'SUPER_ADMIN')) {
    return { facilityWhere: {}, administrativeUnitWhere: {} };
  }

  if (hasRole(user, 'FACILITY_MANAGER')) {
    return {
      facilityWhere: { id: user.facility?.id ?? '__none__' },
      administrativeUnitWhere: { organizationId: user.organization.id },
    };
  }

  const scopeIds = user.scopes.map(({ administrativeUnit }) => administrativeUnit.id);
  if (hasOrganizationWideRole(user)) {
    return {
      facilityWhere: { organizationId: user.organization.id },
      administrativeUnitWhere: { organizationId: user.organization.id },
    };
  }

  if (!scopeIds.length) {
    return {
      facilityWhere: { organizationId: user.organization.id, id: '__none__' },
      administrativeUnitWhere: { organizationId: user.organization.id, id: '__none__' },
    };
  }

  const unitIds = await descendantUnitIds(scopeIds);
  return {
    facilityWhere: { organizationId: user.organization.id, administrativeUnitId: { in: unitIds } },
    administrativeUnitWhere: { organizationId: user.organization.id, id: { in: unitIds } },
  };
}
