import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { fmtDate, parseIntParam, trunc } from '@/lib/format';
import { Chip, Pager } from '@/components/Filters';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

interface SearchParams {
  type?: string;
  path?: string;
  who?: string;
  source?: string;
  uid?: string;
  page?: string;
}

const TYPE_LABEL: Record<string, string> = {
  pageview: '페이지이동',
  click: '클릭',
  tap: '탭',
};

/** 출처 — 'mobile' 앱 네이티브, 'webview' 앱 인앱 WebView 안의 웹, 그 외 브라우저 웹. */
const SOURCE_LABEL: Record<string, string> = {
  web: '웹',
  mobile: '앱',
  webview: '앱(웹뷰)',
};

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const type = (searchParams.type ?? '').trim();
  const pathQ = (searchParams.path ?? '').trim();
  const who = searchParams.who === 'member' || searchParams.who === 'guest' ? searchParams.who : null;
  const source = searchParams.source === 'web' || searchParams.source === 'mobile' || searchParams.source === 'webview' ? searchParams.source : null;
  const uid = (searchParams.uid ?? '').trim();
  const page = parseIntParam(searchParams.page, 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    ...(type ? { type } : {}),
    ...(pathQ ? { path: { contains: pathQ, mode: 'insensitive' as const } } : {}),
    ...(source ? { source } : {}),
    ...(uid ? { userId: uid } : who === 'member' ? { userId: { not: null } } : who === 'guest' ? { userId: null } : {}),
  };

  const [rows, total, typeGroups] = await Promise.all([
    prisma.actionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }).catch(() => []),
    prisma.actionLog.count({ where }).catch(() => 0),
    prisma.actionLog.groupBy({ by: ['type'], _count: { type: true }, orderBy: { _count: { type: 'desc' } } }).catch(() => [] as Array<{ type: string; _count: { type: number } }>),
  ]);

  const userIds = Array.from(new Set(rows.map((r) => r.userId).filter((x): x is string => !!x)));
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }).catch(() => [])
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 현재 필터(type 제외)를 유지하며 type 만 바꾼 링크 생성
  const mkHref = (over: Partial<SearchParams>) => {
    const c = new URLSearchParams();
    const merged: SearchParams = { type, path: pathQ, who: who ?? '', source: source ?? '', uid, ...over };
    if (merged.type) c.set('type', merged.type);
    if (merged.path) c.set('path', merged.path);
    if (merged.who) c.set('who', merged.who);
    if (merged.source) c.set('source', merged.source);
    if (merged.uid) c.set('uid', merged.uid);
    if (merged.page && merged.page !== '1') c.set('page', merged.page);
    const qs = c.toString();
    return qs ? `/events?${qs}` : '/events';
  };

  return (
    <>
      <h1 className="admin-h1">행동 로그</h1>
      <p className="admin-sub">
        회원·비회원 모든 클릭/페이지이동 · 총 {total.toLocaleString()}건 · {page} / {totalPages} 페이지
      </p>

      {/* 액션 종류 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Chip href={mkHref({ type: '' })} on={!type}>전체 액션</Chip>
        {typeGroups.map((g) => (
          <Chip key={g.type} href={mkHref({ type: g.type })} on={type === g.type}>
            {(TYPE_LABEL[g.type] ?? g.type)} ({g._count.type.toLocaleString()})
          </Chip>
        ))}
      </div>

      {/* 출처 / 회원 여부 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Chip href={mkHref({ source: '' })} on={!source}>전체 출처</Chip>
        <Chip href={mkHref({ source: 'web' })} on={source === 'web'}>웹</Chip>
        <Chip href={mkHref({ source: 'mobile' })} on={source === 'mobile'}>앱</Chip>
        <Chip href={mkHref({ source: 'webview' })} on={source === 'webview'}>앱(웹뷰)</Chip>
        <span style={{ width: 1, background: '#E2E8F0', margin: '0 4px' }} />
        <Chip href={mkHref({ who: '' })} on={!who}>회원+비회원</Chip>
        <Chip href={mkHref({ who: 'member' })} on={who === 'member'}>회원만</Chip>
        <Chip href={mkHref({ who: 'guest' })} on={who === 'guest'}>비회원만</Chip>
      </div>

      {/* 페이지 경로 / UID 텍스트 필터 */}
      <form className="search" method="get" style={{ flexWrap: 'wrap' }}>
        {type && <input type="hidden" name="type" value={type} />}
        {who && <input type="hidden" name="who" value={who} />}
        {source && <input type="hidden" name="source" value={source} />}
        <input name="path" placeholder="페이지 경로로 필터 (예: /cards)" defaultValue={pathQ} />
        <input name="uid" placeholder="UID 로 필터" defaultValue={uid} />
        <button type="submit">필터</button>
      </form>

      {rows.length === 0 ? (
        <div className="empty">결과 없음</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>시각</th>
              <th>액션</th>
              <th>페이지</th>
              <th>대상</th>
              <th>사용자</th>
              <th>출처</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const u = r.userId ? userMap.get(r.userId) : undefined;
              return (
                <tr key={r.id}>
                  <td className="mono muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt)}</td>
                  <td><span className="tag">{TYPE_LABEL[r.type] ?? r.type}</span></td>
                  <td className="mono">{trunc(r.path, 40)}</td>
                  <td className="mono muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.target}>
                    {r.target || '-'}
                  </td>
                  <td>
                    {r.userId ? (
                      <Link href={`/users?q=${encodeURIComponent(r.userId)}`}>
                        {u?.name ?? u?.email ?? r.userId.slice(0, 12)}
                      </Link>
                    ) : (
                      <span className="muted" title={r.anonId ?? ''}>익명{r.anonId ? ` · ${r.anonId.slice(0, 8)}` : ''}</span>
                    )}
                  </td>
                  <td><span className="tag">{SOURCE_LABEL[r.source] ?? r.source}</span></td>
                  <td className="mono muted">{r.ip ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Pager mkHref={mkHref} page={page} totalPages={totalPages} />
    </>
  );
}
