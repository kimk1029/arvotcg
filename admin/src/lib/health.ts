/**
 * 시스템 상태를 비전문가가 읽을 수 있는 형태로 요약한다.
 *
 * monitoring.ts 는 pg_stat 원자료를 모으고, 이 파일은 그 숫자를
 * "정상/주의/위험" 판정과 한 문장 설명으로 바꾸는 순수 로직만 담는다.
 * 화면(page.tsx)은 여기 결과를 그리기만 한다.
 */
import type { Sample } from './monitoring';

export type HealthLevel = 'ok' | 'unknown' | 'warn' | 'bad';

/** 나쁠수록 큰 값 — 전체 판정은 항목 중 최댓값. */
const RANK: Record<HealthLevel, number> = { ok: 0, unknown: 1, warn: 2, bad: 3 };

export const LEVEL_COLOR: Record<HealthLevel, string> = {
  ok: '#15803D',
  unknown: '#64748B',
  warn: '#B45309',
  bad: '#B91C1C',
};

export const LEVEL_BG: Record<HealthLevel, string> = {
  ok: '#ECFDF5',
  unknown: '#F1F5F9',
  warn: '#FFFBEB',
  bad: '#FEF2F2',
};

export const LEVEL_LABEL: Record<HealthLevel, string> = {
  ok: '정상',
  unknown: '확인 불가',
  warn: '주의',
  bad: '위험',
};

export interface HealthCheck {
  key: string;
  /** 비전문가용 제목. */
  title: string;
  level: HealthLevel;
  /** 카드에 크게 보여줄 값. */
  value: string;
  /** 이 항목이 무슨 뜻인지 한 문장. */
  detail: string;
  /** 게이지 채움 비율 0~1. null 이면 게이지를 그리지 않는다. */
  ratio: number | null;
  /** 게이지 오른쪽 끝이 뜻하는 값. */
  scale: string | null;
}

export interface HealthSummary {
  level: HealthLevel;
  title: string;
  message: string;
  checks: HealthCheck[];
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** 값이 클수록 나쁜 지표의 등급. */
function worseWhenHigh(value: number, warn: number, bad: number): HealthLevel {
  if (value >= bad) return 'bad';
  if (value >= warn) return 'warn';
  return 'ok';
}

/** 값이 작을수록 나쁜 지표의 등급. */
function worseWhenLow(value: number, warn: number, bad: number): HealthLevel {
  if (value <= bad) return 'bad';
  if (value <= warn) return 'warn';
  return 'ok';
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}초` : `${Math.round(ms)}ms`;
}

/** 원자료 표본 → 비전문가용 요약. 표본이 비어 있어도 예외를 던지지 않는다. */
export function summarizeHealth(sample: Sample): HealthSummary {
  const checks: HealthCheck[] = [];

  // 1. 서버가 응답하는가 — 사용자가 가장 먼저 체감하는 것.
  const probes = sample.probes;
  const okProbes = probes.filter((p) => p.ok);
  const down = probes.length - okProbes.length;
  checks.push({
    key: 'api',
    title: '서비스 응답',
    level: probes.length === 0 ? 'unknown' : down > 0 ? 'bad' : 'ok',
    value: probes.length === 0 ? '확인 불가' : down > 0 ? `${down}곳 응답 없음` : '모두 정상',
    detail:
      down > 0
        ? '앱과 웹이 쓰는 서버 중 일부가 응답하지 않습니다. 사용자에게 오류 화면이 보일 수 있습니다.'
        : '앱과 웹이 쓰는 서버가 모두 정상 응답합니다.',
    ratio: probes.length ? okProbes.length / probes.length : null,
    scale: probes.length ? `${probes.length}곳 중 ${okProbes.length}곳` : null,
  });

  // 2. 얼마나 빨리 응답하는가.
  const apiAvgMs = okProbes.length
    ? okProbes.reduce((a, p) => a + p.ms, 0) / okProbes.length
    : 0;
  checks.push({
    key: 'speed',
    title: '응답 속도',
    level: okProbes.length === 0 ? 'unknown' : worseWhenHigh(apiAvgMs, 800, 2000),
    value: okProbes.length ? fmtMs(apiAvgMs) : '확인 불가',
    detail: '사용자가 화면을 열 때 서버를 기다리는 시간입니다. 0.8초 아래면 빠릿합니다.',
    ratio: okProbes.length ? clamp01(apiAvgMs / 2000) : null,
    scale: '느림 기준 2초',
  });

  // 3. 동시 접속을 더 받을 여유가 있는가.
  const conn = sample.connections;
  const connPct = conn && conn.maxConnections > 0 ? (conn.total / conn.maxConnections) * 100 : 0;
  checks.push({
    key: 'capacity',
    title: '동시 접속 여유',
    level: !conn || conn.maxConnections <= 0 ? 'unknown' : worseWhenHigh(connPct, 60, 85),
    value: conn && conn.maxConnections > 0 ? `${Math.round(connPct)}% 사용` : '확인 불가',
    detail:
      '데이터베이스에 동시에 연결할 수 있는 자리입니다. 가득 차면 새 접속이 거부되어 앱이 멈춘 것처럼 보입니다.',
    ratio: conn && conn.maxConnections > 0 ? clamp01(connPct / 100) : null,
    scale: conn ? `${conn.total} / ${conn.maxConnections}자리` : null,
  });

  // 4. 오래 붙들고 있는 작업이 있는가.
  checks.push({
    key: 'longest',
    title: '가장 오래 걸리는 작업',
    level: !conn ? 'unknown' : worseWhenHigh(conn.longestSec, 3, 10),
    value: conn ? `${conn.longestSec.toFixed(1)}초` : '확인 불가',
    detail: '지금 실행 중인 가장 긴 작업입니다. 길어지면 다른 사용자의 요청이 뒤에서 밀립니다.',
    ratio: conn ? clamp01(conn.longestSec / 10) : null,
    scale: '위험 기준 10초',
  });

  // 5. 자주 쓰는 데이터가 메모리에서 바로 나오는가.
  const db = sample.dbStats;
  checks.push({
    key: 'cache',
    title: '데이터 즉시 응답률',
    level: !db ? 'unknown' : worseWhenLow(db.hitPct, 99, 95),
    value: db ? `${db.hitPct.toFixed(1)}%` : '확인 불가',
    detail:
      '자주 쓰는 데이터가 디스크까지 가지 않고 메모리에서 바로 나온 비율입니다. 99% 아래로 떨어지면 전체가 느려집니다.',
    ratio: db ? clamp01(db.hitPct / 100) : null,
    scale: '목표 99% 이상',
  });

  // 6. 상태 수집 자체가 실패했는가 — 있을 때만 보여준다.
  if (sample.errors.length > 0) {
    checks.push({
      key: 'collect',
      title: '상태 수집',
      level: 'warn',
      value: `${sample.errors.length}건 실패`,
      detail: '상태를 읽는 중 일부 항목을 가져오지 못했습니다. 아래 기술 상세에서 원인을 확인하세요.',
      ratio: null,
      scale: null,
    });
  }

  const level = checks.reduce<HealthLevel>(
    (worst, c) => (RANK[c.level] > RANK[worst] ? c.level : worst),
    'ok',
  );
  const badCount = checks.filter((c) => c.level === 'bad').length;
  const warnCount = checks.filter((c) => c.level === 'warn').length;

  const title =
    level === 'ok' ? '정상 작동 중'
    : level === 'unknown' ? '일부 항목 확인 불가'
    : level === 'warn' ? '주의가 필요합니다'
    : '지금 조치가 필요합니다';

  const message =
    level === 'ok' ? '모든 항목이 정상 범위입니다. 지금은 손댈 것이 없습니다.'
    : level === 'unknown' ? '일부 항목을 읽지 못했습니다. 읽어온 항목은 모두 정상입니다.'
    : level === 'warn' ? `${warnCount}개 항목이 평소보다 나쁩니다. 서비스는 아직 동작하지만 지켜봐야 합니다.`
    : `${badCount}개 항목이 위험 범위입니다. 사용자에게 오류나 지연이 보일 수 있습니다.`;

  return { level, title, message, checks };
}
