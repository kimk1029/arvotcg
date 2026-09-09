/** Daily refresh: held cards and highest-price candidates, oldest first.
 * At most 500 cards / 30 minutes, one worker, 2-second gap. No history scan.
 * DAILY_SNAPSHOT_DISABLED=1 disables; DAILY_SNAPSHOT_HOUR_KST defaults to 3.
 */
import { prisma } from './prisma.js';
import { kstDayStart } from '../../shared/kst';
import { refreshApparelPrices } from './snkrdunkCatalog.js';

/** 다음 KST `hour`시 정각까지 남은 ms. */
function msUntilNextKstHour(hour: number, now = Date.now()): number {
  let next = kstDayStart(now).getTime() + hour * 3600_000;
  if (next <= now) next += 86_400_000;
  return next - now;
}

/** 배치 진행 상태 — /api/snkrdunk/daily-snapshot-status 로 노출(배포 후 스모크용). */
export const DAILY_SNAPSHOT_STATE = {
  running: false,
  startedAt: null as number | null,
  finishedAt: null as number | null,
  /** 이번 실행에서 처리 대상이었던 카드 수 (오늘 스냅샷 있는 카드 제외). */
  total: 0,
  done: 0,
  recorded: 0,
  failed: 0,
  /** 오늘(KST) 이미 스냅샷이 있어 스킵한 카드 수. */
  skippedToday: 0,
  /** 시간 초과로 처리 못 하고 남긴 카드 수. */
  leftover: 0,
  lastError: null as string | null,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 보유 카드·최고가 후보를 하루 최대 500장 순회. 오늘(KST) 스냅샷이 없는 카드만 스니덩 조회 → 스냅샷 기록.
 * 처리한(시도한) 카드 수를 반환.
 */
export async function runDailyPriceSnapshot({
  delayMs = Number(process.env.DAILY_SNAPSHOT_DELAY_MS) || 2000,
  maxRunMs = Number(process.env.DAILY_SNAPSHOT_MAX_MS) || 30 * 60_000,
}: { delayMs?: number; maxRunMs?: number } = {}): Promise<number> {
  if (DAILY_SNAPSHOT_STATE.running) return 0; // 겹침 방지
  DAILY_SNAPSHOT_STATE.running = true;
  DAILY_SNAPSHOT_STATE.startedAt = Date.now();
  DAILY_SNAPSHOT_STATE.finishedAt = null;
  DAILY_SNAPSHOT_STATE.done = 0;
  DAILY_SNAPSHOT_STATE.recorded = 0;
  DAILY_SNAPSHOT_STATE.failed = 0;
  DAILY_SNAPSHOT_STATE.leftover = 0;
  DAILY_SNAPSHOT_STATE.lastError = null;

  const deadline = Date.now() + maxRunMs;
  try {
    // Serving table only; bounded daily work, prioritizing held and expensive cards.
    const targets = await prisma.$queryRaw<Array<{ apparelId: number }>>`
      WITH wanted AS (
        SELECT DISTINCT "snkrdunkApparelId" AS "apparelId" FROM user_cards WHERE "snkrdunkApparelId" IS NOT NULL
        UNION
        SELECT "apparelId" FROM (
          SELECT "apparelId" FROM snkrdunk_current_prices ORDER BY "representativePrice" DESC LIMIT 120
        ) expensive
      )
      SELECT w."apparelId" FROM wanted w LEFT JOIN snkrdunk_current_prices p USING ("apparelId")
      WHERE p."fetchedAt" IS NULL OR p."fetchedAt" < NOW() - INTERVAL '24 hours'
      ORDER BY p."fetchedAt" ASC NULLS FIRST, w."apparelId" LIMIT 500`;
    const pending = targets.map(r => r.apparelId);
    DAILY_SNAPSHOT_STATE.skippedToday = 0;
    DAILY_SNAPSHOT_STATE.total = pending.length;

    for (const apparelId of pending) {
      if (Date.now() > deadline) {
        DAILY_SNAPSHOT_STATE.leftover = pending.length - DAILY_SNAPSHOT_STATE.done;
        console.warn(
          `[dailySnapshot] time budget exceeded — ${DAILY_SNAPSHOT_STATE.leftover} cards left for tomorrow`,
        );
        break;
      }
      try {
        const result = await refreshApparelPrices(apparelId);
        if (result) DAILY_SNAPSHOT_STATE.recorded += 1;
        else DAILY_SNAPSHOT_STATE.failed += 1;
      } catch (err) {
        DAILY_SNAPSHOT_STATE.failed += 1;
        DAILY_SNAPSHOT_STATE.lastError = err instanceof Error ? err.message : String(err);
      }
      DAILY_SNAPSHOT_STATE.done += 1;
      if (DAILY_SNAPSHOT_STATE.done % 200 === 0) {
        console.log(
          `[dailySnapshot] ${DAILY_SNAPSHOT_STATE.done}/${pending.length} (recorded ${DAILY_SNAPSHOT_STATE.recorded}, failed ${DAILY_SNAPSHOT_STATE.failed})`,
        );
      }
      await sleep(delayMs);
    }
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

/**
 * 서버 부팅 시 1회 호출.
 *  - 매일 DAILY_SNAPSHOT_HOUR_KST 시(기본 새벽 3시 KST) 정각에 실행.
 *  - 부팅 5분 후 캐치업 1회: 오늘 실행 시각이 이미 지났으면 곧바로 순회 시작
 *    (오늘 스냅샷 있는 카드는 스킵되므로 이미 돌았던 날엔 사실상 no-op).
 */
export function startDailyPriceSnapshotScheduler(): void {
  if (process.env.DAILY_SNAPSHOT_DISABLED === '1') {
    console.log('[dailySnapshot] disabled (DAILY_SNAPSHOT_DISABLED=1)');
    return;
  }
  if (scheduled) return;
  scheduled = true;

  const hourRaw = Number(process.env.DAILY_SNAPSHOT_HOUR_KST);
  const hour = Number.isInteger(hourRaw) && hourRaw >= 0 && hourRaw <= 23 ? hourRaw : 3;

  // 매일 정각 실행 — setInterval(24h) 은 드리프트가 쌓이므로 체인 setTimeout 으로
  // 매번 "다음 KST 정각"을 다시 계산한다.
  const scheduleNext = () => {
    const waitMs = msUntilNextKstHour(hour);
    const t = setTimeout(async () => {
      await runDailyPriceSnapshot();
      scheduleNext();
    }, waitMs);
    if (typeof t.unref === 'function') t.unref();
    console.log(`[dailySnapshot] next run in ${Math.round(waitMs / 60_000)}m (daily ${hour}:00 KST)`);
  };
  scheduleNext();

  // 부팅 캐치업 — 예정 시각(새벽)에 서버가 죽어 있었어도 오늘치 공백을 메운다.
  const bootT = setTimeout(() => {
    const todayRunAt = kstDayStart().getTime() + hour * 3600_000;
    if (Date.now() >= todayRunAt) void runDailyPriceSnapshot();
  }, 5 * 60_000);
  if (typeof bootT.unref === 'function') bootT.unref();
}
