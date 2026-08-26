/**
 * 일일 시세 스냅샷 배치 — 매일 정해진 시각(KST)에 카탈로그(snkrdunk_cards) 전체를
 * 순회하며 카드별 풀 스냅샷(싱글/PSA10·9·8/추이)을 SnkrdunkPriceSnapshot 에 append.
 *
 * 목적: 사용자가 조회한 카드만 기회주의적으로 쌓이던 히스토리를 "전 카탈로그 × 매일
 * 최소 1개"로 보장 → 일별/주별/월별 평균 등 가격 통계의 데이터 공백 제거.
 *
 * 설계:
 *  - 오늘(KST) 이미 유효 스냅샷이 있는 카드는 스킵 → 멱등. 서버가 도중 재시작해도
 *    부팅 캐치업이 남은 카드만 이어서 처리하고, 사용자 조회로 생긴 스냅샷과도 중복 없음.
 *  - 카드당 apparel+sales-history+sales-chart 3콜 → 순차 처리 + 카드 간 딜레이로
 *    스니덩 부하 제한. 최대 실행시간 초과 시 중단(다음날 이어감).
 *  - priceAlerts 와 같은 단일 인스턴스 setInterval 방식 (별도 크론 인프라 없음).
 *
 * env:
 *  - DAILY_SNAPSHOT_DISABLED=1  배치 끔
 *  - DAILY_SNAPSHOT_HOUR_KST    실행 시각(0-23, 기본 3 = 새벽 3시 KST)
 *  - DAILY_SNAPSHOT_DELAY_MS    카드 간 딜레이(기본 700ms)
 *  - DAILY_SNAPSHOT_MAX_MS      1회 최대 실행시간(기본 6시간)
 */
import { prisma } from './prisma.js';
import { kstDayStart } from '../../shared/kst';
import { recordPriceSnapshot } from './snkrdunkCatalog.js';
import {
  fetchSnkrdunkApparel,
  fetchSnkrdunkSalesHistory,
  fetchSnkrdunkSalesChart,
} from '@/lib/snkrdunk';
import { computeApparelPrices, headlineFromHistory } from '../../shared/snkrdunkPrice';

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
 * 카탈로그 전체 1회 순회. 오늘(KST) 스냅샷이 없는 카드만 스니덩 조회 → 스냅샷 기록.
 * 처리한(시도한) 카드 수를 반환.
 */
export async function runDailyPriceSnapshot({
  delayMs = Number(process.env.DAILY_SNAPSHOT_DELAY_MS) || 700,
  maxRunMs = Number(process.env.DAILY_SNAPSHOT_MAX_MS) || 6 * 3600_000,
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
    const [cards, doneToday] = await Promise.all([
      prisma.snkrdunkCard.findMany({
        select: { apparelId: true },
        orderBy: { apparelId: 'asc' },
      }),
      // 오늘(KST) 유효 가격이 하나라도 기록된 카드 — 배치 재실행/사용자 조회분 모두 스킵.
      prisma.snkrdunkPriceSnapshot.findMany({
        where: {
          fetchedAt: { gte: kstDayStart() },
          OR: [{ priceSingle: { gt: 0 } }, { minPrice: { gt: 0 } }],
        },
        select: { apparelId: true },
        distinct: ['apparelId'],
      }),
    ]);
    const doneSet = new Set(doneToday.map((s) => s.apparelId));
    const pending = cards.map((c) => c.apparelId).filter((id) => !doneSet.has(id));
    DAILY_SNAPSHOT_STATE.skippedToday = cards.length - pending.length;
    DAILY_SNAPSHOT_STATE.total = pending.length;
    console.log(
      `[dailySnapshot] start: ${pending.length} pending / ${cards.length} catalog (${doneSet.size} fresh today)`,
    );

    for (const apparelId of pending) {
      if (Date.now() > deadline) {
        DAILY_SNAPSHOT_STATE.leftover = pending.length - DAILY_SNAPSHOT_STATE.done;
        console.warn(
          `[dailySnapshot] time budget exceeded — ${DAILY_SNAPSHOT_STATE.leftover} cards left for tomorrow`,
        );
        break;
      }
      try {
        const [a, hist, chart] = await Promise.all([
          fetchSnkrdunkApparel(apparelId),
          fetchSnkrdunkSalesHistory(apparelId).catch(() => null),
          fetchSnkrdunkSalesChart(apparelId).catch(() => null),
        ]);
        const minPrice = a?.minPrice ?? 0;
        const prices = computeApparelPrices(hist?.history ?? [], chart?.points ?? [], minPrice);
        // 목록(박스별 카드)이 상세와 같은 값을 보여주도록 대표 시세도 함께 저장.
        const headline = headlineFromHistory(hist?.history ?? [], minPrice);
        if (minPrice > 0 || prices.single > 0 || prices.psa10 > 0) {
          await recordPriceSnapshot(apparelId, {
            minPrice,
            listingCount: a?.listingCount ?? 0,
            headlinePrice: headline.price,
            headlineBasis: headline.basis,
            priceSingle: prices.single,
            pricePsa10: prices.psa10,
            pricePsa9: prices.psa9,
            pricePsa8: prices.psa8,
            trend: prices.trendJpy,
          });
          DAILY_SNAPSHOT_STATE.recorded += 1;
        }
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
