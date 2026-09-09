import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { fmtDate, parseIntParam } from '@/lib/format';
import { BugReportTable } from '@/components/BugReportTable';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
}

/**
 * 버그 제보 게시판 — 사용자는 앱/웹 '버그 제보' 메뉴에서 작성만 하고,
 * 열람·처리는 여기(어드민)에서만 한다.
 */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const status = searchParams.status === 'open' || searchParams.status === 'done' ? searchParams.status : '';
  const page = parseIntParam(searchParams.page, 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { content: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
  };

  const [reports, total, openCount] = await Promise.all([
    prisma.bugReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.bugReport.count({ where }),
    prisma.bugReport.count({ where: { status: 'open' } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows = reports.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    platform: r.platform,
    appVersion: r.appVersion,
    contact: r.contact,
    status: r.status,
    createdAt: fmtDate(r.createdAt),
    reporter: r.user ? r.user.name : null,
    reporterEmail: r.user?.email ?? null,
    reporterId: r.user?.id ?? null,
  }));

  return (
    <>
      <h1 className="admin-h1">버그 제보</h1>
      <p className="admin-sub">
        총 {total.toLocaleString()}건 · 미처리 {openCount.toLocaleString()}건 · {page} / {totalPages} 페이지
        · 사용자는 앱·웹의 &lsquo;버그 제보&rsquo; 메뉴에서 작성만 하고, 열람은 어드민 전용입니다.
      </p>

      <form className="search" method="get" style={{ flexWrap: 'wrap', gap: 6 }}>
        <input name="q" placeholder="제목 / 내용 검색" defaultValue={q} />
        <select name="status" defaultValue={status}>
          <option value="">전체 상태</option>
          <option value="open">미처리</option>
          <option value="done">처리 완료</option>
        </select>
        <button type="submit">검색</button>
        {(q || status) && <Link className="btn" href="/bug-reports">필터 해제</Link>}
      </form>

      <BugReportTable rows={rows} />

      {totalPages > 1 && (
        <div className="pager">
          {page > 1 ? <Link href={href(page - 1, q, status)}>← 이전</Link> : <span className="disabled">← 이전</span>}
          <span className="disabled">{page} / {totalPages}</span>
          {page < totalPages ? <Link href={href(page + 1, q, status)}>다음 →</Link> : <span className="disabled">다음 →</span>}
        </div>
      )}
    </>
  );
}

function href(page: number, q: string, status: string): string {
  const sp = new URLSearchParams({ page: String(page) });
  if (q) sp.set('q', q);
  if (status) sp.set('status', status);
  return `/bug-reports?${sp.toString()}`;
}
