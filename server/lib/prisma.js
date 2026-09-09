import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl() {
  if (process.env.APP_ENV === 'production' && process.env.DATABASE_URL_PRODUCTION) {
    return process.env.DATABASE_URL_PRODUCTION;
  }
  return process.env.DATABASE_URL;
}

/**
 * 커넥션 풀 상향 — pgbouncer 뒤의 장수 서버는 풀이 작을 이유가 없다.
 * 기본 connection_limit=10 이라 부하가 조금만 몰려도 P2024(pool timeout)로
 * **로그인 콜백까지 실패**했다(2026-09-10). env 에 값이 없을 때만 채운다.
 */
const MIN_POOL = 25;

function withPool(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    const cur = Number(u.searchParams.get('connection_limit'));
    if (!Number.isFinite(cur) || cur < MIN_POOL) {
      u.searchParams.set('connection_limit', String(MIN_POOL));
      if (Number.isFinite(cur)) console.warn(`[prisma] connection_limit ${cur} → ${MIN_POOL} (P2024 방지)`);
    }
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '20');
    return u.toString();
  } catch {
    return url;
  }
}

function buildClient() {
  const url = withPool(resolveDatabaseUrl());
  return url ? new PrismaClient({ datasourceUrl: url }) : new PrismaClient();
}

export const prisma = globalThis.__pf30_prisma ?? buildClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pf30_prisma = prisma;
}
