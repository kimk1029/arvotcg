import { Router, type Request, type Response } from 'express';
import { CARD_PACKS } from '@/lib/cardPacks';
import { getAllPacksWithHits, getPackWithHits } from '../lib/cardPackHits.js';
import { getPacksWithBox } from '../lib/cardPackCatalog.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const withHits = req.query.withHits === '1';
  const limitRaw = Number(req.query.limit ?? 12);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 30) : 12;

  // 시세확인 목록용 — 카탈로그 + 대표 박스 1건 (웹·앱 공통 단일 소스).
  if (req.query.withBox === '1') {
    return res.json({ data: await getPacksWithBox() });
  }

  if (!withHits) {
    return res.json({
      data: CARD_PACKS.map(({ hits: _hits, searchQuery: _q, ...meta }) => meta),
    });
  }
  const data = await getAllPacksWithHits(limit);
  res.json({ data });
});

router.get('/:code', async (req: Request, res: Response) => {
  const limitRaw = Number(req.query.limit ?? 600);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 600) : 600;

  const pack = await getPackWithHits(req.params.code, limit);
  if (!pack) return res.status(404).json({ error: 'pack not found' });
  res.json({ data: pack });
});

export default router;
