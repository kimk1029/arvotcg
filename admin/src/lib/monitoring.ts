/**
 * 시스템 상태 수집 — DB 부하·응답속도 모니터링용.
 *
 * 원칙: **이 페이지 자체가 부하가 되면 안 된다.**
 *  - 읽는 곳은 전부 pg_stat_* / pg_settings 같은 메모리 상주 통계 뷰다. 실제 테이블을
 *    스캔하지 않으므로 디스크 I/O 가 0 이다. (테이블 크기만 pg_class 메타데이터 조회)
 *  - 결과는 프로세스 단위로 SAMPLE_TTL_MS 동안 캐시한다. 어드민 여러 명이 동시에 보거나
 *    화면을 자동 갱신해도 DB 조회는 30초에 한 번뿐이다.
 *  - 동시 요청은 single-flight 로 묶어 같은 조회가 겹쳐 뜨지 않는다.
 *  - API 서버 프로브는 서버가 자체 캐시로 응답하는 가벼운 엔드포인트만 친다.
 */
import { prisma } from './prisma';

const SAMPLE_TTL_MS = 30_000;
/** 추세용 인메모리 링버퍼 — 프로세스 재시작 시 사라진다(DB 저장 안 함). */
const HISTORY_MAX = 60;

const API_ORIGIN = process.env.ADMIN_API_ORIGIN ?? 'https://api.arvotcg.com';
const PROBE_TIMEOUT_MS = 5000;

export interface Connections {
  total: number;
  active: number;
  idle: number;
  idleTx: number;
  /** 지금 실행 중인 가장 오래된 쿼리의 경과 초. */
  longestSec: number;
  maxConnections: number;
}

export interface DbStats {
  blksHit: number;
  blksRead: number;
  /** 캐시 적중률 % — 99 미만이면 작업 세트가 shared_buffers 를 넘었다는 뜻. */
  hitPct: number;
  xactCommit: number;
  xactRollback: number;
  deadlocks: number;
  tempFiles: number;
  tempBytes: number;
  statsReset: Date | null;
}

export interface SlowQuery {
  query: string;
  calls: number;
  totalMs: number;
  meanMs: number;
  maxMs: number;
  diskReads: number;
}

export interface TableStat {
  name: string;
  liveTuples: number;
  seqScan: number;
  idxScan: number;
  bytes: number;
}

export interface ActiveQuery {
  pid: number;
  sec: number;
  query: string;
}

export interface Probe {
  label: string;
  path: string;
  ok: boolean;
  status: number;
  ms: number;
  error?: string;
}

export interface Setting {
  name: string;
  value: string;
}

export interface Sample {
  at: Date;
  /** 이 수집 자체에 걸린 시간(ms) — 어드민 DB 왕복 응답속도 지표. */
  collectMs: number;
  dbMs: number;
  probeMs: number;
  connections: Connections | null;
  dbStats: DbStats | null;
  slowQueries: SlowQuery[];
  tables: TableStat[];
  activeQueries: ActiveQuery[];
  probes: Probe[];
  settings: Setting[];
  errors: string[];
}

/** 추세 그래프용 최소 지표 — 샘플 전체를 들고 있지 않는다. */
export interface HistoryPoint {
  at: number;
  dbMs: number;
  apiMs: number;
  active: number;
  hitPct: number;
}

const history: HistoryPoint[] = [];
let cached: { at: number; sample: Sample } | null = null;
let inFlight: Promise<Sample> | null = null;

const num = (v: unknown): number => {
  const n = typeof v === 'bigint' ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** 8kB 단위로 나오는 pg_settings 값을 사람이 읽는 크기로. */
function fmtSetting(name: string, setting: string, unit: string | null): string {
  if (unit === '8kB') return `${Math.round((Number(setting) * 8) / 1024)} MB`;
  if (unit === 'kB') {
    const mb = Number(setting) / 1024;
    return mb >= 1 ? `${Math.round(mb)} MB` : `${setting} kB`;
  }
  if (unit === 'ms') return `${setting} ms`;
  void name;
  return unit ? `${setting} ${unit}` : setting;
}

async function collect(): Promise<Sample> {
  const startedAt = Date.now();
  const errors: string[] = [];
  const push = (label: string, err: unknown) =>
    errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);

  const dbStartedAt = Date.now();
  const [connRows, settingRows, statRows, slowRows, tableRows, activeRows] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE state = 'active')::int AS active,
             count(*) FILTER (WHERE state = 'idle')::int AS idle,
             count(*) FILTER (WHERE state = 'idle in transaction')::int AS idle_tx,
             -- clock_timestamp(): now() 는 트랜잭션 시작 시각이라 자기 자신 쿼리에서 음수가 난다.
             GREATEST(COALESCE(MAX(EXTRACT(EPOCH FROM clock_timestamp() - query_start))
                      FILTER (WHERE state = 'active' AND pid <> pg_backend_pid()), 0), 0)::float AS longest_sec
      FROM pg_stat_activity
    `.catch((e) => { push('connections', e); return []; }),
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT name, setting, unit FROM pg_settings
      WHERE name IN ('max_connections','shared_buffers','effective_cache_size','work_mem',
                     'maintenance_work_mem','statement_timeout')
      ORDER BY name
    `.catch((e) => { push('settings', e); return []; }),
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT blks_hit, blks_read, xact_commit, xact_rollback, deadlocks,
             temp_files, temp_bytes, stats_reset
      FROM pg_stat_database WHERE datname = current_database()
    `.catch((e) => { push('dbStats', e); return []; }),
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT left(regexp_replace(query, '[\n\t ]+', ' ', 'g'), 200) AS query,
             calls::int, total_exec_time, mean_exec_time, max_exec_time,
             shared_blks_read::bigint AS disk_reads
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat%' AND query NOT LIKE '%pg_settings%'
        AND query NOT IN ('BEGIN','COMMIT','DEALLOCATE ALL')
      ORDER BY total_exec_time DESC LIMIT 12
    `.catch((e) => { push('slowQueries', e); return []; }),
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT relname, n_live_tup::bigint, seq_scan::bigint, COALESCE(idx_scan, 0)::bigint AS idx_scan,
             pg_total_relation_size(relid)::bigint AS bytes
      FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 12
    `.catch((e) => { push('tables', e); return []; }),
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT pid::int, GREATEST(EXTRACT(EPOCH FROM clock_timestamp() - query_start), 0)::float AS sec,
             left(regexp_replace(query, '[\n\t ]+', ' ', 'g'), 200) AS query
      FROM pg_stat_activity
      WHERE state = 'active' AND pid <> pg_backend_pid() AND query_start IS NOT NULL
      ORDER BY 2 DESC LIMIT 6
    `.catch((e) => { push('activeQueries', e); return []; }),
  ]);
  const dbMs = Date.now() - dbStartedAt;

  const probeStartedAt = Date.now();
  const probes = await probeApi();
  const probeMs = Date.now() - probeStartedAt;

  const c = connRows[0];
  const maxConnections = num(
    settingRows.find((r) => r.name === 'max_connections')?.setting,
  );
  const connections: Connections | null = c
    ? {
        total: num(c.total),
        active: num(c.active),
        idle: num(c.idle),
        idleTx: num(c.idle_tx),
        longestSec: num(c.longest_sec),
        maxConnections,
      }
    : null;

  const s = statRows[0];
  const hit = num(s?.blks_hit);
  const read = num(s?.blks_read);
  const dbStats: DbStats | null = s
    ? {
        blksHit: hit,
        blksRead: read,
        hitPct: hit + read > 0 ? (hit / (hit + read)) * 100 : 100,
        xactCommit: num(s.xact_commit),
        xactRollback: num(s.xact_rollback),
        deadlocks: num(s.deadlocks),
        tempFiles: num(s.temp_files),
        tempBytes: num(s.temp_bytes),
        statsReset: s.stats_reset ? new Date(s.stats_reset as string) : null,
      }
    : null;

  const sample: Sample = {
    at: new Date(),
    collectMs: Date.now() - startedAt,
    dbMs,
    probeMs,
    connections,
    dbStats,
    slowQueries: slowRows.map((r) => ({
      query: String(r.query ?? ''),
      calls: num(r.calls),
      totalMs: num(r.total_exec_time),
      meanMs: num(r.mean_exec_time),
      maxMs: num(r.max_exec_time),
      diskReads: num(r.disk_reads),
    })),
    tables: tableRows.map((r) => ({
      name: String(r.relname ?? ''),
      liveTuples: num(r.n_live_tup),
      seqScan: num(r.seq_scan),
      idxScan: num(r.idx_scan),
      bytes: num(r.bytes),
    })),
    activeQueries: activeRows.map((r) => ({
      pid: num(r.pid),
      sec: num(r.sec),
      query: String(r.query ?? ''),
    })),
    probes,
    settings: settingRows.map((r) => ({
      name: String(r.name ?? ''),
      value: fmtSetting(String(r.name ?? ''), String(r.setting ?? ''), (r.unit as string) ?? null),
    })),
    errors,
  };

  const okProbes = probes.filter((p) => p.ok);
  history.push({
    at: sample.at.getTime(),
    dbMs: sample.dbMs,
    apiMs: okProbes.length ? Math.round(okProbes.reduce((a, p) => a + p.ms, 0) / okProbes.length) : 0,
    active: connections?.active ?? 0,
    hitPct: dbStats?.hitPct ?? 0,
  });
  while (history.length > HISTORY_MAX) history.shift();

  return sample;
}

/** API 서버가 자체 캐시로 답하는 가벼운 엔드포인트만 친다 — DB 를 건드리지 않는 프로브. */
const PROBE_TARGETS: Array<{ label: string; path: string }> = [
  { label: 'API 헬스체크', path: '/health' },
  { label: '배너 (서버 캐시)', path: '/api/banners' },
  { label: '홈 랭킹 (일 캐시)', path: '/api/snkrdunk/ranking?kind=snkr&game=pokemon&limit=1' },
];

async function probeApi(): Promise<Probe[]> {
  return Promise.all(
    PROBE_TARGETS.map(async ({ label, path }) => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${API_ORIGIN}${path}`, {
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
          cache: 'no-store',
        });
        // 본문까지 읽어야 실제 응답 완료 시간이 된다.
        await res.text();
        return { label, path, ok: res.ok, status: res.status, ms: Date.now() - t0 };
      } catch (err) {
        return {
          label,
          path,
          ok: false,
          status: 0,
          ms: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
}

/**
 * 캐시된 시스템 상태. 30초 안의 재요청은 DB 를 치지 않고 같은 값을 돌려준다.
 * 동시 요청도 하나로 묶인다(single-flight).
 */
export async function getSystemStatus(): Promise<{ sample: Sample; history: HistoryPoint[]; ageMs: number }> {
  const now = Date.now();
  if (cached && now - cached.at < SAMPLE_TTL_MS) {
    return { sample: cached.sample, history: [...history], ageMs: now - cached.at };
  }
  if (!inFlight) {
    inFlight = collect()
      .then((sample) => {
        cached = { at: Date.now(), sample };
        return sample;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  try {
    const sample = await inFlight;
    return { sample, history: [...history], ageMs: 0 };
  } catch (err) {
    // 수집이 실패해도 직전 값이 있으면 그걸 보여준다(화면이 통째로 죽지 않게).
    if (cached) return { sample: cached.sample, history: [...history], ageMs: Date.now() - cached.at };
    throw err;
  }
}

export const MONITORING_TTL_MS = SAMPLE_TTL_MS;
