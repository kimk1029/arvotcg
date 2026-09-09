import { Router, type Request, type Response } from 'express';
import { getActiveHeroBanners, getHeroAutoplayMs } from '../lib/queries.js';

const router = Router();

/**
 * GET /api/banners — 홈 히어로 배너(활성, sortOrder→id 순 — 클라이언트는 이 순서를 그대로 쓴다)
 * + autoplayMs(어드민이 정한 슬라이드 전환 간격, 기본 7초).
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [data, autoplayMs] = await Promise.all([getActiveHeroBanners(), getHeroAutoplayMs()]);
    res.json({ data, autoplayMs });
  } catch (err) {
    console.error('[banners.GET]', err);
    res.json({ data: [], autoplayMs: await getHeroAutoplayMs().catch(() => 7000) });
  }
});

export default router;
