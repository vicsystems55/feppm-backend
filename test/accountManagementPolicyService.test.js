import assert from 'node:assert/strict';
import test from 'node:test';

import {
  accountManagementContext,
  accountWhereForContext,
  assertAccountAllowed,
  assertAssignmentAllowed,
} from '../src/services/accountManagementPolicyService.js';

function user(roleKey, scopeType = 'STATE') {
  return {
    organization: { id: 'org-1' },
    roles: [{ role: { key: roleKey } }],
    scopes: [{ administrativeUnit: { id: 'state-1', type: scopeType } }],
  };
}

test('Super Admin retains unrestricted account management', () => {
  const context = accountManagementContext(user('SUPER_ADMIN'));
  assert.equal(context.unrestricted, true);
  assert.deepEqual(accountWhereForContext(context), {});
  assert.doesNotThrow(() => assertAssignmentAllowed(context, {
    organizationId: 'another-org', roleKey: 'NATIONAL_ADMIN', scopeUnitId: 'national-1',
  }));
});

test('State Maintenance Manager is limited to workshop staff in the assigned state', () => {
  const context = accountManagementContext(user('STATE_MAINTENANCE_MANAGER'));
  assert.equal(context.unrestricted, false);
  assert.deepEqual(context.managedRoleKeys, ['WORKSHOP_MANAGER', 'STOREKEEPER']);
  assert.doesNotThrow(() => assertAssignmentAllowed(context, {
    organizationId: 'org-1', roleKey: 'WORKSHOP_MANAGER', scopeUnitId: 'state-1',
  }));
  assert.doesNotThrow(() => assertAssignmentAllowed(context, {
    organizationId: 'org-1', roleKey: 'STOREKEEPER', scopeUnitId: 'state-1',
  }));
  assert.throws(() => assertAssignmentAllowed(context, {
    organizationId: 'org-1', roleKey: 'STATE_ADMIN', scopeUnitId: 'state-1',
  }), /only manage Workshop Manager and Storekeeper/);
  assert.throws(() => assertAssignmentAllowed(context, {
    organizationId: 'org-1', roleKey: 'WORKSHOP_MANAGER', scopeUnitId: 'state-2',
  }), /assigned state/);
});

test('State Maintenance Manager cannot edit an account from another state', () => {
  const context = accountManagementContext(user('STATE_MAINTENANCE_MANAGER'));
  const account = {
    organizationId: 'org-1',
    roles: [{ role: { key: 'WORKSHOP_MANAGER' } }],
    scopes: [{ administrativeUnit: { id: 'state-2' } }],
  };
  assert.throws(() => assertAccountAllowed(context, account), /permission to manage this account/);
});

test('maintenance roles without staff authority receive no management context', () => {
  assert.equal(accountManagementContext(user('WORKSHOP_MANAGER')), null);
  assert.equal(accountManagementContext(user('STOREKEEPER')), null);
});
