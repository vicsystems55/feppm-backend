import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveWorkOrderTransition } from '../src/services/workOrderWorkflowService.js';

test('work orders follow the controlled approval and field lifecycle', () => {
  assert.equal(resolveWorkOrderTransition('submit', 'DRAFT'), 'PENDING_APPROVAL');
  assert.equal(resolveWorkOrderTransition('approve', 'PENDING_APPROVAL'), 'APPROVED');
  assert.equal(resolveWorkOrderTransition('approve', 'PENDING_APPROVAL', { hasAssignment: true }), 'ASSIGNED');
  assert.equal(resolveWorkOrderTransition('assign', 'APPROVED'), 'ASSIGNED');
  assert.equal(resolveWorkOrderTransition('start', 'ASSIGNED'), 'IN_PROGRESS');
  assert.equal(resolveWorkOrderTransition('request_parts', 'IN_PROGRESS'), 'AWAITING_PARTS');
  assert.equal(resolveWorkOrderTransition('resume', 'AWAITING_PARTS'), 'IN_PROGRESS');
  assert.equal(resolveWorkOrderTransition('submit_completion', 'IN_PROGRESS'), 'AWAITING_VERIFICATION');
  assert.equal(resolveWorkOrderTransition('verify', 'AWAITING_VERIFICATION'), 'COMPLETED');
});

test('invalid work-order jumps are rejected', () => {
  assert.throws(
    () => resolveWorkOrderTransition('verify', 'ASSIGNED'),
    /cannot perform verify while assigned/i,
  );
});
