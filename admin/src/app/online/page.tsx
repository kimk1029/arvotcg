import Link from 'next/link';
import { getOnlineUsers } from '@/lib/online';
import { prisma } from '@/lib/prisma';
import { deviceOf, fmtDate, trunc } from '@/lib/format';
import { Chip } from '@/components/Filters';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

const WINDOWS = [5, 15, 60] as const;
const SOURCE_LABEL: Record<string, string> = { web: '웹', mobile: '앱', webview: '앱(웹뷰)' };

/**
 * 접속중 사용자 — 최근 N분 내 행동 로그(웹 4초·앱 5초 주기 배치 전송)가 있는 사람.
 * ponytail: 별도 하트비트 없이 action_logs 재사용 — 화면을 켜둔 채 아무 조작도 없으면 N분 뒤 빠진다.
 */
export default async function Page({ searchParams }: { searchParams: { m?: string } }) {
  const minutes = (WINDOWS as readonly number[]).includes(Number(searchParams.m)) ? Number(searchParams.m) : 5;

  const rows = await getOnlineUsers(minutes);

  const userIds = rows.map((r) => r.userId).filter((x): x is string => !!x);
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, createdAt: true } }).catch(() => [])
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const joinedAtOf = new Map(users.map((u) => [u.id, u.createdAt]));

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

      <p className="admin-sub">
        비회원은 미가입자가 아니라 활동 당시 로그인 인증 정보가 없는 방문입니다. 로그인 화면·공개 안내 페이지의 활동도 포함되며, 같은 출처·브라우저의 익명 ID로 연결되는 로그인 전후 활동은 회원 한 명으로 합산합니다.
        {' '}실시간 연결 수가 아닌 최근 활동 기준으로, 화면을 열어두고 활동하지 않으면 집계에서 제외됩니다.
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
            <tr><th>마지막 활동(KST)</th><th>사용자</th><th>가입일(KST)</th><th>출처</th><th>기기</th><th>현재 화면</th><th>활동 수</th><th>IP</th></tr>
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
                <td className="mono muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.userId ? joinedAtOf.get(r.userId) : null)}</td>
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
