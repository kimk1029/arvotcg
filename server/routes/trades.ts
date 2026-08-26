import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/requireAuth.js';
import { defaultNameFor } from '../lib/defaultName.js';
import { getTradeById, getTrades } from '../lib/queries.js';
import { REWARDS } from '../../shared/rewards';
import { adjustPoints } from '../lib/pointLog.js';

const MAX_LIMIT = 100;
const MAX_BUMPS = 3;
const TRADE_TYPES = ['buy', 'sell'] as const;
const TRADE_STATUSES = ['open', 'reserved', 'done', 'cancelled'] as const;
type TradeStatus = (typeof TRADE_STATUSES)[number];

const router = Router();

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

router.get('/', optionalAuth, async (req: Request, res: Response) => {
  const limitRaw = Number(req.query.limit ?? 60);
  const limit = Math.min(Number.isFinite(limitRaw) ? limitRaw : 60, MAX_LIMIT);
  const type = typeof req.query.type === 'string' ? req.query.type : null;
  const filter = type && (TRADE_TYPES as readonly string[]).includes(type)
    ? (type as 'buy' | 'sell')
    : 'all';
  try {
    const data = await getTrades(filter, limit, req.user?.userId ?? null);
    res.json({ data });
  } catch (err) {
    console.error('[trades.GET]', err);
    res.status(500).json({ data: [], error: 'db_unavailable' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const body = (req.body ?? {}) as {
    placeId?: string;
    type?: string;
    title?: string;
    body?: string;
    price?: string;
    kakaoId?: string;
    avatarId?: string;
    images?: string[];
  };
  const { placeId, type, title, body: content, price, kakaoId, avatarId } = body;
  if (!placeId) return res.status(400).json({ error: 'placeId required' });
  if (!type || !(TRADE_TYPES as readonly string[]).includes(type)) {
    return res.status(400).json({ error: 'invalid type' });
  }
  if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
  const images = Array.isArray(body.images)
    ? body.images.filter((u): u is string => typeof u === 'string' && u.length > 0).slice(0, 5)
    : [];
  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: defaultNameFor(userId) },
    });
    const u = await prisma.user
      .findUnique({ where: { id: userId }, select: { backgroundId: true, frameId: true } })
      .catch(() => null);
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.trade.create({
        data: {
          placeId,
          type,
          title: title.trim(),
          body: content?.trim() ?? '',
          price: price?.trim() || '제안',
          kakaoId: kakaoId?.trim() || null,
          authorId: userId,
          authorEmoji: avatarId ?? req.user!.name?.slice(0, 2) ?? '익명',
          authorBgId: u?.backgroundId ?? 'default',
          authorFrameId: u?.frameId ?? 'none',
          bumpedAt: new Date(),
          images: images.length > 0 ? (images as unknown as object) : undefined,
        },
      });
      await adjustPoints(tx, userId, REWARDS.trade_post, 'trade_post', {
        type: 'trade',
        id: String(row.id),
      });
      return row;
    });
    res.status(201).json({ data: created });
  } catch (err) {
    console.error('[trades.POST]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  try {
    // raw Prisma 행(place 가 객체, time/authorName 없음)을 그대로 주면
    // 웹 상세 페이지가 place 객체를 렌더하다 크래시 — 목록과 동일하게 가공해 반환
    const row = await getTradeById(id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json({ data: row });
  } catch (err) {
    console.error('[trades.GET id]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  const input = (req.body ?? {}) as {
    title?: string;
    body?: string;
    price?: string;
    type?: string;
    placeId?: string;
  };
  const data: Prisma.TradeUpdateInput = {};
  if (typeof input.title === 'string') {
    const t = input.title.trim();
    if (!t) return res.status(400).json({ error: 'title empty' });
    data.title = t;
  }
  if (typeof input.body === 'string') data.body = input.body.trim();
  if (typeof input.price === 'string') data.price = input.price.trim() || '제안';
  if (typeof input.type === 'string') {
    if (!(TRADE_TYPES as readonly string[]).includes(input.type)) {
      return res.status(400).json({ error: 'invalid type' });
    }
    data.type = input.type;
  }
  if (typeof input.placeId === 'string' && input.placeId) {
    data.place = { connect: { id: input.placeId } };
  }
  try {
    const trade = await prisma.trade.findUnique({ where: { id }, select: { authorId: true } });
    if (!trade) return res.status(404).json({ error: 'not found' });
    if (trade.authorId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    const updated = await prisma.trade.update({ where: { id }, data });
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'not found' });
    }
    console.error('[trades.PATCH]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  try {
    const trade = await prisma.trade.findUnique({ where: { id }, select: { authorId: true } });
    if (!trade) return res.status(404).json({ error: 'not found' });
    if (trade.authorId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    await prisma.trade.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'not found' });
    }
    console.error('[trades.DELETE]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// 작성자가 거래글에 inbound 쪽지를 받은 적이 있는지 (거래완료 버튼 활성화용)
router.get('/:id/inbound-check', requireAuth, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  try {
    const trade = await prisma.trade.findUnique({ where: { id }, select: { authorId: true } });
    if (!trade) return res.status(404).json({ error: 'not found' });
    if (trade.authorId !== req.user!.userId) {
      return res.json({ hasInboundMessage: false });
    }
    const msg = await prisma.message.findFirst({
      where: { tradeId: id, receiverId: req.user!.userId },
      select: { id: true },
    });
    res.json({ hasInboundMessage: !!msg });
  } catch (err) {
    console.error('[trades.inbound-check]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/:id/bump', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const tradeId = parseId(req.params.id);
  if (tradeId === null) return res.status(400).json({ error: 'Invalid id' });
  try {
    const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
    if (!trade) return res.status(404).json({ error: 'Not found' });
    if (trade.authorId !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (trade.bumpCount >= MAX_BUMPS) {
      return res.status(400).json({ error: 'MAX_BUMPS', remaining: 0 });
    }
    const updated = await prisma.trade.update({
      where: { id: tradeId },
      data: { bumpCount: { increment: 1 }, bumpedAt: new Date() },
    });
    res.json({ bumpCount: updated.bumpCount, remaining: MAX_BUMPS - updated.bumpCount });
  } catch (err) {
    console.error('[trades.bump]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.patch('/:id/status', requireAuth, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  const status = (req.body as { status?: string } | null)?.status;
  if (!status || !(TRADE_STATUSES as readonly string[]).includes(status)) {
    return res
      .status(400)
      .json({ error: `invalid status. allowed: ${TRADE_STATUSES.join(',')}` });
  }
  try {
    const before = await prisma.trade.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'not found' });
    if (before.authorId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });

    const becameDone = status === 'done' && before.status !== 'done';
    if (becameDone && before.authorId) {
      const inboundMsg = await prisma.message.findFirst({
        where: { tradeId: id, receiverId: before.authorId },
        select: { id: true },
      });
      if (!inboundMsg) {
        return res.status(409).json({
          error:
            '아직 쪽지를 받은 적이 없어 완료 처리할 수 없어요. 구매자와 쪽지를 먼저 주고받아 주세요.',
        });
      }
    }
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.trade.update({ where: { id }, data: { status: status as TradeStatus } });
      if (becameDone && before.authorId) {
        await adjustPoints(tx, before.authorId, REWARDS.trade_done, 'trade_done', {
          type: 'trade',
          id: String(id),
        });
      }
      return row;
    });
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'not found' });
    }
    console.error('[trades.status]', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
