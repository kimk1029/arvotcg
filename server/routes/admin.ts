import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { put } from '@vercel/blob';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { warmCatalogImages, getWarmState } from '../lib/cardImageCache.js';

const SLIDE_CLASSES = ['slide-a', 'slide-b', 'slide-c', 'slide-d'] as const;
const VISUAL_TYPES = ['emoji', 'image'] as const;
const ON_CLICKS = ['stamp-rally', 'oripa'] as const;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

interface BannerInput {
  sortOrder?: number;
  slideClass?: string;
  badge?: string;
  title?: string;
  sub?: string;
  ctaHint?: string | null;
  visualType?: string;
  visualValue?: string;
  onClick?: string | null;
  linkUrl?: string | null;
  active?: boolean;
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validateBanner(
  input: BannerInput,
  partial: boolean,
): { ok: true; data: BannerInput } | { ok: false; error: string } {
  const out: BannerInput = {};
  if (input.slideClass !== undefined) {
    if (!(SLIDE_CLASSES as readonly string[]).includes(input.slideClass)) {
      return { ok: false, error: `slideClass must be one of ${SLIDE_CLASSES.join(',')}` };
    }
    out.slideClass = input.slideClass;
  } else if (!partial) return { ok: false, error: 'slideClass is required' };

  if (input.badge !== undefined) {
    if (typeof input.badge !== 'string' || !input.badge.trim()) {
      return { ok: false, error: 'badge required' };
    }
    out.badge = input.badge;
  } else if (!partial) return { ok: false, error: 'badge required' };

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || !input.title.trim()) {
      return { ok: false, error: 'title required' };
    }
    out.title = input.title;
  } else if (!partial) return { ok: false, error: 'title required' };

  if (input.sub !== undefined) {
    if (typeof input.sub !== 'string' || !input.sub.trim()) {
      return { ok: false, error: 'sub required' };
    }
    out.sub = input.sub;
  } else if (!partial) return { ok: false, error: 'sub required' };

  if (input.ctaHint !== undefined) out.ctaHint = input.ctaHint || null;

  if (input.visualType !== undefined) {
    if (!(VISUAL_TYPES as readonly string[]).includes(input.visualType)) {
      return { ok: false, error: `visualType must be one of ${VISUAL_TYPES.join(',')}` };
    }
    out.visualType = input.visualType;
  } else if (!partial) out.visualType = 'emoji';

  if (input.visualValue !== undefined) {
    if (typeof input.visualValue !== 'string' || !input.visualValue.trim()) {
      return { ok: false, error: 'visualValue required' };
    }
    out.visualValue = input.visualValue;
  } else if (!partial) out.visualValue = '✨';

  if (input.onClick !== undefined) {
    if (input.onClick === null || input.onClick === '') out.onClick = null;
    else if (!(ON_CLICKS as readonly string[]).includes(input.onClick)) {
      return { ok: false, error: `onClick must be null or one of ${ON_CLICKS.join(',')}` };
    } else out.onClick = input.onClick;
  }

  if (input.linkUrl !== undefined) {
    if (input.linkUrl === null || input.linkUrl === '') out.linkUrl = null;
    else if (typeof input.linkUrl !== 'string') {
      return { ok: false, error: 'linkUrl must be a string' };
    } else {
      const trimmed = input.linkUrl.trim();
      // 내부 경로('/...') 또는 http(s) URL 만 허용. 그 외(javascript: 등)는 거부.
      if (!/^\/(?!\/)/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
        return { ok: false, error: "linkUrl must start with '/' or 'http(s)://'" };
      }
      out.linkUrl = trimmed;
    }
  }

  if (input.sortOrder !== undefined) {
    const n = Number(input.sortOrder);
    if (!Number.isFinite(n)) return { ok: false, error: 'sortOrder must be a number' };
    out.sortOrder = Math.trunc(n);
  } else if (!partial) out.sortOrder = 0;

  if (input.active !== undefined) out.active = !!input.active;
  else if (!partial) out.active = true;

  return { ok: true, data: out };
}

const router = Router();
router.use(requireAdmin);

/* ── 카드 이미지 자체 CDN: 커버리지 상태 + 일괄 워밍 ─────────────── */

// 카탈로그 CDN 캐싱 현황 + 진행중 워밍 상태.
router.get('/cards/cdn-status', async (_req: Request, res: Response) => {
  try {
    const [total, cached] = await Promise.all([
      prisma.snkrdunkCard.count({ where: { imageUrl: { not: null } } }),
      prisma.snkrdunkCard.count({ where: { cdnImageUrl: { not: null } } }),
    ]);
    res.json({ total, cached, missing: Math.max(0, total - cached), warm: getWarmState() });
  } catch (err) {
    console.error('[admin.cards.cdn-status]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// 미캐싱 카드 일괄 워밍 시작(throttle). 백그라운드 — 즉시 응답.
router.post('/cards/warm-images', async (req: Request, res: Response) => {
  const limit = Number((req.body ?? {}).limit) || 500;
  const missingOnly = (req.body ?? {}).missingOnly !== false;
  const state = getWarmState();
  if (state.running) return res.json({ ok: true, alreadyRunning: true, warm: state });
  void warmCatalogImages({ limit, missingOnly });
  res.json({ ok: true, started: true, limit, missingOnly });
});

router.get('/banners', async (_req: Request, res: Response) => {
  try {
    const banners = await prisma.heroBanner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json({ banners });
  } catch (err) {
    console.error('[admin.banners.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/banners', async (req: Request, res: Response) => {
  const v = validateBanner((req.body ?? {}) as BannerInput, false);
  if (v.ok === false) return res.status(400).json({ error: v.error });
  try {
    const created = await prisma.heroBanner.create({
      data: {
        sortOrder: v.data.sortOrder ?? 0,
        slideClass: v.data.slideClass!,
        badge: v.data.badge!,
        title: v.data.title!,
        sub: v.data.sub!,
        ctaHint: v.data.ctaHint ?? null,
        visualType: v.data.visualType ?? 'emoji',
        visualValue: v.data.visualValue ?? '✨',
        onClick: v.data.onClick ?? null,
        linkUrl: v.data.linkUrl ?? null,
        active: v.data.active ?? true,
      },
    });
    res.status(201).json({ banner: created });
  } catch (err) {
    console.error('[admin.banners.POST]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/banners/:id', async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  try {
    const banner = await prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) return res.status(404).json({ error: 'not found' });
    res.json({ banner });
  } catch (err) {
    console.error('[admin.banners.GET id]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.patch('/banners/:id', async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  const v = validateBanner((req.body ?? {}) as BannerInput, true);
  if (v.ok === false) return res.status(400).json({ error: v.error });
  try {
    const updated = await prisma.heroBanner.update({
      where: { id },
      data: v.data as Prisma.HeroBannerUpdateInput,
    });
    res.json({ banner: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'not found' });
    }
    console.error('[admin.banners.PATCH]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.delete('/banners/:id', async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  try {
    await prisma.heroBanner.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'not found' });
    }
    console.error('[admin.banners.DELETE]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/* ------------------------------------------------------------------ */
/* banner image upload — Vercel Blob (admin only)                      */
/* ------------------------------------------------------------------ */
const BANNER_IMG_MAX_BYTES = 4 * 1024 * 1024;
const BANNER_IMG_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BANNER_IMG_MAX_BYTES },
});

function bannerExt(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

router.post('/banners/upload', bannerUpload.single('file'), async (req: Request, res: Response) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: 'Vercel Blob 이 설정되지 않았습니다. Vercel → Storage → Blob store 생성 후 연결 필요.',
    });
  }
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'no file' });
  if (!BANNER_IMG_TYPES.has(file.mimetype)) {
    return res.status(400).json({ error: `지원하지 않는 형식: ${file.mimetype}` });
  }
  try {
    const pathname = `banner/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${bannerExt(file.mimetype)}`;
    const { url } = await put(pathname, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });
    res.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin.banners.upload]', msg);
    res.status(500).json({ error: msg });
  }
});

router.get('/oripa-tickets', async (req: Request, res: Response) => {
  const limit = Math.min(
    Math.max(Number(req.query.limit ?? DEFAULT_LIMIT), 1),
    MAX_LIMIT,
  );
  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const cursor = cursorRaw ? Number(cursorRaw) : null;
  const packId = typeof req.query.packId === 'string' ? req.query.packId : undefined;
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

  const where = {
    drawn: true,
    ...(packId ? { packId } : {}),
    ...(userId ? { drawnById: userId } : {}),
  };
  try {
    const rows = await prisma.oripaTicket.findMany({
      where,
      orderBy: [{ drawnAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && Number.isInteger(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        packId: true,
        index: true,
        grade: true,
        prizeName: true,
        prizeEmoji: true,
        prizeImageUrl: true,
        drawnAt: true,
        drawnById: true,
        drawnByName: true,
      },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const packIds = Array.from(new Set(items.map((r) => r.packId)));
    const packs = packIds.length
      ? await prisma.oripaPack.findMany({
          where: { id: { in: packIds } },
          select: { id: true, name: true, emoji: true, price: true },
        })
      : [];
    const packMap = new Map<string, { name: string; emoji: string; price: number }>(
      packs.map((p) => [p.id, p]),
    );
    res.json({
      items: items.map((r) => ({
        id: r.id,
        packId: r.packId,
        packName: packMap.get(r.packId)?.name ?? r.packId,
        packEmoji: packMap.get(r.packId)?.emoji ?? '🎁',
        packPrice: packMap.get(r.packId)?.price ?? null,
        index: r.index,
        grade: r.grade,
        prizeName: r.prizeName,
        prizeEmoji: r.prizeEmoji,
        prizeImageUrl: r.prizeImageUrl,
        drawnAt: r.drawnAt,
        drawnById: r.drawnById,
        drawnByName: r.drawnByName,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (err) {
    console.error('[admin.oripa-tickets]', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/users/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'invalid id' });
  try {
    const u = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        points: true,
        streakCount: true,
        lastCheckInAt: true,
        avatarId: true,
        backgroundId: true,
        frameId: true,
        ownedAvatars: true,
        ownedBackgrounds: true,
        ownedFrames: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!u) return res.status(404).json({ error: 'not found' });
    const [feedTotal, tradeCount, ticketCount, sentMsg, recvMsg, cardCount] = await Promise.all([
      prisma.feed.count({ where: { authorId: id } }),
      prisma.trade.count({ where: { authorId: id } }),
      prisma.oripaTicket.count({ where: { drawnById: id } }),
      prisma.message.count({ where: { senderId: id } }),
      prisma.message.count({ where: { receiverId: id } }),
      prisma.userCard.count({ where: { userId: id } }),
    ]);
    res.json({
      user: {
        ...u,
        counts: { feedTotal, tradeCount, ticketCount, sentMsg, recvMsg, cardCount },
      },
    });
  } catch (err) {
    console.error('[admin.users.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// ── 신고/차단 관리 (App Store 심사 지침 1.2) ────────────────────────────────

const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;

/** GET /api/admin/reports?status=open|resolved|dismissed|all — 신고 목록. */
router.get('/reports', async (req: Request, res: Response) => {
  const statusQ = typeof req.query.status === 'string' ? req.query.status : 'open';
  const where =
    statusQ === 'all' ? {} : { status: REPORT_STATUSES.includes(statusQ as never) ? statusQ : 'open' };
  try {
    const rows = await prisma.contentReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { reporter: { select: { id: true, name: true } } },
    });
    // 피신고자 이름 일괄 조회 (탈퇴 시 null).
    const targetUserIds = Array.from(
      new Set(rows.map((r) => r.targetUserId).filter((v): v is string => !!v)),
    );
    const targetUsers = targetUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: targetUserIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(targetUsers.map((u) => [u.id, u.name]));
    const counts = await prisma.contentReport.groupBy({ by: ['status'], _count: { _all: true } });
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        detail: r.detail,
        snapshot: r.snapshot,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        reporter: r.reporter ? { id: r.reporter.id, name: r.reporter.name } : null,
        targetUser: r.targetUserId
          ? { id: r.targetUserId, name: nameById.get(r.targetUserId) ?? '탈퇴' }
          : null,
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    });
  } catch (err) {
    console.error('[admin.reports.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** PATCH /api/admin/reports/:id { status } — 신고 상태 변경. */
router.patch('/reports/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const status = String((req.body as { status?: unknown } | null)?.status ?? '');
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  if (!REPORT_STATUSES.includes(status as never)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  try {
    const row = await prisma.contentReport.update({
      where: { id },
      data: { status, resolvedAt: status === 'open' ? null : new Date() },
    });
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error('[admin.reports.PATCH]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/**
 * DELETE /api/admin/reports/:id/target — 신고된 콘텐츠 자체를 삭제하고,
 * 같은 대상의 모든 열린 신고를 resolved 처리.
 */
router.delete('/reports/:id/target', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const report = await prisma.contentReport.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: 'not found' });
    const targetId = Number(report.targetId);
    const del = async () => {
      switch (report.targetType) {
        case 'trade':
          return prisma.trade.deleteMany({ where: { id: targetId } });
        case 'feed':
          return prisma.feed.deleteMany({ where: { id: targetId } });
        case 'feedComment':
          return prisma.feedComment.deleteMany({ where: { id: targetId } });
        case 'eventPost':
          return prisma.eventPost.deleteMany({ where: { id: targetId } });
        case 'eventPostComment':
          return prisma.eventPostComment.deleteMany({ where: { id: targetId } });
        default:
          return { count: 0 };
      }
    };
    const removed = await del();
    await prisma.contentReport.updateMany({
      where: { targetType: report.targetType, targetId: report.targetId, status: 'open' },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
    res.json({ ok: true, removed: removed.count });
  } catch (err) {
    console.error('[admin.reports.DELETE target]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** GET /api/admin/blocks — 최근 차단 현황 (참고용). */
router.get('/blocks', async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.userBlock.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        blocker: { select: { id: true, name: true } },
        blocked: { select: { id: true, name: true } },
      },
    });
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        blocker: r.blocker ? { id: r.blocker.id, name: r.blocker.name } : null,
        blocked: r.blocked ? { id: r.blocked.id, name: r.blocked.name } : null,
      })),
    });
  } catch (err) {
    console.error('[admin.blocks.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
