import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertIndependentReviewer,
  assertIndependentStoreReviewer,
  positiveQuantity,
  storeReviewTransition,
  workshopReviewTransition,
} from '../src/services/resourceRequestWorkflowService.js';

test('workshop review permits only submitted requests', () => {
  assert.equal(workshopReviewTransition('SUBMITTED', 'APPROVE'), 'WORKSHOP_APPROVED');
  assert.equal(workshopReviewTransition('SUBMITTED', 'REJECT'), 'REJECTED');
  assert.throws(() => workshopReviewTransition('WORKSHOP_APPROVED', 'APPROVE'), /Only submitted/);
});

test('store review supports approval, shortage and rejection', () => {
  assert.equal(storeReviewTransition('WORKSHOP_APPROVED', 'APPROVE'), 'APPROVED_FOR_ISSUE');
  assert.equal(storeReviewTransition('WORKSHOP_APPROVED', 'AWAITING_STOCK'), 'AWAITING_STOCK');
  assert.equal(storeReviewTransition('AWAITING_STOCK', 'REJECT'), 'REJECTED');
});

test('requesters cannot approve their own request', () => {
  assert.throws(() => assertIndependentReviewer({ requestedById: 'user-1' }, 'user-1'), /cannot approve/);
  assert.doesNotThrow(() => assertIndependentReviewer({ requestedById: 'user-1' }, 'user-2'));
});

test('store authorization is separate from workshop approval', () => {
  assert.throws(() => assertIndependentStoreReviewer({ requestedById: 'user-1', workshopReviewedById: 'user-2' }, 'user-2'), /cannot also authorize/);
  assert.doesNotThrow(() => assertIndependentStoreReviewer({ requestedById: 'user-1', workshopReviewedById: 'user-2' }, 'user-3'));
});

test('tool quantities are positive whole numbers', () => {
  assert.equal(positiveQuantity('2', { whole: true, maximum: 10 }), 2);
  assert.throws(() => positiveQuantity('1.5', { whole: true }), /whole numbers/);
  assert.throws(() => positiveQuantity(11, { maximum: 10 }), /positive number/);
});
