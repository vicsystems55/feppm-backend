import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function pooledDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return databaseUrl;

  const parameters = [];
  if (!/[?&]connection_limit=/.test(databaseUrl)) {
    parameters.push(`connection_limit=${process.env.DATABASE_CONNECTION_LIMIT ?? '2'}`);
  }
  if (!/[?&]pool_timeout=/.test(databaseUrl)) {
    parameters.push(`pool_timeout=${process.env.DATABASE_POOL_TIMEOUT ?? '20'}`);
  }

  if (!parameters.length) return databaseUrl;
  return `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}${parameters.join('&')}`;
}

export const prisma = globalForPrisma.__feppmPrisma ?? new PrismaClient({
  datasourceUrl: pooledDatabaseUrl(),
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__feppmPrisma = prisma;
}
