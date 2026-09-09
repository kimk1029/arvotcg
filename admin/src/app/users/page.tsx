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
  /** 보유 카드 필터 — 'has'(1장 이상) | 'none'(0장) | 전체(미지정). */
  cards?: string;
  /** 가입 플랫폼 / SNS 필터. */
  platform?: string;
  provider?: string;
  /** 정렬 — 'recent'(가입 최신, 기본) | 'cards' | 'points'. */
  sort?: string;
}

const CARD_FILTERS = [
  { k: '', label: '전체' },
  { k: 'has', label: '컬렉션 1장 이상' },
  { k: 'none', label: '컬렉션 없음' },
];
const PLATFORM_FILTERS = ['', 'web', 'ios', 'android', 'mobile'];
const PROVIDER_FILTERS = ['', 'google', 'kakao', 'naver', 'apple'];
const SORTS = [
  { k: 'recent', label: '가입 최신순' },
  { k: 'cards', label: '컬렉션 많은순' },
  { k: 'points', label: '포인트 많은순' },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const page = parseIntParam(searchParams.page, 1);
  const skip = (page - 1) * PAGE_SIZE;

  const cards = searchParams.cards === 'has' || searchParams.cards === 'none' ? searchParams.cards : '';
  const platform = PLATFORM_FILTERS.includes(searchParams.platform ?? '') ? (searchParams.platform ?? '') : '';
  const provider = PROVIDER_FILTERS.includes(searchParams.provider ?? '') ? (searchParams.provider ?? '') : '';
  const sort = SORTS.some((s) => s.k === searchParams.sort) ? (searchParams.sort as string) : 'recent';

  // 검색어 + 필터(보유 카드·플랫폼·SNS) AND 결합.
  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { id: q },
          ],
        }
      : {}),
    // 컬렉션(보유 카드) 유무 — 관계 존재 여부로 필터.
    ...(cards === 'has' ? { userCards: { some: {} } } : {}),
    ...(cards === 'none' ? { userCards: { none: {} } } : {}),
    ...(platform ? { signupPlatform: platform } : {}),
    ...(provider ? { signupProvider: provider } : {}),
  };

  const orderBy =
    sort === 'cards'
      ? ({ userCards: { _count: 'desc' } } as const)
      : sort === 'points'
        ? ({ points: 'desc' } as const)
        : ({ createdAt: 'desc' } as const);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, email: true, points: true,
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
        {cards === 'has' ? ' · 컬렉션 1장 이상' : cards === 'none' ? ' · 컬렉션 없음' : ''}
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

      {/* 검색 + 필터 — 모두 쿼리스트링(GET)이라 URL 공유·새로고침에 그대로 유지된다. */}
      <form className="search" method="get" style={{ flexWrap: 'wrap', gap: 6 }}>
        <input name="q" placeholder="이름 / 이메일 / UID 로 검색" defaultValue={q} />
        <select name="cards" defaultValue={cards} title="보유 카드(컬렉션)">
          {CARD_FILTERS.map((f) => (
            <option key={f.k} value={f.k}>{f.label}</option>
          ))}
        </select>
        <select name="platform" defaultValue={platform} title="가입 플랫폼">
          {PLATFORM_FILTERS.map((k) => (
            <option key={k} value={k}>{k ? PLATFORM_LABEL[k] ?? k : '플랫폼 전체'}</option>
          ))}
        </select>
        <select name="provider" defaultValue={provider} title="가입 SNS">
          {PROVIDER_FILTERS.map((k) => (
            <option key={k} value={k}>{k ? PROVIDER_LABEL[k as SignupProvider] : 'SNS 전체'}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} title="정렬">
          {SORTS.map((s) => (
            <option key={s.k} value={s.k}>{s.label}</option>
          ))}
        </select>
        <button type="submit">검색</button>
        {(q || cards || platform || provider || sort !== 'recent') && (
          <Link className="btn" href="/users">필터 해제</Link>
        )}
      </form>

      <UsersTable rows={rows} />

      <Pager base="/users" params={{ q, cards, platform, provider, sort }} page={page} totalPages={totalPages} />
    </>
  );
}

function Pager({
  base, params, page, totalPages,
}: { base: string; params: Record<string, string>; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  // 검색어·필터·정렬을 그대로 이어간다 (예전엔 q 만 유지돼 다음 페이지에서 필터가 풀렸다).
  const href = (p: number) => {
    const sp = new URLSearchParams({ page: String(p) });
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    return `${base}?${sp.toString()}`;
  };
  return (
    <div className="pager">
      {page > 1 ? <Link href={href(page - 1)}>← 이전</Link> : <span className="disabled">← 이전</span>}
      <span className="disabled">{page} / {totalPages}</span>
      {page < totalPages ? <Link href={href(page + 1)}>다음 →</Link> : <span className="disabled">다음 →</span>}
    </div>
  );
}
