/** Small rolling refresh batches for held cards and highest-price candidates. */
import { prisma } from './prisma.js';
import { Prisma } from '@prisma/client';
import { refreshApparelPrices } from './snkrdunkCatalog.js';
import { PRICE_BATCH_LIMIT, PRICE_BATCH_MAX_MS, PRICE_BATCH_GAP_MS,
  PRICE_BATCH_INTERVAL_MS, nextPriceBatchDelay, processPriceBatch } from '../../shared/priceRefreshPolicy';

// Failed cards cool down for two intervals so they do not monopolize the oldest-first list.
const retryAfter = new Map<number, number>();

/** 배치 진행 상태 — /api/snkrdunk/daily-snapshot-status 로 노출(배포 후 스모크용). */
export const DAILY_SNAPSHOT_STATE = {
  running: false,
  intervalMs: PRICE_BATCH_INTERVAL_MS,
  batchLimit: PRICE_BATCH_LIMIT,
  nextRunAt: null as number | null,
  startedAt: null as number | null,
  finishedAt: null as number | null,
  /** 이번 배치 대상 수 (24시간 이내 수집한 카드 제외). */
  total: 0,
  done: 0,
  recorded: 0,
  failed: 0,
  /** 이전 API 호환용 필드. 현재 배치는 시각 기준으로 대상을 고르므로 0. */
  skippedToday: 0,
  /** 시간 초과로 처리 못 하고 남긴 카드 수. */
  leftover: 0,
  lastError: null as string | null,
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Refresh up to 50 stale cards. Stop after five minutes or three consecutive failures. */
export async function runDailyPriceSnapshot({
  delayMs = PRICE_BATCH_GAP_MS,
  maxRunMs = PRICE_BATCH_MAX_MS,
}: { delayMs?: number; maxRunMs?: number } = {}): Promise<number> {
  if (DAILY_SNAPSHOT_STATE.running) return 0; // 겹침 방지
  DAILY_SNAPSHOT_STATE.running = true;
  DAILY_SNAPSHOT_STATE.startedAt = Date.now();
  DAILY_SNAPSHOT_STATE.finishedAt = null;
  DAILY_SNAPSHOT_STATE.total = 0;
  DAILY_SNAPSHOT_STATE.done = 0;
  DAILY_SNAPSHOT_STATE.recorded = 0;
  DAILY_SNAPSHOT_STATE.failed = 0;
  DAILY_SNAPSHOT_STATE.leftover = 0;
  DAILY_SNAPSHOT_STATE.lastError = null;

  const deadline = Date.now() + Math.min(PRICE_BATCH_MAX_MS, Math.max(1, maxRunMs));
  delayMs = Math.max(PRICE_BATCH_GAP_MS, delayMs);
  try {
    // Serving table only; bounded recurring work, prioritizing held and expensive cards.
    for (const [id, at] of retryAfter) if (Date.now() >= at) retryAfter.delete(id);
    const excluded = [...retryAfter.keys(), 0];
    const targets = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
      return tx.$queryRaw<Array<{ apparelId: number }>>`
      WITH wanted AS (
        SELECT DISTINCT "snkrdunkApparelId" AS "apparelId" FROM user_cards WHERE "snkrdunkApparelId" IS NOT NULL
        UNION
        SELECT "apparelId" FROM (
          SELECT "apparelId" FROM snkrdunk_current_prices ORDER BY "representativePrice" DESC LIMIT 120
        ) expensive
      )
      SELECT w."apparelId" FROM wanted w LEFT JOIN snkrdunk_current_prices p USING ("apparelId")
      WHERE (p."fetchedAt" IS NULL OR p."fetchedAt" < NOW() - INTERVAL '24 hours')
        AND w."apparelId" NOT IN (${Prisma.join(excluded)})
      ORDER BY p."fetchedAt" ASC NULLS FIRST, w."apparelId" LIMIT ${PRICE_BATCH_LIMIT}`;
    }, { maxWait: 1000, timeout: 3000 });
    const pending = targets.map(r => r.apparelId);
    DAILY_SNAPSHOT_STATE.skippedToday = 0;
    DAILY_SNAPSHOT_STATE.total = pending.length;

    await processPriceBatch({
      ids: pending, refresh: refreshApparelPrices, sleep, now: Date.now, deadline, delayMs,
      onResult: (id, result, error) => {
        DAILY_SNAPSHOT_STATE.done++;
        if (result) DAILY_SNAPSHOT_STATE.recorded++;
        else {
          DAILY_SNAPSHOT_STATE.failed++;
          DAILY_SNAPSHOT_STATE.lastError = error instanceof Error ? error.message : 'Price refresh failed';
          retryAfter.set(id, Date.now() + 2 * PRICE_BATCH_INTERVAL_MS);
        }
      },
    });
    DAILY_SNAPSHOT_STATE.leftover = pending.length - DAILY_SNAPSHOT_STATE.done;
    console.log(
      `[dailySnapshot] done: ${DAILY_SNAPSHOT_STATE.recorded} recorded / ${DAILY_SNAPSHOT_STATE.failed} failed / ${DAILY_SNAPSHOT_STATE.done} tried`,
    );
    return DAILY_SNAPSHOT_STATE.done;
  } catch (err) {
    DAILY_SNAPSHOT_STATE.lastError = err instanceof Error ? err.message : String(err);
    console.error('[dailySnapshot.run]', err);
    return DAILY_SNAPSHOT_STATE.done;
  } finally {
    DAILY_SNAPSHOT_STATE.running = false;
    DAILY_SNAPSHOT_STATE.finishedAt = Date.now();
  }
}

let scheduled = false;

/** First batch five minutes after boot, then every half hour. Existing role/disable gates remain. */
export function startDailyPriceSnapshotScheduler(): void {
  if (process.env.DAILY_SNAPSHOT_DISABLED === '1') {
    console.log('[dailySnapshot] disabled (DAILY_SNAPSHOT_DISABLED=1)');
    return;
  }
  if (scheduled) return;
  scheduled = true;
  const schedule = (delay: number) => {
    DAILY_SNAPSHOT_STATE.nextRunAt = Date.now() + delay;
    const timer = setTimeout(async () => {
      await runDailyPriceSnapshot();
      schedule(nextPriceBatchDelay(Date.now()));
    }, delay);
    timer.unref?.();
    console.log(`[dailySnapshot] next batch in ${Math.round(delay / 60_000)}m (max ${PRICE_BATCH_LIMIT} cards)`);
  };
  schedule(5 * 60_000);
}
