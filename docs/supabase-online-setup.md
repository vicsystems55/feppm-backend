# Supabase online setup checkpoint

Create the online Supabase project **now**, before running the production PostgreSQL baseline or importing the MySQL data.

## 1. Create the project

1. Sign in to the Supabase dashboard and create a new project.
2. Use a clear name such as `feppm-production`.
3. Generate a strong database password and save it in a password manager. It cannot be recovered from the FEPPM repository.
4. Choose the region closest to the Render backend region. Backend-to-database latency matters more than the user's physical location because Vue and Flutter call the Node API.
5. Wait until project provisioning completes.

Do not create FEPPM tables manually in Supabase. Prisma will create the complete schema from the PostgreSQL baseline.

## 2. Copy, but do not share, the connection values

Open the project's **Connect** panel and save these values locally:

- **Session pooler**, port `5432`: use for `DATABASE_URL` on the persistent Render service. It supports IPv4.
- **Direct connection**, port `5432`: prefer for `DIRECT_URL` when the machine running migrations has IPv6 connectivity.
- If the direct endpoint is unreachable, use the **Session pooler** for `DIRECT_URL` as well.

Both URLs must use TLS (`sslmode=require`). Copy the values shown by Supabase rather than constructing the host or username manually.

```env
# Runtime: exact Session pooler URL copied from Supabase Connect.
DATABASE_URL="postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require&schema=public"

# Migration: exact Direct URL, or Session pooler if Direct/IPv6 is unreachable.
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require&schema=public"
```

Place the real values only in the backend `.env` while testing and later in Render's environment settings. Never put them in `.env.example`, a screenshot, chat, or Git.

Also retain the following values for the later Realtime phase, but do not add them to Vue or Flutter yet:

- Project URL
- Publishable/anon key

Never expose the Supabase database password or `service_role` key in Vue or Flutter.

## 3. Stop before importing

After placing the connection strings in the local backend `.env`, first run only:

```powershell
npm run prisma:status
```

You can also perform the FEPPM read-only identity check:

```powershell
npm run supabase:check
```

It reports only the database name and available FEPPM schemas; it never prints the URL, username, or password.

For a new project, Prisma should report that the PostgreSQL baseline has not yet been applied. At that point FEPPM is ready for the controlled online migration sequence. Do not run the seeders and do not change Render yet.

## 4. Controlled online migration sequence

The next assisted sequence will be:

1. verify the Supabase host and database identity;
2. apply `npm run prisma:deploy` to the empty Supabase project;
3. temporarily stop writes to the MySQL production source;
4. run `migration:prepare-mysql` and `migration:mysql-to-postgres`;
5. validate all 67 model counts and application endpoints;
6. update Render's `DATABASE_URL` and `DIRECT_URL`;
7. deploy and verify production;
8. retain MySQL read-only as the rollback source.

Configure the source separately. Never replace the Supabase `DATABASE_URL` with the old MySQL URL:

```env
MYSQL_SOURCE_URL="mysql://SOURCE_USER:SOURCE_PASSWORD@SOURCE_HOST:3306/SOURCE_DATABASE"
```

The importer restricts itself to one MySQL connection to remain within small managed-database connection limits.

## 5. Realtime comes after database cutover

Do not enable broad public table subscriptions during initial setup. After the Node API is stable on Supabase, FEPPM will add private Realtime Broadcast triggers and authorization policies for a small set of events, initially notifications, task changes, ticket changes, and chat messages. The existing FEPPM JWT roles and administrative scopes must be mapped into Supabase authorization before Vue or Flutter subscribes.
