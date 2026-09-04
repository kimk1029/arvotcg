import Link from 'next/link';
import { FeedBulkTable, type FeedRow } from '@/components/FeedBulkTable';
import { prisma } from '@/lib/prisma';
import { fmtDate, parseIntParam, trunc } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

interface SearchParams {
  kind?: string;
  q?: string;
  page?: string;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const page = parseIntParam(searchParams.page, 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = q ? { text: { contains: q, mode: 'insensitive' as const } } : {};

  const [feeds, total, grandTotal] = await Promise.all([
    prisma.feed.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      include: {
        author: { select: { id: true, name: true } },
      },
    }),
    prisma.feed.count({ where }),
    prisma.feed.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows: FeedRow[] = feeds.map((f) => ({
    id: f.id,
    text: trunc(f.text, 60),
    category: f.category,
    author: f.author?.name ?? null,
    createdAt: fmtDate(f.createdAt),
  }));

  return (
    <>
      <h1 className="admin-h1">커뮤니티 글 관리</h1>
      <p className="admin-sub">
        총 {total.toLocaleString()}건 · {page} / {totalPages} 페이지 · 체크박스로 여러 건을 골라 한 번에
        삭제하거나, 전체를 초기화할 수 있습니다 (댓글·북마크 동반 삭제).
      </p>

      <form className="search" method="get">
        <input name="q" placeholder="본문 검색" defaultValue={q} />
        <button type="submit">검색</button>
      </form>

      <FeedBulkTable rows={rows} total={grandTotal} />

      <Pager base="/feeds" q={q} page={page} totalPages={totalPages} />
    </>
  );
}

function Pager({
  base, q, page, totalPages,
}: { base: string; q: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const mk = (p: number) => {
    const c = new URLSearchParams(params);
    c.set('page', String(p));
    return `${base}?${c.toString()}`;
  };
  return (
    <div className="pager">
      {page > 1 ? <Link href={mk(page - 1)}>← 이전</Link> : <span className="disabled">← 이전</span>}
      <span className="disabled">{page} / {totalPages}</span>
      {page < totalPages ? <Link href={mk(page + 1)}>다음 →</Link> : <span className="disabled">다음 →</span>}
    </div>
  );
}
