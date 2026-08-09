import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';

/**
 * 콘텐츠 신고 — 게시글/댓글 UGC 신고 접수 (App Store 심사 지침 1.2 요건).
 * POST /api/reports { targetType, targetId, reason, detail? }
 * 같은 사람이 같은 대상을 다시 신고하면 사유만 갱신 (중복 행 방지).
 * 처리(목록/상태 변경/콘텐츠 삭제)는 /api/admin/reports 에서.
 */

const router = Router();

export const REPORT_TARGET_TYPES = [
  'trade',
  'feed',
  'feedComment',
  'eventPost',
  'eventPostComment',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  '스팸/광고',
  '욕설/비하',
  '사기 의심',
  '음란/부적절한 콘텐츠',
  '개인정보 노출',
  '기타',
] as const;

/** 신고 시점의 대상 작성자·본문 미리보기 스냅 — 원본 삭제 후에도 어드민에서 맥락 확인. */
async function loadTarget(
  type: ReportTargetType,
  id: number,
): Promise<{ authorId: string | null; snapshot: string } | null> {
  const clip = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 300);
  switch (type) {
    case 'trade': {
      const r = await prisma.trade.findUnique({
        where: { id },
        select: { authorId: true, title: true, body: true },
      });
      return r ? { authorId: r.authorId, snapshot: clip(`${r.title} — ${r.body}`) } : null;
    }
    case 'feed': {
      const r = await prisma.feed.findUnique({
        where: { id },
        select: { authorId: true, text: true },
      });
      return r ? { authorId: r.authorId, snapshot: clip(r.text) } : null;
    }
    case 'feedComment': {
      const r = await prisma.feedComment.findUnique({
        where: { id },
        select: { authorId: true, text: true },
      });
      return r ? { authorId: r.authorId, snapshot: clip(r.text) } : null;
    }
    case 'eventPost': {
      const r = await prisma.eventPost.findUnique({
        where: { id },
        select: { authorId: true, title: true, body: true },
      });
      return r ? { authorId: r.authorId, snapshot: clip(`${r.title} — ${r.body}`) } : null;
    }
    case 'eventPostComment': {
      const r = await prisma.eventPostComment.findUnique({
        where: { id },
        select: { authorId: true, text: true },
      });
      return r ? { authorId: r.authorId, snapshot: clip(r.text) } : null;
    }
  }
}

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const reporterId = req.user!.userId;
  const body = (req.body ?? {}) as {
    targetType?: unknown;
    targetId?: unknown;
    reason?: unknown;
    detail?: unknown;
  };
  const targetType = String(body.targetType ?? '') as ReportTargetType;
  const targetId = Number(body.targetId);
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 60) : '';
  const detail =
    typeof body.detail === 'string' && body.detail.trim()
      ? body.detail.trim().slice(0, 1000)
      : null;

  if (!REPORT_TARGET_TYPES.includes(targetType)) {
    return res.status(400).json({ error: 'invalid targetType' });
  }
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ error: 'invalid targetId' });
  }
  if (!reason) return res.status(400).json({ error: 'reason 필요' });

  try {
    const target = await loadTarget(targetType, targetId);
    if (!target) return res.status(404).json({ error: '대상을 찾을 수 없어요' });
    if (target.authorId === reporterId) {
      return res.status(400).json({ error: '내가 쓴 글은 신고할 수 없어요' });
    }
    const row = await prisma.contentReport.upsert({
      where: {
        reporterId_targetType_targetId: {
          reporterId,
          targetType,
          targetId: String(targetId),
        },
      },
      update: { reason, detail },
      create: {
        reporterId,
        targetType,
        targetId: String(targetId),
        targetUserId: target.authorId,
        reason,
        detail,
        snapshot: target.snapshot,
      },
    });
    res.status(201).json({ ok: true, data: { id: row.id } });
  } catch (err) {
    console.error('[reports.POST]', reporterId, targetType, targetId, err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
