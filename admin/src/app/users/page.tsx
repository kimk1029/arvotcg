import Link from 'next/link';
import { UsersTable } from '@/components/UsersTable';
import { prisma } from '@/lib/prisma';
import { parseIntParam } from '@/lib/format';
import { PLATFORM_LABEL, PROVIDER_LABEL, PROVIDER_STYLE, type SignupProvider } from '@/lib/signupProvider';

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
        signupPlatform: true, signupProvider: true, isAdmin: true,
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

  // 전체 회원 가입경로 요약 — 플랫폼별 / SNS별 인원 (검색 조건 무관, 시스템 계정 제외).
  // signupProvider 가 비어 있는 도입 전 회원은 SQL 에서 id 패턴으로 추정해 합산한다
  // (deploy.yml pre-migrate 백필과 같은 규칙, admin/src/lib/signupProvider.ts 참고).
  const [platformRows, providerRows] = await Promise.all([
    prisma.$queryRaw<Array<{ key: string | null; n: bigint }>>`
      SELECT "signupPlatform" AS key, count(*) AS n FROM users
       WHERE id NOT LIKE 'system%' GROUP BY 1`,
    prisma.$queryRaw<Array<{ key: string; n: bigint }>>`
      SELECT COALESCE("signupProvider", CASE
               WHEN id LIKE 'apple\\_%' THEN 'apple'
               WHEN id ~ '^[0-9]{1,12}$' THEN 'kakao'
               WHEN id ~ '^[0-9]{15,}$' THEN 'google'
               ELSE 'naver' END) AS key, count(*) AS n
        FROM users WHERE id NOT LIKE 'system%' GROUP BY 1`,
  ]);
  const platformOrder = ['web', 'ios', 'android', 'mobile'];
  const rank = (k: string) => (platformOrder.indexOf(k) === -1 ? 99 : platformOrder.indexOf(k));
  const platformSummary = platformRows
    .map((r) => ({ key: r.key ?? 'unknown', n: Number(r.n) }))
    .sort((a, b) => rank(a.key) - rank(b.key));
  const providerOrder: SignupProvider[] = ['google', 'kakao', 'naver', 'apple'];
  const providerSummary = providerOrder
    .map((k) => ({ key: k, n: Number(providerRows.find((r) => r.key === k)?.n ?? 0) }))
    .filter((r) => r.n > 0);

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarId: u.avatarId,
    points: u.points,
    signupPlatform: u.signupPlatform,
    signupProvider: u.signupProvider,
    isAdmin: u.isAdmin,
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '8px 0 12px' }}>
        <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>플랫폼</span>
        {platformSummary.map((r) => (
          <span key={r.key} className="tag" title={r.key === 'unknown' ? '가입경로 기록 도입 이전 회원' : r.key}>
            {PLATFORM_LABEL[r.key] ?? '미상'} {r.n.toLocaleString()}
          </span>
        ))}
        <span className="muted" style={{ fontSize: 12, margin: '0 4px 0 12px' }}>SNS</span>
        {providerSummary.map((r) => (
          <span key={r.key} className="tag" style={PROVIDER_STYLE[r.key]}>
            {PROVIDER_LABEL[r.key]} {r.n.toLocaleString()}
          </span>
        ))}
      </div>

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
