import assert from 'node:assert/strict';
import test from 'node:test';

import { hasWebAppAccess } from '../src/controllers/authController.js';

function userWithRole(key) {
  return { roles: [{ role: { key } }] };
}

test('technician maintenance roles have web application access', () => {
  for (const role of [
    'NATIONAL_MAINTENANCE_MANAGER',
    'STATE_MAINTENANCE_MANAGER',
    'MAINTENANCE_SCHEDULER',
    'TECHNICIAN',
    'VENDOR_ADMIN',
    'VENDOR_TECHNICIAN',
  ]) {
    assert.equal(hasWebAppAccess(userWithRole(role)), true, `${role} should have web access`);
  }
});

test('an unrelated role does not gain web application access', () => {
  assert.equal(hasWebAppAccess(userWithRole('MOBILE_ONLY')), false);
});
