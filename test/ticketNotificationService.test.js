import assert from 'node:assert/strict';
import test from 'node:test';

import {
  recipientRoleKeysForLevel,
  ticketNotificationContent,
  uniqueRecipientIds,
} from '../src/services/ticketNotificationService.js';

const ticket = {
  ticketNumber: 'FEPPM-2026-000123',
  title: 'Cold room temperature alarm',
  priority: 1,
  organization: { name: 'Gombe State Ministry of Health' },
  administrativeUnit: { name: 'Balanga' },
  facility: { name: 'Balanga Health Clinic' },
};

test('ticket notification recipients are deduplicated and exclude the actor', () => {
  assert.deepEqual(
    uniqueRecipientIds([
      { id: 'reporter' },
      [{ id: 'lga-admin' }, { id: 'reporter' }],
      'actor',
      null,
    ], 'actor'),
    ['reporter', 'lga-admin'],
  );
});

test('ticket notifications can include the reporting actor', () => {
  assert.deepEqual(
    uniqueRecipientIds([{ id: 'reporter' }, { id: 'lga-admin' }]),
    ['reporter', 'lga-admin'],
  );
});

test('ticket creation notification identifies the ticket and facility', () => {
  const content = ticketNotificationContent('CREATED', ticket, {
    actorName: 'Grace Eze',
  });
  assert.equal(content.alertType, 'TICKET_CREATED');
  assert.match(content.title, /FEPPM-2026-000123/);
  assert.match(content.message, /Grace Eze/);
  assert.match(content.message, /Balanga Health Clinic/);
});

test('state ticket notifications target maintenance and workshop managers', () => {
  assert.deepEqual(recipientRoleKeysForLevel('STATE'), [
    'STATE_MAINTENANCE_MANAGER',
    'WORKSHOP_MANAGER',
  ]);
});

test('internal ticket comments use a distinct notification type and wording', () => {
  const content = ticketNotificationContent('COMMENT_ADDED', ticket, {
    actorName: 'Fatima Ibrahim',
    isInternal: true,
  });
  assert.equal(content.alertType, 'TICKET_INTERNAL_NOTE_ADDED');
  assert.match(content.title, /Internal note/);
  assert.match(content.message, /internal note/);
});
