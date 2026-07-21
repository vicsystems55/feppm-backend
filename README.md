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

Health check: `GET http://localhost:5000/api/v1/health`
