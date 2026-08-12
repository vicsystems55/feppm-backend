import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const schemas = await prisma.$queryRawUnsafe(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('public', 'feppm') ORDER BY schema_name",
  );
  const [connection] = await prisma.$queryRawUnsafe(
    'SELECT current_database() AS database, current_schema() AS schema',
  );
  const [tableSummary] = await prisma.$queryRawUnsafe(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE table_name <> '_prisma_migrations')::int AS application_tables
     FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_type = 'BASE TABLE'`,
  );
  const [migrationSummary] = await prisma.$queryRawUnsafe(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS applied
     FROM "_prisma_migrations"`,
  );

  console.log('Connected: yes');
  console.log(`Database: ${connection.database}`);
  console.log(`Current schema: ${connection.schema}`);
  console.log(`Available FEPPM schemas: ${schemas.map(({ schema_name: name }) => name).join(', ')}`);
  console.log(`Application tables: ${tableSummary.application_tables}`);
  console.log(`Prisma migrations: ${migrationSummary.applied}/${migrationSummary.total} applied`);
} catch (error) {
  console.error(`Connection check failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
