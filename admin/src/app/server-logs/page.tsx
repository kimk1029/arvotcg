import Link from 'next/link';
import { AutoRefresh } from '@/components/AutoRefresh';
import { fetchServerLogs, type LogLevelFilter } from '@/lib/serverLogs';

export const dynamic = 'force-dynamic';

const LIMITS = [200, 500, 1000, 2000];
const DEFAULT_LIMIT = 500;

/** 'YYYY-MM-DDTHH:mm:ss' → 'MM-DD HH:mm:ss'. pm2 가 이미 서버 로컬시각(KST)으로 찍는다. */
function shortTime(at: string | null): string {
  if (!at) return '';
  return at.length >= 19 ? `${at.slice(5, 10)} ${at.slice(11, 19)}` : at;
}

export default async function Page({
  searchParams,
}: {
  searchParams: { level?: string; limit?: string };
}) {
  const level: LogLevelFilter = searchParams.level === 'error' ? 'error' : 'all';
  const limitParam = Number(searchParams.limit);
  const limit = LIMITS.includes(limitParam) ? limitParam : DEFAULT_LIMIT;
  const r = await fetchServerLogs(level, limit);

  const href = (next: { level?: LogLevelFilter; limit?: number }) => {
    const q = new URLSearchParams();
    const lv = next.level ?? level;
    const lm = next.limit ?? limit;
    if (lv !== 'all') q.set('level', lv);
    if (lm !== DEFAULT_LIMIT) q.set('limit', String(lm));
    const qs = q.toString();
    return qs ? `/server-logs?${qs}` : '/server-logs';
  };

  return (
    <>
      <AutoRefresh seconds={20} />
      <h1 className="admin-h1">서버 로그</h1>
      <p className="admin-sub">
        API 서버(pm2)의 표준 출력과 표준 에러를 시각순으로 합쳐 보여 줍니다. 빨간 줄이 에러입니다.
        20초마다 자동 갱신됩니다.
      </p>

      {r.fetchError ? (
        <div className="card" style={{ marginBottom: 14, borderColor: '#FCA5A5' }}>
          <h2 style={{ color: '#B91C1C', margin: 0 }}>로그를 불러오지 못했습니다</h2>
          <div className="mono" style={{ fontSize: 12, color: '#B91C1C', marginTop: 6 }}>{r.fetchError}</div>
        </div>
      ) : null}

      <div className="log-toolbar">
        <div className="log-tabs">
          <Link href={href({ level: 'all' })} className={level === 'all' ? 'on' : ''}>
            전체 <span>{r.totalScanned.toLocaleString()}</span>
          </Link>
          <Link href={href({ level: 'error' })} className={level === 'error' ? 'on err' : 'err'}>
            에러만 <span>{r.errorCount.toLocaleString()}</span>
          </Link>
        </div>
        <div className="log-limits">
          {LIMITS.map((n) => (
            <Link key={n} href={href({ limit: n })} className={n === limit ? 'on' : ''}>
              {n.toLocaleString()}줄
            </Link>
          ))}
        </div>
      </div>

      <div className="log-legend">
        경고 {r.warnCount.toLocaleString()}건 · 표시 {r.lines.length.toLocaleString()}줄
        {r.sources.map((s) => (
          <span key={s.kind} className="log-src">
            {s.kind === 'out' ? '표준 출력' : '표준 에러'}:{' '}
            {s.error ? <em style={{ color: '#B91C1C' }}>{s.error}</em> : <code>{s.path}</code>}
          </span>
        ))}
      </div>

      {r.lines.length === 0 ? (
        <div className="empty">
          {level === 'error' ? '최근 로그에 에러가 없습니다' : '표시할 로그가 없습니다'}
        </div>
      ) : (
        <div className="log-view">
          {r.lines.map((l, i) => (
            <div key={`${l.at ?? ''}-${i}`} className={`log-line ${l.level}`}>
              <span className="log-time">{shortTime(l.at)}</span>
              <span className="log-text">{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
