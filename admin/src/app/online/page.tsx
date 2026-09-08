import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { deviceOf, fmtDate, trunc } from '@/lib/format';
import { Chip } from '@/components/Filters';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

const WINDOWS = [5, 15, 60] as const;
const SOURCE_LABEL: Record<string, string> = { web: '웹', mobile: '앱', webview: '앱(웹뷰)' };

interface Row {
  actor: string;
  userId: string | null;
  anonId: string | null;
  source: string;
  path: string;
  ua: string | null;
  ip: string | null;
  lastAt: Date;
  events: bigint;
}

/**
 * 접속중 사용자 — 최근 N분 내 행동 로그(웹 4초·앱 5초 주기 배치 전송)가 있는 사람.
 * ponytail: 별도 하트비트 없이 action_logs 재사용 — 화면을 켜둔 채 아무 조작도 없으면 N분 뒤 빠진다.
 */
export default async function Page({ searchParams }: { searchParams: { m?: string } }) {
  const minutes = (WINDOWS as readonly number[]).includes(Number(searchParams.m)) ? Number(searchParams.m) : 5;

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT DISTINCT ON (actor) actor, "userId", "anonId", source, path, ua, ip, "createdAt" AS "lastAt",
           count(*) OVER (PARTITION BY actor) AS events
      FROM (
        SELECT COALESCE("userId", 'anon:' || COALESCE("anonId", ip, '?')) AS actor, *
          FROM action_logs
         WHERE "createdAt" > now() - ${minutes} * interval '1 minute'
      ) t
     ORDER BY actor, "createdAt" DESC
  `.catch(() => [] as Row[]);
  rows.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

  const userIds = rows.map((r) => r.userId).filter((x): x is string => !!x);
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }).catch(() => [])
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  const members = rows.filter((r) => r.userId).length;
  const bySource = (k: string) => rows.filter((r) => r.source === k).length;

  return (
    <>
      <AutoRefresh seconds={15} />
      <h1 className="admin-h1">접속중 사용자</h1>
      <p className="admin-sub">
        최근 {minutes}분 내 활동 · 총 {rows.length.toLocaleString()}명 (회원 {members.toLocaleString()} · 비회원 {(rows.length - members).toLocaleString()})
        {' · '}{Object.keys(SOURCE_LABEL).map((k) => `${SOURCE_LABEL[k]} ${bySource(k)}`).join(' · ')} · 15초마다 갱신
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {WINDOWS.map((m) => (
          <Chip key={m} href={m === 5 ? '/online' : `/online?m=${m}`} on={minutes === m}>최근 {m}분</Chip>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty">활동중인 사용자 없음</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr><th>마지막 활동(KST)</th><th>사용자</th><th>출처</th><th>기기</th><th>현재 화면</th><th>활동 수</th><th>IP</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.actor}>
                <td className="mono muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.lastAt)}</td>
                <td>
                  {r.userId ? (
                    <Link href={`/users?q=${encodeURIComponent(r.userId)}`}>{nameOf.get(r.userId) ?? r.userId.slice(0, 12)}</Link>
                  ) : (
                    <span className="muted" title={r.anonId ?? ''}>익명{r.anonId ? ` · ${r.anonId.slice(0, 8)}` : ''}</span>
                  )}
                </td>
                <td><span className="tag">{SOURCE_LABEL[r.source] ?? r.source}</span></td>
                <td title={r.ua ?? ''}>{deviceOf(r.ua)}</td>
                <td className="mono" title={r.path}>{trunc(r.path, 40)}</td>
                <td className="mono">{Number(r.events)}</td>
                <td className="mono muted">{r.ip ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
