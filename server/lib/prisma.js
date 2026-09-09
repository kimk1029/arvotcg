import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl() {
  if (process.env.APP_ENV === 'production' && process.env.DATABASE_URL_PRODUCTION) {
    return process.env.DATABASE_URL_PRODUCTION;
  }
  return process.env.DATABASE_URL;
}

function buildClient() {
  const url = resolveDatabaseUrl();
  return url ? new PrismaClient({ datasourceUrl: url }) : new PrismaClient();
}

export const prisma = globalThis.__pf30_prisma ?? buildClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pf30_prisma = prisma;
}
