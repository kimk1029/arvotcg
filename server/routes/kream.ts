import { Router, type Request, type Response } from 'express';
import { fetchKreamSearch, kreamRouteState } from '@/lib/kream';

const router = Router();

/**
 * GET /api/kream/search?q=... — KREAM 검색(SSR HTML 스크래핑).
 *
 * Next 라우트(베르셀 실행)로 두면 데이터센터 IP 차단으로 항상 빈 결과가 되므로
 * 이 경로는 rewrite 로 이 Express 서버에 프록시한다. 서버는 자기 IP 로 먼저 시도하고
 * 차단이면 NAS 릴레이(KREAM_RELAY_ORIGIN)로 폴백 — 캐시/타임아웃/폴백은
 * fetchKreamSearch(@/lib/kream) 내부. `meta` 는 진단용(어느 경로가 살아 있는지).
 */
router.get('/search', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.json({ items: [] });
  const items = await fetchKreamSearch(q);
  res.json({ items, meta: kreamRouteState() });
});

export default router;
