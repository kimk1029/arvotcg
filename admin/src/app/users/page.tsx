import Link from 'next/link';
import { UsersTable } from '@/components/UsersTable';
import { prisma } from '@/lib/prisma';
import { parseIntParam } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

interface SearchParams {
  q?: string;
  page?: string;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const page = parseIntParam(searchParams.page, 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { id: q },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, email: true, avatarId: true, points: true,
        signupPlatform: true,
        createdAt: true, updatedAt: true,
        _count: { select: {
          feeds: true, trades: true, bookmarks: true,
          sentMessages: true, receivedMessages: true, oripaTickets: true,
          userCards: true,
        }},
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarId: u.avatarId,
    points: u.points,
    signupPlatform: u.signupPlatform,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    counts: u._count,
  }));

  return (
    <>
      <h1 className="admin-h1">회원 관리</h1>
      <p className="admin-sub">
        총 {total.toLocaleString()}명 · {page} / {totalPages} 페이지
      </p>

      <form className="search" method="get">
        <input name="q" placeholder="이름 / 이메일 / UID 로 검색" defaultValue={q} />
        <button type="submit">검색</button>
      </form>

      <UsersTable rows={rows} />

      <Pager base="/users" q={q} page={page} totalPages={totalPages} />
    </>
  );
}

function Pager({ base, q, page, totalPages }: { base: string; q: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const qStr = q ? `&q=${encodeURIComponent(q)}` : '';
  return (
    <div className="pager">
      {page > 1 ? <Link href={`${base}?page=${page - 1}${qStr}`}>← 이전</Link> : <span className="disabled">← 이전</span>}
      <span className="disabled">{page} / {totalPages}</span>
      {page < totalPages ? <Link href={`${base}?page=${page + 1}${qStr}`}>다음 →</Link> : <span className="disabled">다음 →</span>}
    </div>
  );
}
