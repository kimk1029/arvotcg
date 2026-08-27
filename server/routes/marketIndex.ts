import { Router, type Request, type Response } from 'express';
import { getMarketIndexes, MARKET_INDEX_STATE } from '../lib/marketIndex.js';

const router = Router();

/**
 * GET /api/market-index — 포트폴리오 '시장 지표' 섹션.
 * 포켓몬(S&Poké 500, 외부 캐시) + 원피스(ARVO OP200, 서버 계산) 시리즈.
 * 응답은 10분 메모리 캐시(server/lib/marketIndex.ts getMarketIndexes).
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const data = await getMarketIndexes();
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({ data });
  } catch (err) {
    console.error('[market-index]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** 빌드 상태 — 배포 후 스모크용. */
router.get('/status', (_req: Request, res: Response) => {
  res.json(MARKET_INDEX_STATE);
});

export default router;
