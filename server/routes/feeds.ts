import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { defaultNameFor } from '../lib/defaultName.js';
import { getFeedPage } from '../lib/queries.js';
import { REWARDS } from '../../shared/rewards';
import { DEFAULT_FEED_CATEGORY, isFeedCategory } from '../../shared/feedCategories';

const router = Router();

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

router.get('/', async (req: Request, res: Response) => {
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const limitRaw = Number(req.query.limit ?? 20);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 20;

  const page = await getFeedPage({ cursor, limit });
  res.json(page);
});

/* ── 댓글 (피드 상세 펼침 시 노출) ─────────────────────────────── */

router.get('/:id/comments', async (req: Request, res: Response) => {
  const feedId = parseId(req.params.id);
  if (feedId === null) return res.status(400).json({ error: 'invalid id' });
  try {
    const rows = await prisma.feedComment.findMany({
      where: { feedId },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { author: { select: { name: true } } },
    });
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        text: r.text,
        authorName: r.author?.name ?? '트레이너',
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[feeds.comments.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  const feedId = parseId(req.params.id);
  if (feedId === null) return res.status(400).json({ error: 'invalid id' });
  const text = typeof (req.body as { text?: unknown })?.text === 'string'
    ? (req.body as { text: string }).text.trim().slice(0, 300)
    : '';
  if (!text) return res.status(400).json({ error: 'text required' });
  const userId = req.user!.userId;
  try {
    const feed = await prisma.feed.findUnique({ where: { id: feedId }, select: { id: true } });
    if (!feed) return res.status(404).json({ error: 'not found' });
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: defaultNameFor(userId) },
    });
    const created = await prisma.feedComment.create({
      data: { feedId, authorId: userId, text },
      include: { author: { select: { name: true } } },
    });
    res.status(201).json({
      data: {
        id: created.id,
        text: created.text,
        authorName: created.author?.name ?? '트레이너',
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[feeds.comments.POST]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    text?: string;
    avatarId?: string;
    images?: string[];
    category?: string;
  };
  const text = body.text?.trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  const category = isFeedCategory(body.category) ? body.category : DEFAULT_FEED_CATEGORY;
  const images = Array.isArray(body.images)
    ? body.images.filter((u): u is string => typeof u === 'string' && u.length > 0).slice(0, 3)
    : [];
  const userId = req.user!.userId;
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
      const row = await tx.feed.create({
        data: {
          text,
          authorId: userId,
          authorEmoji: body.avatarId ?? req.user!.name?.slice(0, 2) ?? '🐣',
          authorBgId: u?.backgroundId ?? 'default',
          authorFrameId: u?.frameId ?? 'none',
          category,
          images: images.length > 0 ? images : undefined,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { points: { increment: REWARDS.feed_general } },
      });
      return row;
    });
    res.status(201).json({ data: created });
  } catch (err) {
    console.error('[feeds.POST]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  try {
    const row = await prisma.feed.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json({ data: row });
  } catch (err) {
    console.error('[feeds.GET id]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  const { text } = (req.body ?? {}) as { text?: string };

  const data: Prisma.FeedUpdateInput = {};
  if (typeof text === 'string') {
    const trimmed = text.trim();
    if (!trimmed) return res.status(400).json({ error: 'text empty' });
    data.text = trimmed;
  }
  try {
    const feed = await prisma.feed.findUnique({ where: { id }, select: { authorId: true } });
    if (!feed) return res.status(404).json({ error: 'not found' });
    if (feed.authorId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    const updated = await prisma.feed.update({ where: { id }, data });
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'not found' });
    }
    console.error('[feeds.PATCH]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  try {
    const feed = await prisma.feed.findUnique({ where: { id }, select: { authorId: true } });
    if (!feed) return res.status(404).json({ error: 'not found' });
    if (feed.authorId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    await prisma.feed.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'not found' });
    }
    console.error('[feeds.DELETE]', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
