/**
 * 컬렉션 카드 DB 보증 백필.
 *
 * 정책: **사용자 컬렉션에 담긴 카드는 예외 없이 우리 DB(SnkrdunkCard + 시세
 * 스냅샷)에 있어야 한다.** 그래야 컬렉션 화면이 스니덩 스크레이핑을 기다리지
 * 않고 DB 만으로 즉시 뜬다([[getMyCardsWithPrices]] 의 blocking 경로 제거).
 *
 * 등록 시점에 ensureCatalogCard 로 채우지만, 구버전 앱으로 담긴 카드나 등록
 * 당시 스니덩 장애로 빠진 카드가 남는다. 부팅 후 1회 + 주기적으로 그 공백만
 * 골라 천천히 메운다 (스니덩 부하를 피해 순차 + 딜레이).
 */
import { prisma } from './prisma.js';
import { refreshApparelPrices } from './snkrdunkCatalog.js';

/** 한 번에 메울 최대 카드 수 — 스니덩 호출 폭주 방지. */
const BATCH_LIMIT = 60;
/** 카드 간 간격(ms). */
const GAP_MS = 1500;
/** 주기 — 기본 6시간. */
const INTERVAL_MS = 6 * 60 * 60 * 1000;

let running = false;
let scheduled = false;

/** 컬렉션에 있으나 시세 스냅샷이 없는 apparelId 목록. */
async function findGaps(limit: number): Promise<number[]> {
  const rows = await prisma.$queryRaw<Array<{ apparelId: number }>>`
    SELECT DISTINCT uc."snkrdunkApparelId" AS "apparelId"
    FROM "user_cards" uc
    WHERE uc."snkrdunkApparelId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "snkrdunk_price_snapshots" s
        WHERE s."apparelId" = uc."snkrdunkApparelId"
      )
    LIMIT ${limit}
  `;
  return rows.map((r) => Number(r.apparelId)).filter((n) => Number.isInteger(n) && n > 0);
}

/** 공백 카드들을 순차로 적재. 실패는 건너뛰고 다음 주기에 다시 시도한다. */
export async function runCollectionBackfill(limit = BATCH_LIMIT): Promise<{ filled: number; remaining: number }> {
  if (running) return { filled: 0, remaining: -1 };
  running = true;
  let filled = 0;
  try {
    const ids = await findGaps(limit);
    if (ids.length === 0) return { filled: 0, remaining: 0 };
    console.log(`[collectionBackfill] ${ids.length}장 적재 시작`);
    for (const id of ids) {
      const r = await refreshApparelPrices(id).catch(() => null);
      if (r) filled += 1;
      await new Promise((resolve) => setTimeout(resolve, GAP_MS));
    }
    const remaining = (await findGaps(1)).length;
    console.log(`[collectionBackfill] ${filled}/${ids.length}장 적재 완료 (남음=${remaining > 0 ? '있음' : '없음'})`);
    return { filled, remaining };
  } catch (err) {
    console.error('[collectionBackfill]', err);
    return { filled, remaining: -1 };
  } finally {
    running = false;
  }
}

/** 서버 부팅 시 1회 호출 — 2분 뒤 첫 실행, 이후 6시간 주기. */
export function startCollectionBackfill(): void {
  if (scheduled) return;
  scheduled = true;
  const boot = setTimeout(() => void runCollectionBackfill(), 2 * 60_000);
  if (typeof boot.unref === 'function') boot.unref();
  const timer = setInterval(() => void runCollectionBackfill(), INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
}
