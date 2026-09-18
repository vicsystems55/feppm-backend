import { userHasRole } from './userAccessService.js';

export const STATE_MAINTENANCE_MANAGED_ROLE_KEYS = Object.freeze([
  'WORKSHOP_MANAGER',
  'STOREKEEPER',
]);

function forbidden(message) {
  const error = new Error(message);
  error.status = 403;
  return error;
}

export function accountManagementContext(user) {
  if (userHasRole(user, 'SUPER_ADMIN')) {
    return { unrestricted: true, organizationId: null, stateScopeId: null, managedRoleKeys: null };
  }
  if (!userHasRole(user, 'STATE_MAINTENANCE_MANAGER')) return null;
  const stateScope = user.scopes
    .map(({ administrativeUnit }) => administrativeUnit)
    .find((scope) => scope.type === 'STATE');
  if (!stateScope) return null;
  return {
    unrestricted: false,
    organizationId: user.organization.id,
    stateScopeId: stateScope.id,
    managedRoleKeys: STATE_MAINTENANCE_MANAGED_ROLE_KEYS,
  };
}

export function accountWhereForContext(context) {
  if (context?.unrestricted) return {};
  if (!context) return { id: '__none__' };
  return {
    organizationId: context.organizationId,
    roles: { some: { role: { key: { in: context.managedRoleKeys } } } },
    scopes: { some: { administrativeUnitId: context.stateScopeId } },
  };
}

export function assertAssignmentAllowed(context, { organizationId, roleKey, scopeUnitId }) {
  if (context?.unrestricted) return;
  if (!context) throw forbidden('You do not have permission to manage login accounts.');
  if (organizationId !== context.organizationId
    || scopeUnitId !== context.stateScopeId
    || !context.managedRoleKeys.includes(roleKey)) {
    throw forbidden('State Maintenance Managers may only manage Workshop Manager and Storekeeper accounts in their assigned state.');
  }
}

export function assertAccountAllowed(context, account) {
  if (context?.unrestricted) return;
  const roleKeys = account?.roles?.map(({ role }) => role.key) ?? [];
  const scopeIds = account?.scopes?.map(({ administrativeUnit }) => administrativeUnit.id) ?? [];
  if (!context
    || account?.organizationId !== context.organizationId
    || !roleKeys.some((key) => context.managedRoleKeys.includes(key))
    || !scopeIds.includes(context.stateScopeId)) {
    throw forbidden('You do not have permission to manage this account.');
  }
}
