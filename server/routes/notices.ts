/**
 * 공지사항 공개 조회 — 웹 /my/notices, 앱 /my/notices 가 같이 쓴다.
 * 작성·수정은 어드민(admin/src/app/api/notices)이 prisma 로 직접 한다.
 */
import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { isNoticeTag, type Notice } from '../../shared/notices';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.notice.findMany({
      where: { published: true },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: 200,
      select: { id: true, title: true, body: true, tag: true, pinned: true, publishedAt: true },
    });
    const data: Notice[] = rows.map((n) => ({
      ...n,
      tag: isNoticeTag(n.tag) ? n.tag : null,
    }));
    res.json({ data });
  } catch (err) {
    console.error('[notices.GET]', err);
    res.json({ data: [] });
  }
});

export default router;
