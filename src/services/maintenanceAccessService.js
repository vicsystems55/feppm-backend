import { prisma } from '../lib/prisma.js';
import { resolveFacilityAccess } from './facilityAccessService.js';
import { userHasRole } from './userAccessService.js';

const nationalRoles = new Set(['SUPER_ADMIN', 'NATIONAL_ADMIN', 'NATIONAL_MAINTENANCE_MANAGER']);
const vendorRoles = new Set(['VENDOR_ADMIN', 'VENDOR_TECHNICIAN']);

function hasAnyRole(user, keys) {
  return user.roles.some(({ role }) => keys.has(role.key));
}

export async function maintenanceScope(user) {
  const organizationId = user.organization.id;
  if (userHasRole(user, 'SUPER_ADMIN')) {
    return { organizationWhere: {}, facilityWhere: {}, administrativeUnitWhere: {}, vendorId: null };
  }

  const profile = await prisma.technicianProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, vendorId: true },
  });
  const access = await resolveFacilityAccess(user);
  return {
    organizationWhere: { organizationId },
    facilityWhere: access.facilityWhere,
    administrativeUnitWhere: access.administrativeUnitWhere,
    technicianProfileId: profile?.id ?? null,
    vendorId: hasAnyRole(user, vendorRoles) ? profile?.vendorId ?? '__none__' : null,
    national: hasAnyRole(user, nationalRoles),
  };
}

export async function maintenanceTicketWhere(user) {
  const scope = await maintenanceScope(user);
  if (userHasRole(user, 'SUPER_ADMIN')) return {};

  if (userHasRole(user, 'VENDOR_TECHNICIAN')) {
    return {
      organizationId: user.organization.id,
      workOrders: { some: { assignedTechnicianId: scope.technicianProfileId ?? '__none__', vendorContract: { is: { vendorId: scope.vendorId } } } },
    };
  }
  if (userHasRole(user, 'VENDOR_ADMIN')) {
    return {
      organizationId: user.organization.id,
      workOrders: { some: { vendorContract: { is: { vendorId: scope.vendorId } } } },
    };
  }
  if (userHasRole(user, 'TECHNICIAN')) {
    return {
      organizationId: user.organization.id,
      workOrders: { some: { assignedTechnicianId: scope.technicianProfileId ?? '__none__' } },
    };
  }

  if (scope.national) return { organizationId: user.organization.id };
  return {
    organizationId: user.organization.id,
    OR: [
      { facility: { is: scope.facilityWhere } },
      { administrativeUnit: { is: scope.administrativeUnitWhere } },
      ...(scope.technicianProfileId
        ? [{ workOrders: { some: { assignedTechnicianId: scope.technicianProfileId } } }]
        : []),
    ],
  };
}

export async function maintenanceWorkOrderWhere(user) {
  const scope = await maintenanceScope(user);
  if (userHasRole(user, 'SUPER_ADMIN')) return {};
  if (userHasRole(user, 'VENDOR_TECHNICIAN')) {
    return { organizationId: user.organization.id, assignedTechnicianId: scope.technicianProfileId ?? '__none__', vendorContract: { is: { vendorId: scope.vendorId } } };
  }
  if (userHasRole(user, 'VENDOR_ADMIN')) return { organizationId: user.organization.id, vendorContract: { is: { vendorId: scope.vendorId } } };
  if (userHasRole(user, 'TECHNICIAN')) {
    return { organizationId: user.organization.id, assignedTechnicianId: scope.technicianProfileId ?? '__none__' };
  }
  if (scope.national) return { organizationId: user.organization.id };
  return {
    organizationId: user.organization.id,
    OR: [
      { facility: { is: scope.facilityWhere } },
      { administrativeUnit: { is: scope.administrativeUnitWhere } },
    ],
  };
}
