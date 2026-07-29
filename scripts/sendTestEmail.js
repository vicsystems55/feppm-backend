import 'dotenv/config';

import { sendResendConfigurationTest } from '../src/services/ticketEmailService.js';

const recipient = String(process.env.TEST_EMAIL_TO ?? '').trim();

try {
  const result = await sendResendConfigurationTest(recipient);
  console.log(`Resend accepted the FEPPM test email. Email ID: ${result.id}`);
} catch (error) {
  console.error(`Unable to send the FEPPM test email: ${error.message}`);
  process.exitCode = 1;
}
