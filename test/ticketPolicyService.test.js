import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateSlaTargets,
  calculateTicketPriority,
  canTransitionTicket,
  deriveTicketSeverity,
  nextEscalationLevel,
  normalizeRiskLevel,
  statusTimestampChanges,
} from '../src/services/ticketPolicyService.js';

test('priority is calculated from impact and urgency', () => {
  assert.equal(calculateTicketPriority('CRITICAL', 'HIGH'), 1);
  assert.equal(calculateTicketPriority('HIGH', 'HIGH'), 2);
  assert.equal(calculateTicketPriority('MEDIUM', 'MEDIUM'), 3);
  assert.equal(calculateTicketPriority('LOW', 'LOW'), 4);
});

test('invalid risk values use the safe medium default', () => {
  assert.equal(normalizeRiskLevel('unexpected'), 'MEDIUM');
  assert.equal(calculateTicketPriority('unexpected', 'unexpected'), 3);
});

test('severity reflects the highest impact or urgency', () => {
  assert.equal(deriveTicketSeverity('LOW', 'CRITICAL'), 'CRITICAL');
  assert.equal(deriveTicketSeverity('HIGH', 'MEDIUM'), 'HIGH');
});

test('workflow permits controlled progress and rejects invalid jumps', () => {
  assert.equal(canTransitionTicket('OPEN', 'ACKNOWLEDGED'), true);
  assert.equal(canTransitionTicket('IN_PROGRESS', 'RESOLVED'), true);
  assert.equal(canTransitionTicket('RESOLVED', 'REOPENED'), true);
  assert.equal(canTransitionTicket('OPEN', 'CLOSED'), false);
  assert.equal(canTransitionTicket('CLOSED', 'REOPENED'), false);
  assert.equal(canTransitionTicket('OPEN', 'OPEN'), false);
});

test('escalation advances exactly one administrative level', () => {
  assert.equal(nextEscalationLevel('FACILITY'), 'LGA');
  assert.equal(nextEscalationLevel('LGA'), 'STATE');
  assert.equal(nextEscalationLevel('NATIONAL'), 'PLATFORM');
  assert.equal(nextEscalationLevel('PLATFORM'), null);
});

test('SLA targets use the configured priority policy', () => {
  const start = new Date('2026-07-28T08:00:00.000Z');
  const critical = calculateSlaTargets(1, start);
  const low = calculateSlaTargets(4, start);

  assert.equal(critical.responseDueAt.toISOString(), '2026-07-28T08:15:00.000Z');
  assert.equal(critical.resolutionDueAt.toISOString(), '2026-07-28T12:00:00.000Z');
  assert.equal(low.responseDueAt.toISOString(), '2026-07-29T08:00:00.000Z');
  assert.equal(low.resolutionDueAt.toISOString(), '2026-08-02T08:00:00.000Z');
});

test('status timestamps are applied consistently', () => {
  const now = new Date('2026-07-28T08:00:00.000Z');
  assert.deepEqual(statusTimestampChanges('ACKNOWLEDGED', now), {
    acknowledgedAt: now,
    firstResponseAt: now,
  });
  assert.deepEqual(statusTimestampChanges('RESOLVED', now), {
    resolvedAt: now,
    slaPausedAt: null,
  });
  assert.deepEqual(statusTimestampChanges('REOPENED', now), {
    resolvedAt: null,
    verifiedAt: null,
    closedAt: null,
    slaPausedAt: null,
  });
});
