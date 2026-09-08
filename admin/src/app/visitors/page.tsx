import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { deviceOf, fmtDate, parseIntParam, refererHost, trunc } from '@/lib/format';
import { Chip, Pager } from '@/components/Filters';
import { kstDateKey, kstDateKeyShifted } from '../../../../shared/kst';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
const SOURCES = ['web', 'mobile', 'webview'] as const;
const SOURCE_LABEL: Record<string, string> = { web: '웹', mobile: '앱', webview: '앱(웹뷰)' };

interface SearchParams {
  day?: string;
  source?: string;
  who?: string;
  path?: string;
  page?: string;
}

/**
 * 방문 기록 — page_views(IP·KST 일자당 1행) 상세. 날짜 이동 + 출처/회원/경로 필터.
 * 2026-09-09 이전 행은 UTC 일자로 저장돼 있어 그 구간은 09시 경계.
 */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const today = kstDateKey();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.day ?? '') ? (searchParams.day as string) : today;
  const source = (SOURCES as readonly string[]).includes(searchParams.source ?? '') ? (searchParams.source as string) : '';
  const who = searchParams.who === 'member' || searchParams.who === 'guest' ? searchParams.who : '';
  const pathQ = (searchParams.path ?? '').trim();
  const page = parseIntParam(searchParams.page, 1);

  const dayDate = new Date(`${day}T00:00:00.000Z`);
  const where = {
    day: dayDate,
    ...(source ? { source } : {}),
    ...(pathQ ? { path: { contains: pathQ, mode: 'insensitive' as const } } : {}),
    ...(who === 'member' ? { userId: { not: null } } : who === 'guest' ? { userId: null } : {}),
  };

  const [rows, total, bySource, members] = await Promise.all([
    prisma.pageView.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }).catch(() => []),
    prisma.pageView.count({ where }).catch(() => 0),
    prisma.pageView.groupBy({ by: ['source'], where: { day: dayDate }, _count: { _all: true } }).catch(() => [] as Array<{ source: string; _count: { _all: number } }>),
    prisma.pageView.count({ where: { day: dayDate, userId: { not: null } } }).catch(() => 0),
  ]);
  const countOf = (k: string) => bySource.find((r) => r.source === k)?._count._all ?? 0;
  const dayTotal = SOURCES.reduce((n, k) => n + countOf(k), 0);

  const userIds = Array.from(new Set(rows.map((r) => r.userId).filter((x): x is string => !!x)));
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }).catch(() => [])
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const mkHref = (over: Partial<SearchParams>) => {
    const m = { day, source, who, path: pathQ, ...over };
    const c = new URLSearchParams();
    if (m.day && m.day !== today) c.set('day', m.day);
    if (m.source) c.set('source', m.source);
    if (m.who) c.set('who', m.who);
    if (m.path) c.set('path', m.path);
    if (m.page && m.page !== '1') c.set('page', m.page);
    const qs = c.toString();
    return qs ? `/visitors?${qs}` : '/visitors';
  };
  const shift = (n: number) => kstDateKeyShifted(-n, new Date(`${day}T00:00:00+09:00`));

  return (
    <>
      <h1 className="admin-h1">방문 기록</h1>
      <p className="admin-sub">
        {day} (KST) · 고유 방문 {dayTotal.toLocaleString()} ({SOURCES.map((k) => `${SOURCE_LABEL[k]} ${countOf(k).toLocaleString()}`).join(' · ')})
        {' · '}로그인 {members.toLocaleString()} · 필터 결과 {total.toLocaleString()}건 · {page} / {totalPages} 페이지
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip href={mkHref({ day: shift(-1), page: '' })} on={false}>← 전날</Chip>
        <form method="get" style={{ display: 'contents' }}>
          {source && <input type="hidden" name="source" value={source} />}
          {who && <input type="hidden" name="who" value={who} />}
          <input type="date" name="day" defaultValue={day} max={today} />
          <button type="submit">이동</button>
        </form>
        {day < today ? <Chip href={mkHref({ day: shift(1), page: '' })} on={false}>다음날 →</Chip> : null}
        <Chip href={mkHref({ day: today, page: '' })} on={day === today}>오늘</Chip>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Chip href={mkHref({ source: '', page: '' })} on={!source}>전체 출처</Chip>
        {SOURCES.map((k) => (
          <Chip key={k} href={mkHref({ source: k, page: '' })} on={source === k}>{SOURCE_LABEL[k]}</Chip>
        ))}
        <span style={{ width: 1, background: '#E2E8F0', margin: '0 4px' }} />
        <Chip href={mkHref({ who: '', page: '' })} on={!who}>회원+비회원</Chip>
        <Chip href={mkHref({ who: 'member', page: '' })} on={who === 'member'}>회원만</Chip>
        <Chip href={mkHref({ who: 'guest', page: '' })} on={who === 'guest'}>비회원만</Chip>
      </div>

      <form className="search" method="get">
        {day !== today && <input type="hidden" name="day" value={day} />}
        {source && <input type="hidden" name="source" value={source} />}
        {who && <input type="hidden" name="who" value={who} />}
        <input name="path" placeholder="첫 방문 경로로 필터 (예: /event)" defaultValue={pathQ} />
        <button type="submit">필터</button>
      </form>

      {rows.length === 0 ? (
        <div className="empty">방문 없음</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>시각(KST)</th><th>첫 경로</th><th>출처</th><th>기기</th><th>회원</th><th>국가</th><th>IP</th><th>유입</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt)}</td>
                <td className="mono" title={r.path}>{trunc(r.path, 40)}</td>
                <td><span className="tag">{SOURCE_LABEL[r.source] ?? r.source}</span></td>
                <td title={r.ua ?? ''}>{deviceOf(r.ua)}</td>
                <td>
                  {r.userId ? (
                    <Link href={`/users?q=${encodeURIComponent(r.userId)}`}>{userMap.get(r.userId) ?? r.userId.slice(0, 12)}</Link>
                  ) : <span className="muted">비회원</span>}
                </td>
                <td className="mono">{r.country ?? '-'}</td>
                <td className="mono muted">{r.ip ?? '-'}</td>
                <td className="muted" title={r.referer ?? ''}>{refererHost(r.referer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pager mkHref={mkHref} page={page} totalPages={totalPages} />
    </>
  );
}
