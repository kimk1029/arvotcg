/**
 * 카드 아트 자체 CDN 캐싱.
 *
 * snkrdunk 원본 이미지를 NAS 디스크에 webp 로 "처음 본 카드만" 1회 받아두고,
 * 이후엔 우리 도메인(/api/cdn/cards/<apparelId>.webp)으로 서빙한다.
 * 핫링크(원본 차단·URL 만료) 의존을 끊고, webp 로 용량/속도를 최적화하는 게 목적.
 *
 * 정책:
 *   - lazy: 전체 시드 없이, 카드가 조회/검색될 때 백그라운드로 한 장씩 캐싱.
 *   - fire-and-forget: 응답을 막지 않는다. 모든 실패는 로깅만.
 *   - 멱등: 파일이 이미 있으면 네트워크 없이 DB(cdnImageUrl)만 보정.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { prisma } from './prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** webp 캐시 루트. server/public/cdn → express.static('/api/cdn') 로 노출. */
export const CARD_CDN_DIR = process.env.CARD_CDN_DIR || join(__dirname, '../public/cdn');
const CARDS_DIR = join(CARD_CDN_DIR, 'cards');

/** 카드 1장의 공개 경로 (상대 — Vercel→NAS 프록시를 그대로 통과). */
function publicUrl(apparelId) {
  return `/api/cdn/cards/${apparelId}.webp`;
}

function filePath(apparelId) {
  return join(CARDS_DIR, `${apparelId}.webp`);
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** 동시 중복 다운로드 방지(같은 카드 동시 조회). */
const inFlight = new Set();

/**
 * 파일도 있고 DB cdnImageUrl 도 이미 채워진 게 확인된 카드 — 더 볼 일이 없다.
 *
 * 이게 없을 때 ensureCardImage 는 캐시가 이미 끝난 카드에도 매번 보정 UPDATE 를 던졌다.
 * 검색·목록 렌더마다 카드 수만큼 발사돼 누적 62만 건(전체 쓰기 1위)이 됐는데, 그중
 * 대부분은 아무것도 바꾸지 않는 빈 UPDATE 였다. (2026-09-10 부하 점검)
 */
const settled = new Set();
/** 프로세스가 오래 떠 있어도 무한정 커지지 않게 — 카탈로그(1.8만장) 규모의 여유값. */
const SETTLED_MAX = 50_000;
function markSettled(apparelId) {
  if (settled.size >= SETTLED_MAX) settled.clear();
  settled.add(apparelId);
}

/**
 * apparelId 의 원본 이미지를 webp 로 캐싱하고 DB cdnImageUrl 을 채운다.
 * await 불필요 — `void ensureCardImage(...)` 로 호출.
 *
 * @param {number} apparelId
 * @param {string | null | undefined} sourceUrl snkrdunk 원본 이미지 URL
 */
export async function ensureCardImage(apparelId, sourceUrl) {
  if (!apparelId || !sourceUrl) return;
  if (settled.has(apparelId)) return; // 파일·DB 둘 다 확인된 카드 — DB 를 치지 않는다.
  if (inFlight.has(apparelId)) return;
  inFlight.add(apparelId);
  try {
    const dest = filePath(apparelId);
    const url = publicUrl(apparelId);

    // 이미 캐싱돼 있으면 다운로드 생략 — DB 가 비어있을 때만 보정.
    if (await exists(dest)) {
      // 보정이 필요한지 먼저 읽고(PK 조회), 실제로 비어있을 때만 쓴다.
      const row = await prisma.snkrdunkCard
        .findUnique({ where: { apparelId }, select: { cdnImageUrl: true } })
        .catch(() => null);
      if (row && row.cdnImageUrl !== url) {
        await prisma.snkrdunkCard
          .updateMany({ where: { apparelId, cdnImageUrl: null }, data: { cdnImageUrl: url } })
          .catch(() => {});
      }
      if (row) markSettled(apparelId);
      return;
    }

    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`source ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());

    const webp = await sharp(input)
      .resize({ width: 720, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    await mkdir(CARDS_DIR, { recursive: true });
    await writeFile(dest, webp);

    // 행이 아직 없을 수 있어(upsert 와의 경쟁) updateMany — 없으면 0건, 다음 조회에서 보정.
    const n = await prisma.snkrdunkCard
      .updateMany({ where: { apparelId }, data: { cdnImageUrl: url } })
      .catch(() => null);
    if (n && n.count > 0) markSettled(apparelId);
  } catch (err) {
    console.error('[cardImageCache]', apparelId, err?.message || err);
  } finally {
    inFlight.delete(apparelId);
  }
}

/** 이미 캐싱된 카드의 공개 URL (없으면 null). 단일 PK 조회 — 핫패스 안전. */
export async function getCachedCardImageUrl(apparelId) {
  try {
    const row = await prisma.snkrdunkCard.findUnique({
      where: { apparelId },
      select: { cdnImageUrl: true },
    });
    return row?.cdnImageUrl ?? null;
  } catch {
    return null;
  }
}

/* ── 일괄 워밍 (카탈로그 backfill) ───────────────────────────────── */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 워밍 진행 상태 (어드민 상태표시용, 인메모리). */
const WARM = { running: false, total: 0, done: 0, failed: 0, startedAt: null, finishedAt: null };

export function getWarmState() {
  return { ...WARM };
}

/**
 * 카탈로그에서 cdnImageUrl 이 비어있는(미캐싱) 카드를 throttle 걸어 일괄 워밍.
 * concurrency 동시 + 배치 사이 delay 로 스니덩 부담 최소화. 중복 실행 가드.
 * lazy 캐싱이 인기 카드를 이미 덮으므로 이건 롱테일을 채운다.
 *
 * @param {{limit?:number, concurrency?:number, batchDelayMs?:number, missingOnly?:boolean}} opts
 */
export async function warmCatalogImages(opts = {}) {
  const { limit = 200, concurrency = 3, batchDelayMs = 300, missingOnly = true } = opts;
  if (WARM.running) return { ...WARM, skipped: true };

  let cards;
  try {
    cards = await prisma.snkrdunkCard.findMany({
      where: missingOnly
        ? { cdnImageUrl: null, imageUrl: { not: null } }
        : { imageUrl: { not: null } },
      select: { apparelId: true, imageUrl: true },
      orderBy: { updatedAt: 'desc' }, // 최근 갱신(=인기) 카드 우선
      take: Math.max(1, Math.min(5000, limit)),
    });
  } catch (err) {
    console.error('[cardImageCache.warm] query', err?.message || err);
    return { ...WARM, error: true };
  }

  WARM.running = true;
  WARM.total = cards.length;
  WARM.done = 0;
  WARM.failed = 0;
  WARM.startedAt = Date.now();
  WARM.finishedAt = null;
  console.log(`[cardImageCache.warm] start: ${cards.length} cards (conc ${concurrency})`);

  try {
    for (let i = 0; i < cards.length; i += concurrency) {
      const batch = cards.slice(i, i + concurrency);
      await Promise.all(
        batch.map((c) =>
          ensureCardImage(c.apparelId, c.imageUrl)
            .then(() => {
              WARM.done += 1;
            })
            .catch(() => {
              WARM.failed += 1;
            }),
        ),
      );
      if (i + concurrency < cards.length) await sleep(batchDelayMs);
    }
  } finally {
    WARM.running = false;
    WARM.finishedAt = Date.now();
    console.log(`[cardImageCache.warm] done: ${WARM.done} ok / ${WARM.failed} fail`);
  }
  return { ...WARM };
}

/**
 * 부팅 후 + 매일 1회, 미캐싱 카드를 bounded 하게 점진 워밍.
 * CARD_WARM_DISABLED=1 로 끄고, CARD_WARM_BATCH 로 1회 처리량 조절.
 */
let warmTimer = null;
export function startCardImageWarmer({
  intervalMs = 24 * 60 * 60_000,
  bootDelayMs = 90_000,
} = {}) {
  if (process.env.CARD_WARM_DISABLED === '1') {
    console.log('[cardImageCache.warm] disabled (CARD_WARM_DISABLED=1)');
    return;
  }
  if (warmTimer) return;
  const batchLimit = Number(process.env.CARD_WARM_BATCH) || 200;
  setTimeout(() => void warmCatalogImages({ limit: batchLimit }), bootDelayMs);
  warmTimer = setInterval(() => void warmCatalogImages({ limit: batchLimit }), intervalMs);
  if (typeof warmTimer.unref === 'function') warmTimer.unref();
  console.log(`[cardImageCache.warm] scheduler started (daily, ${batchLimit}/run)`);
}
