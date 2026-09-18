import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertToolCanBeIssued,
  assertToolCanBeReturned,
  nextAuditDate,
  normalizedToolCondition,
  statusAfterReturn,
} from '../src/services/workshopResourceService.js';

test('only available uncustodied tools can be issued', () => {
  assert.doesNotThrow(() => assertToolCanBeIssued({ status: 'AVAILABLE', currentCustodianId: null }));
  assert.throws(() => assertToolCanBeIssued({ status: 'ISSUED', currentCustodianId: 'user-1' }), /not currently available/);
});

test('only issued tools with a custodian can be returned', () => {
  assert.doesNotThrow(() => assertToolCanBeReturned({ status: 'ISSUED', currentCustodianId: 'user-1' }));
  assert.throws(() => assertToolCanBeReturned({ status: 'AVAILABLE', currentCustodianId: null }), /not currently issued/);
});

test('damaged returns are quarantined for repair', () => {
  assert.equal(statusAfterReturn('GOOD'), 'AVAILABLE');
  assert.equal(statusAfterReturn('DAMAGED'), 'UNDER_REPAIR');
  assert.equal(statusAfterReturn('UNSERVICEABLE'), 'UNDER_REPAIR');
});

test('audit dates and tool conditions are normalized', () => {
  assert.equal(normalizedToolCondition(' fair '), 'FAIR');
  assert.equal(normalizedToolCondition('unknown', 'GOOD'), 'GOOD');
  assert.equal(nextAuditDate(new Date('2026-09-04T00:00:00Z'), 6).toISOString(), '2027-03-04T00:00:00.000Z');
});
