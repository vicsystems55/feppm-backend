# PostgreSQL and Supabase migration

FEPPM now uses PostgreSQL as its Prisma provider. The former MySQL migrations are retained in `prisma/mysql_migrations_archive` for historical reference; PostgreSQL deployments use the baseline in `prisma/migrations`.

## Connection variables

Keep secrets in `.env` locally and in the hosting platform's environment settings. Never commit real passwords.

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/feppm?schema=public"
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/feppm?schema=public"
MYSQL_SOURCE_URL="mysql://root:@127.0.0.1:3306/feppm"
MIGRATION_BATCH_SIZE=250
```

- `DATABASE_URL` is the application/runtime connection.
- `DIRECT_URL` is the migration connection used by Prisma.
- `MYSQL_SOURCE_URL` is required only while importing the old database.

## Repeat the local migration trial

The trial creates and resets only a local PostgreSQL database whose name ends in `_migration_test`. It refuses remote targets, refuses to reset the configured development database, and never writes to MySQL.

```powershell
$env:MYSQL_SOURCE_URL="mysql://root:@127.0.0.1:3306/feppm"
$env:MIGRATION_RESET_TARGET="true"
npm run migration:trial
```

The importer:

- compares the MySQL and PostgreSQL Prisma models before copying;
- refuses to import into a non-empty target;
- preserves primary keys and timestamps;
- inserts records in relation-safe order;
- restores nullable cyclic relationships after the main copy;
- validates source and target counts for every Prisma model.

## Supabase production cutover

1. Create a new, empty Supabase project and save its database password securely.
2. Take a final MySQL backup before the maintenance window.
3. Pause writes to the existing FEPPM backend. Keep MySQL available as a read-only rollback source.
4. Configure the migration workstation with the source MySQL URL and the new Supabase PostgreSQL URLs.
5. Apply the PostgreSQL baseline:

   ```powershell
   npm run prisma:deploy
   ```

6. Generate the temporary source client and migrate the data:

   ```powershell
   npm run migration:prepare-mysql
   npm run migration:mysql-to-postgres
   ```

7. Confirm that the importer reports matching counts for all models. Then test health, login, scoped facilities, checklists, notifications, tickets, and attachments against Supabase.
8. Update Render's `DATABASE_URL` and `DIRECT_URL`, deploy the backend, and run `npm run prisma:deploy` as the Render pre-deploy command.
9. Verify production before reopening writes. Retain the MySQL backup until the PostgreSQL deployment has been stable and signed off.

Do not run `migration:trial` against Supabase. It is deliberately restricted to disposable local databases.

## Supabase connection choice

For the Render runtime, use the Supabase pooler connection that is reachable from Render. Use the direct database connection for `DIRECT_URL` when its IPv6 route is available; otherwise use the documented session-mode pooler connection for migrations. Keep Prisma's connection limit conservative because server replicas and deploy jobs each consume database connections.

## Realtime phase

Database migration does not automatically make the Vue or Flutter applications realtime. After cutover:

1. Select only the events that need live delivery, initially notifications, task changes, ticket changes, and chat messages.
2. Prefer private Supabase Realtime Broadcast channels with database triggers; this is Supabase's recommended approach for scalability and security.
3. Define Realtime authorization and Row Level Security policies that mirror FEPPM role and scope rules before exposing subscriptions to clients.
4. Decide how the existing FEPPM JWT identity will map to Supabase authorization claims. Until that mapping is implemented, continue using the Node API as the authority and do not expose unrestricted table access.
5. Add subscriptions to Vue and Flutter with normal API refresh as the fallback.
