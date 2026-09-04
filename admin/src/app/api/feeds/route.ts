import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/feeds — 커뮤니티 글 일괄 삭제.
 *   { ids: [1,2,3] }  선택 삭제
 *   { all: true }     전체 초기화 (검색 조건 무시, feeds 테이블 전부)
 * 댓글(FeedComment)·북마크(Bookmark)는 FK onDelete: Cascade 로 함께 지워진다.
 */
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;

  if (body?.all === true) {
    try {
      const { count } = await prisma.feed.deleteMany({});
      return NextResponse.json({ ok: true, count });
    } catch (err) {
      console.error('[admin.feeds.DELETE all]', err);
      return NextResponse.json({ error: 'internal' }, { status: 500 });
    }
  }

  const ids = Array.isArray(body?.ids)
    ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids 가 비어 있습니다' }, { status: 400 });
  }
  try {
    const { count } = await prisma.feed.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    console.error('[admin.feeds.DELETE]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
