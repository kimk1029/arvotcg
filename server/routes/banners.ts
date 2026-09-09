import { Router, type Request, type Response } from 'express';
import { getActiveHeroBanners, getHeroAutoplayMs } from '../lib/queries.js';

const router = Router();

/* 홈 진입마다 배너 2쿼리(heroBanner.findMany + siteSetting.findUnique)가 돌아
 * 커넥션 풀 상위 소비처였다 — 어드민이 바꿔도 1분이면 반영되므로 메모리 캐시로 충분. */
const CACHE_TTL_MS = 60_000;
let cache: { at: number; data: Awaited<ReturnType<typeof getActiveHeroBanners>>; autoplayMs: number } | null = null;
let inflight: Promise<{ data: Awaited<ReturnType<typeof getActiveHeroBanners>>; autoplayMs: number }> | null = null;

async function loadBanners() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return { data: cache.data, autoplayMs: cache.autoplayMs };
  // 동시 요청은 한 번만 조회(single-flight) — 캐시가 비는 순간 쿼리가 몰리지 않게.
  if (!inflight) {
    inflight = Promise.all([getActiveHeroBanners(), getHeroAutoplayMs()])
      .then(([data, autoplayMs]) => {
        cache = { at: Date.now(), data, autoplayMs };
        return { data, autoplayMs };
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/**
 * GET /api/banners — 홈 히어로 배너(활성, sortOrder→id 순 — 클라이언트는 이 순서를 그대로 쓴다)
 * + autoplayMs(어드민이 정한 슬라이드 전환 간격, 기본 7초).
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, autoplayMs } = await loadBanners();
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ data, autoplayMs });
  } catch (err) {
    console.error('[banners.GET]', err);
    res.json({ data: cache?.data ?? [], autoplayMs: cache?.autoplayMs ?? 7000 });
  }
});

export default router;
