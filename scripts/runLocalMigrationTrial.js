import 'dotenv/config';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const targetDatabase = process.env.MIGRATION_TARGET_DATABASE || 'feppm_migration_test';
const psqlPath = process.env.PSQL_PATH
  || (process.platform === 'win32'
    ? 'C:/Program Files/PostgreSQL/18/bin/psql.exe'
    : 'psql');

if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(targetDatabase)) {
  throw new Error('MIGRATION_TARGET_DATABASE must be a safe PostgreSQL database name.');
}

const directUrl = new URL(process.env.DIRECT_URL);
if (!['127.0.0.1', 'localhost'].includes(directUrl.hostname)) {
  throw new Error('The migration trial can only provision a local PostgreSQL target.');
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    env: { ...process.env, ...options.env },
    encoding: options.encoding,
    shell: options.shell ?? false,
    stdio: options.stdio ?? 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}

const postgresEnvironment = {
  PGPASSWORD: decodeURIComponent(directUrl.password),
};
const connectionArguments = [
  '--host', directUrl.hostname,
  '--port', directUrl.port || '5432',
  '--username', decodeURIComponent(directUrl.username),
  '--dbname', 'postgres',
  '--no-password',
  '--tuples-only',
  '--no-align',
];
const exists = run(
  psqlPath,
  [...connectionArguments, '--command', `SELECT 1 FROM pg_database WHERE datname = '${targetDatabase}'`],
  { env: postgresEnvironment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
).trim() === '1';

const resetTarget = String(process.env.MIGRATION_RESET_TARGET ?? 'false').toLowerCase() === 'true';
if (exists && resetTarget) {
  const configuredDatabase = new URL(process.env.DIRECT_URL).pathname.slice(1);
  if (targetDatabase === configuredDatabase || !targetDatabase.endsWith('_migration_test')) {
    throw new Error('Refusing to reset a database that is not an isolated migration-test target.');
  }
  run(
    psqlPath,
    [
      ...connectionArguments,
      '--command',
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${targetDatabase}' AND pid <> pg_backend_pid()`,
    ],
    { env: postgresEnvironment },
  );
  run(
    psqlPath,
    [...connectionArguments, '--command', `DROP DATABASE "${targetDatabase}"`],
    { env: postgresEnvironment },
  );
  console.log(`Reset isolated PostgreSQL database ${targetDatabase}.`);
}

if (!exists || resetTarget) {
  run(
    psqlPath,
    [...connectionArguments, '--command', `CREATE DATABASE "${targetDatabase}"`],
    { env: postgresEnvironment },
  );
  console.log(`Created local PostgreSQL database ${targetDatabase}.`);
} else {
  console.log(`Using existing local PostgreSQL database ${targetDatabase}.`);
}

const targetUrl = new URL(process.env.DATABASE_URL);
targetUrl.pathname = `/${targetDatabase}`;
directUrl.pathname = `/${targetDatabase}`;
const migrationEnvironment = {
  DATABASE_URL: targetUrl.toString(),
  DIRECT_URL: directUrl.toString(),
  MYSQL_SOURCE_URL: process.env.MYSQL_SOURCE_URL || 'mysql://root:@127.0.0.1:3306/feppm',
};
const runner = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const commandShell = process.platform === 'win32';
run(runner, ['run', 'prisma:deploy'], { env: migrationEnvironment, shell: commandShell });
run(runner, ['run', 'migration:prepare-mysql'], { env: migrationEnvironment, shell: commandShell });
run(runner, ['run', 'migration:mysql-to-postgres'], { env: migrationEnvironment, shell: commandShell });

console.log(`Local migration trial completed in ${targetDatabase}.`);
