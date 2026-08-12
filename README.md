# FEPPM Backend

Express and Prisma API for the FEPPM platform.

## Database

FEPPM uses PostgreSQL through Prisma.

- Local development: PostgreSQL 18
- Remote environment: managed Supabase PostgreSQL

Create a local database named `feppm`, then configure both `DATABASE_URL` and `DIRECT_URL` from `.env.example`. `DATABASE_URL` is used by the running API; `DIRECT_URL` is used by Prisma migrations. For local PostgreSQL they may be identical.

The original MySQL migration history is preserved in `prisma/mysql_migrations_archive` for audit and data-transfer work. PostgreSQL and Supabase use the fresh baseline in `prisma/migrations`; do not replay the archived MySQL SQL against PostgreSQL.

For Supabase, use the session pooler connection for the persistent Render API when IPv4 is required. Prefer the direct database connection for Prisma migrations when the deployment environment supports IPv6.

Follow [the online Supabase setup checkpoint](docs/supabase-online-setup.md) before applying the production baseline or importing MySQL data.

## Development

1. Copy `.env.example` to `.env` and update the values.
2. Run `npm install`.
3. Run `npm run prisma:generate`.
4. Run `npm run prisma:deploy`.
5. Run `npm run dev`.

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
