# FEPPM Backend

Express and Prisma API for the FEPPM platform.

## Database

FEPPM uses MySQL through Prisma.

- Local development: XAMPP MySQL and phpMyAdmin
- Remote environment: Clever Cloud MySQL add-on

Create a local database named `feppm`, then use the XAMPP connection string from `.env.example`. If your MySQL root user has a password, place it between `root:` and `@` in the URL. URL-encode special characters in database credentials.

## Development

1. Copy `.env.example` to `.env` and update the values.
2. Run `npm install`.
3. Run `npm run prisma:generate`.
4. Run `npm run dev`.

## Seed data

After applying migrations, seed the initial administrative roles and core permissions:

```powershell
npm run prisma:seed
```

The seed is idempotent and can be run again after role or permission definitions change.

It also creates a Nigeria demo hierarchy, an Abuja demonstration facility, and one development account for every seeded administrative role. The default development password is `Demo@FEPPM2026`; override it with `DEMO_USER_PASSWORD` when needed. Never use the demo credentials in production.

To refresh permissions without creating or changing demo users, run:

```powershell
npm run seed:access-control
```

## Issues and support tickets

Authenticated and appropriately scoped users can use:

- `GET /api/v1/tickets`
- `POST /api/v1/tickets`
- `GET /api/v1/tickets/:id`
- `PATCH /api/v1/tickets/:id/status`
- `POST /api/v1/tickets/:id/assign`
- `POST /api/v1/tickets/:id/escalate`
- `POST /api/v1/tickets/:id/comments`

Ticket priority is calculated by the API from impact and urgency. Ticket visibility is always restricted by the authenticated user's facility, administrative scope, organization, or direct ticket assignment.

## Resend ticket emails

Ticket creation emails are sent to the facility manager, reporter, and active LGA administrators in the relevant hierarchy. Escalation emails are sent to the administrators at the next level, the facility manager, reporter, and current ticket owner. Duplicate addresses are removed.

Email is automatically disabled when `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is absent. Ticket creation and escalation still succeed if Resend is unavailable; the failure is written to the ticket activity trail.

During demonstrations, `.demo` login addresses can be redirected to `TEST_EMAIL_TO`. This fallback is enabled by default in development and requires `EMAIL_DEMO_FALLBACK_ENABLED=true` in production. Disable it after replacing demo addresses with real account emails.

Required production environment variables:

```text
APP_URL=https://your-vue-app.example.com
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=FEPPM Support <notifications@fempp.erp-55.com.ng>
RESEND_REPLY_TO=support@your-monitored-domain.example
TEST_EMAIL_TO=your-demo-inbox@example.com
EMAIL_DEMO_FALLBACK_ENABLED=true
```

After Resend verifies the sending domain, test delivery locally or on Render:

```powershell
$env:TEST_EMAIL_TO="your-address@example.com"
npm run email:test
```

Use a Resend API key with **Sending access** restricted to the FEPPM sending domain. Never commit the API key to `.env.example` or source control.

Health check: `GET http://localhost:5000/api/v1/health`
