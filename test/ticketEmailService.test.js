import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeHtml, resolveEmailRecipients } from '../src/services/ticketEmailService.js';

test('ticket email content escapes untrusted HTML', () => {
  assert.equal(
    escapeHtml('<script>alert("ticket")</script> & more'),
    '&lt;script&gt;alert(&quot;ticket&quot;)&lt;/script&gt; &amp; more',
  );
});

test('demo ticket recipients are redirected to the configured test inbox', () => {
  const recipients = resolveEmailRecipients([
    {
      id: 'manager',
      firstName: 'Grace',
      lastName: 'Eze',
      email: 'facility.manager@feppm.demo',
      status: 'ACTIVE',
    },
    {
      id: 'lga-admin',
      firstName: 'Tunde',
      lastName: 'Adeyemi',
      email: 'lga.admin@feppm.demo',
      status: 'ACTIVE',
    },
  ], {
    demoFallbackEnabled: true,
    testEmailTo: 'tester@erp-55.com.ng',
  });

  assert.deepEqual(recipients, [{
    id: 'demo-email-fallback',
    email: 'tester@erp-55.com.ng',
    name: 'FEPPM Demo Tester',
  }]);
});

test('demo fallback is added without replacing real recipients', () => {
  const recipients = resolveEmailRecipients([
    {
      id: 'real-admin',
      firstName: 'Real',
      lastName: 'Admin',
      email: 'admin@erp-55.com.ng',
      status: 'ACTIVE',
    },
    {
      id: 'demo-manager',
      firstName: 'Demo',
      lastName: 'Manager',
      email: 'facility.manager@feppm.demo',
      status: 'ACTIVE',
    },
  ], {
    demoFallbackEnabled: true,
    testEmailTo: 'tester@erp-55.com.ng',
  });

  assert.deepEqual(recipients.map(({ email }) => email), [
    'admin@erp-55.com.ng',
    'tester@erp-55.com.ng',
  ]);
});
