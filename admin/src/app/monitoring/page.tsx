import { getSystemStatus, MONITORING_TTL_MS, type HistoryPoint } from '@/lib/monitoring';
import { fmtDate } from '@/lib/format';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

/**
 * 시스템 상태 — DB 부하와 응답속도 모니터링.
 *
 * 이 화면은 pg_stat_* 통계 뷰만 읽고 결과를 30초 캐시한다(=자동 갱신 주기와 동일).
 * 어드민 몇 명이 동시에 켜두든 DB 조회는 30초에 한 번뿐이라 부하가 늘지 않는다.
 */

const MB = 1024 * 1024;
const fmtBytes = (b: number) => (b >= MB ? `${(b / MB).toFixed(b >= 100 * MB ? 0 : 1)} MB` : `${Math.round(b / 1024)} kB`);
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);
const fmtNum = (n: number) => n.toLocaleString();

/** 임계값 기준 색 — 초록(정상) / 주황(주의) / 빨강(위험). */
function tone(value: number, warn: number, bad: number, higherIsWorse = true): string {
  const over = (t: number) => (higherIsWorse ? value >= t : value <= t);
  if (over(bad)) return '#B91C1C';
  if (over(warn)) return '#B45309';
  return '#15803D';
}

/** 인메모리 히스토리 스파크라인 — 저장소를 쓰지 않는다. */
function Spark({ points, pick, color }: { points: HistoryPoint[]; pick: (p: HistoryPoint) => number; color: string }) {
  if (points.length < 2) return <div style={{ height: 28, fontSize: 11, color: '#94A3B8' }}>추세 수집 중…</div>;
  const vals = points.map(pick);
  const max = Math.max(1, ...vals);
  const w = 160;
  const h = 28;
  const d = vals
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (vals.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`)
    .join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export default async function Page() {
  const { sample, history, ageMs } = await getSystemStatus();
  const { connections: conn, dbStats: db } = sample;

  const connPct = conn && conn.maxConnections > 0 ? (conn.total / conn.maxConnections) * 100 : 0;
  const okProbes = sample.probes.filter((p) => p.ok);
  const apiAvgMs = okProbes.length ? okProbes.reduce((a, p) => a + p.ms, 0) / okProbes.length : 0;

  return (
    <>
      <AutoRefresh seconds={30} />
      <h1 className="admin-h1">시스템 상태</h1>
      <p className="admin-sub">
        수집 {fmtDate(sample.at)} · {ageMs > 0 ? `${Math.round(ageMs / 1000)}초 전 캐시` : '방금 갱신'} ·{' '}
        {Math.round(MONITORING_TTL_MS / 1000)}초마다 자동 갱신
      </p>
      <p className="admin-sub">
        pg_stat 통계 뷰만 읽고 결과를 {Math.round(MONITORING_TTL_MS / 1000)}초 캐시합니다. 실제 테이블을 스캔하지 않으므로
        이 화면을 여러 명이 동시에 켜두어도 DB 조회는 {Math.round(MONITORING_TTL_MS / 1000)}초에 한 번뿐입니다.
      </p>

      {sample.errors.length > 0 ? (
        <div className="card" style={{ marginBottom: 16, borderColor: '#FCA5A5' }}>
          <h2 style={{ color: '#B91C1C' }}>수집 실패 항목</h2>
          {sample.errors.map((e) => (
            <div key={e} className="mono" style={{ fontSize: 12, color: '#B91C1C' }}>{e}</div>
          ))}
        </div>
      ) : null}

      <div className="grid-stats">
        <div className="stat-card">
          <div className="lbl">DB 커넥션</div>
          <div className="val" style={{ color: tone(connPct, 60, 85) }}>
            {conn ? `${conn.total} / ${conn.maxConnections}` : '—'}
          </div>
          <div className="sub">
            활성 {conn?.active ?? 0} · 유휴 {conn?.idle ?? 0} · 트랜잭션 유휴 {conn?.idleTx ?? 0}
          </div>
        </div>

        <div className="stat-card">
          <div className="lbl">최장 실행 쿼리</div>
          <div className="val" style={{ color: tone(conn?.longestSec ?? 0, 3, 10) }}>
            {conn ? `${conn.longestSec.toFixed(1)}s` : '—'}
          </div>
          <div className="sub">3초 넘게 도는 쿼리는 커넥션을 붙들어 풀을 마르게 합니다</div>
        </div>

        <div className="stat-card">
          <div className="lbl">캐시 적중률</div>
          <div className="val" style={{ color: tone(db?.hitPct ?? 100, 99, 95, false) }}>
            {db ? `${db.hitPct.toFixed(2)}%` : '—'}
          </div>
          <div className="sub">
            디스크 읽기 {fmtNum(db?.blksRead ?? 0)} 블록 · 99% 미만이면 작업 세트가 캐시를 넘었습니다
          </div>
          <Spark points={history} pick={(p) => p.hitPct} color="#129782" />
        </div>

        <div className="stat-card">
          <div className="lbl">어드민 DB 왕복</div>
          <div className="val" style={{ color: tone(sample.dbMs, 500, 1500) }}>{fmtMs(sample.dbMs)}</div>
          <div className="sub">이 화면의 통계 쿼리 6건 합계 · 전체 수집 {fmtMs(sample.collectMs)}</div>
          <Spark points={history} pick={(p) => p.dbMs} color="#2563EB" />
        </div>

        <div className="stat-card">
          <div className="lbl">API 서버 응답</div>
          <div className="val" style={{ color: okProbes.length === sample.probes.length ? tone(apiAvgMs, 800, 2000) : '#B91C1C' }}>
            {okProbes.length ? fmtMs(apiAvgMs) : '실패'}
          </div>
          <div className="sub">
            {okProbes.length}/{sample.probes.length} 정상 · 캐시 응답 엔드포인트 기준
          </div>
          <Spark points={history} pick={(p) => p.apiMs} color="#D97706" />
        </div>

        <div className="stat-card">
          <div className="lbl">트랜잭션</div>
          <div className="val">{fmtNum(db?.xactCommit ?? 0)}</div>
          <div className="sub">
            커밋 · 롤백 {fmtNum(db?.xactRollback ?? 0)} · 데드락 {fmtNum(db?.deadlocks ?? 0)} · 임시파일{' '}
            {fmtNum(db?.tempFiles ?? 0)}
          </div>
        </div>
      </div>

      <h2 className="sect-h"><span className="dot" />API 서버 엔드포인트</h2>
      <table className="tbl">
        <thead>
          <tr><th>대상</th><th>경로</th><th>상태</th><th>응답</th></tr>
        </thead>
        <tbody>
          {sample.probes.map((p) => (
            <tr key={p.path}>
              <td>{p.label}</td>
              <td className="mono" style={{ fontSize: 12 }}>{p.path}</td>
              <td style={{ color: p.ok ? '#15803D' : '#B91C1C', fontWeight: 600 }}>
                {p.ok ? `${p.status} OK` : p.error ? `실패 — ${p.error}` : `HTTP ${p.status}`}
              </td>
              <td style={{ color: tone(p.ms, 800, 2000), fontWeight: 600 }}>{fmtMs(p.ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="sect-h"><span className="dot" />지금 실행 중인 쿼리</h2>
      {sample.activeQueries.length === 0 ? (
        <div className="empty">실행 중인 쿼리 없음</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr><th>PID</th><th>경과</th><th>쿼리</th></tr>
          </thead>
          <tbody>
            {sample.activeQueries.map((q) => (
              <tr key={q.pid}>
                <td className="mono">{q.pid}</td>
                <td style={{ color: tone(q.sec, 3, 10), fontWeight: 600 }}>{q.sec.toFixed(1)}s</td>
                <td className="mono" style={{ fontSize: 12, maxWidth: 700 }}>{q.query}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="sect-h"><span className="dot" />누적 부하 TOP 12</h2>
      <p className="admin-sub">
        pg_stat_statements 누적{db?.statsReset ? ` · 집계 시작 ${fmtDate(db.statsReset)}` : ''}. 디스크 읽기가 큰 쿼리가
        이 DB 에서 가장 비싼 쿼리입니다.
      </p>
      {sample.slowQueries.length === 0 ? (
        <div className="empty">통계 없음 (pg_stat_statements 미설치 또는 권한 없음)</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr><th>총 시간</th><th>호출</th><th>평균</th><th>최대</th><th>디스크 읽기</th><th>쿼리</th></tr>
          </thead>
          <tbody>
            {sample.slowQueries.map((q) => (
              <tr key={q.query}>
                <td style={{ fontWeight: 600 }}>{fmtMs(q.totalMs)}</td>
                <td>{fmtNum(q.calls)}</td>
                <td style={{ color: tone(q.meanMs, 200, 1000) }}>{fmtMs(q.meanMs)}</td>
                <td style={{ color: tone(q.maxMs, 1000, 5000) }}>{fmtMs(q.maxMs)}</td>
                <td style={{ color: tone(q.diskReads, 100_000, 1_000_000) }}>{fmtNum(q.diskReads)}</td>
                <td className="mono" style={{ fontSize: 12, maxWidth: 620 }}>{q.query}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="sect-h"><span className="dot" />테이블 크기 · 스캔</h2>
      <p className="admin-sub">
        크기가 캐시(shared_buffers)를 넘는 테이블을 자주 순차 스캔(seq scan)하면 매번 디스크로 갑니다.
      </p>
      <table className="tbl">
        <thead>
          <tr><th>테이블</th><th>크기</th><th>행 수</th><th>순차 스캔</th><th>인덱스 스캔</th></tr>
        </thead>
        <tbody>
          {sample.tables.map((t) => (
            <tr key={t.name}>
              <td className="mono">{t.name}</td>
              <td style={{ fontWeight: 600 }}>{fmtBytes(t.bytes)}</td>
              <td>{fmtNum(t.liveTuples)}</td>
              <td style={{ color: t.seqScan > t.idxScan && t.bytes > 50 * MB ? '#B45309' : undefined }}>
                {fmtNum(t.seqScan)}
              </td>
              <td>{fmtNum(t.idxScan)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="sect-h"><span className="dot" />DB 인스턴스 설정</h2>
      <table className="tbl">
        <thead>
          <tr><th>항목</th><th>값</th></tr>
        </thead>
        <tbody>
          {sample.settings.map((s) => (
            <tr key={s.name}>
              <td className="mono">{s.name}</td>
              <td style={{ fontWeight: 600 }}>{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
