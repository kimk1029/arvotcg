import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/requireAuth.js';
import { getBlockedIds } from '../lib/queries.js';
import { EVENT_CATEGORIES } from '@/lib/events';

const router = Router();

const AUTHOR_INCLUDE = { author: { select: { name: true } } } as const;
/** 글 행에 작성자 이름 + 댓글 수까지 포함. */
const POST_INCLUDE = {
  ...AUTHOR_INCLUDE,
  _count: { select: { comments: true } },
} as const;

type PostRow = {
  author?: { name: string } | null;
  authorId?: string | null;
  _count?: { comments: number };
} & Record<string, unknown>;

/** author/_count 관계를 authorName/commentCount 평면 필드로 변환. */
function toDto(p: PostRow) {
  const { author, _count, ...rest } = p;
  return {
    ...rest,
    authorName: author?.name ?? null,
    commentCount: _count?.comments ?? 0,
  };
}

/** 공개 이벤트 목록 — 고정글 먼저, 최신순. */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.eventPost.findMany({
      where: { published: true },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: POST_INCLUDE,
    });
    res.json({ data: items.map(toDto) });
  } catch (err) {
    console.error('[events.GET]', err);
    res.json({ data: [] });
  }
});

/** 공개 이벤트 상세 — 비공개 글은 404. */
router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  try {
    const post = await prisma.eventPost.findFirst({
      where: { id, published: true },
      include: POST_INCLUDE,
    });
    if (!post) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ data: toDto(post) });
  } catch (err) {
    console.error('[events.GET/:id]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** 댓글 목록 — 공개 글에만. 로그인 시 차단한 작성자 댓글 제외. */
router.get('/:id/comments', optionalAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  try {
    const blocked = await getBlockedIds(req.user?.userId);
    const rows = await prisma.eventPostComment.findMany({
      where: {
        postId: id,
        ...(blocked.length ? { NOT: { authorId: { in: blocked } } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: AUTHOR_INCLUDE,
    });
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        text: r.text,
        authorId: r.authorId,
        authorName: r.author?.name ?? '트레이너',
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[events.comments.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** 댓글 작성 — 로그인 필수. */
router.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  const text = typeof (req.body as { text?: unknown })?.text === 'string'
    ? (req.body as { text: string }).text.trim().slice(0, 300)
    : '';
  if (!text) {
    res.status(400).json({ error: 'text required' });
    return;
  }
  try {
    const post = await prisma.eventPost.findFirst({
      where: { id, published: true },
      select: { id: true },
    });
    if (!post) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const c = await prisma.eventPostComment.create({
      data: { postId: id, authorId: req.user!.userId, text },
      include: AUTHOR_INCLUDE,
    });
    res.status(201).json({
      data: {
        id: c.id,
        text: c.text,
        authorName: c.author?.name ?? '트레이너',
        createdAt: c.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[events.comments.POST]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** 회원 글 작성 — 로그인 필수. 말머리+제목/본문 (기간/고정은 어드민 전용). */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const body = req.body as { title?: unknown; body?: unknown; category?: unknown };
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 100) : '';
  const text = typeof body?.body === 'string' ? body.body.trim().slice(0, 3000) : '';
  const category =
    typeof body?.category === 'string' &&
    (EVENT_CATEGORIES as readonly string[]).includes(body.category)
      ? body.category
      : null;
  if (!title) {
    res.status(400).json({ error: '제목을 입력해주세요' });
    return;
  }
  if (!category) {
    res.status(400).json({ error: '말머리를 선택해주세요' });
    return;
  }
  try {
    const post = await prisma.eventPost.create({
      data: {
        title,
        body: text,
        category,
        authorId: req.user!.userId,
        published: true,
      },
      include: POST_INCLUDE,
    });
    res.status(201).json({ data: toDto(post) });
  } catch (err) {
    console.error('[events.POST]', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
