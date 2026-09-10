import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeHealth } from './health';
import type { Sample } from './monitoring';

function sample(over: Partial<Sample> = {}): Sample {
  return {
    at: new Date(0),
    collectMs: 10,
    dbMs: 10,
    probeMs: 10,
    connections: { total: 10, active: 1, idle: 9, idleTx: 0, longestSec: 0.2, maxConnections: 100 },
    dbStats: {
      blksHit: 999, blksRead: 1, hitPct: 99.9, xactCommit: 1, xactRollback: 0,
      deadlocks: 0, tempFiles: 0, tempBytes: 0, statsReset: null,
    },
    slowQueries: [], tables: [], activeQueries: [],
    probes: [
      { label: 'a', path: '/a', ok: true, status: 200, ms: 120 },
      { label: 'b', path: '/b', ok: true, status: 200, ms: 180 },
    ],
    settings: [], errors: [],
    ...over,
  };
}

const find = (s: ReturnType<typeof summarizeHealth>, key: string) =>
  s.checks.find((c) => c.key === key)!;

test('모두 정상이면 전체 판정도 정상', () => {
  const s = summarizeHealth(sample());
  assert.equal(s.level, 'ok');
  assert.equal(find(s, 'api').level, 'ok');
  assert.equal(find(s, 'capacity').level, 'ok');
  assert.equal(s.checks.some((c) => c.key === 'collect'), false);
});

test('프로브가 하나라도 죽으면 전체가 위험', () => {
  const s = summarizeHealth(sample({
    probes: [
      { label: 'a', path: '/a', ok: true, status: 200, ms: 100 },
      { label: 'b', path: '/b', ok: false, status: 0, ms: 5000, error: 'timeout' },
    ],
  }));
  assert.equal(s.level, 'bad');
  assert.equal(find(s, 'api').level, 'bad');
  assert.equal(find(s, 'api').value, '1곳 응답 없음');
  // 평균 응답은 살아있는 프로브만으로 계산한다.
  assert.equal(find(s, 'speed').value, '100ms');
});

test('커넥션 사용률 임계값 — 60% 주의, 85% 위험', () => {
  const at = (total: number) => find(summarizeHealth(sample({
    connections: { total, active: 1, idle: total - 1, idleTx: 0, longestSec: 0, maxConnections: 100 },
  })), 'capacity');
  assert.equal(at(59).level, 'ok');
  assert.equal(at(60).level, 'warn');
  assert.equal(at(85).level, 'bad');
  assert.equal(at(85).ratio, 0.85);
});

test('캐시 적중률은 낮을수록 나쁘다 — 주의 97%, 위험 95%', () => {
  const at = (hitPct: number) => find(summarizeHealth(sample({
    dbStats: { ...sample().dbStats!, hitPct },
  })), 'cache');
  // 평상시 98% 대는 정상으로 본다. 99% 기준이면 배너가 상시 주황이었다.
  assert.equal(at(99.5).level, 'ok');
  assert.equal(at(98.1).level, 'ok');
  assert.equal(at(97.1).level, 'ok');
  assert.equal(at(97).level, 'warn');
  assert.equal(at(95.5).level, 'warn');
  assert.equal(at(95).level, 'bad');
  assert.equal(at(94).level, 'bad');
});

test('원자료가 없으면 위험이 아니라 확인 불가', () => {
  const s = summarizeHealth(sample({ connections: null, dbStats: null, probes: [] }));
  assert.equal(s.level, 'unknown');
  assert.equal(find(s, 'capacity').value, '확인 불가');
  assert.equal(find(s, 'capacity').ratio, null);
});

test('수집 실패는 항목으로 추가되고 주의로 올린다', () => {
  const s = summarizeHealth(sample({ errors: ['slowQueries: no permission'] }));
  assert.equal(s.level, 'warn');
  assert.equal(find(s, 'collect').value, '1건 실패');
});

test('게이지 비율은 0~1 을 벗어나지 않는다', () => {
  const s = summarizeHealth(sample({
    connections: { total: 500, active: 500, idle: 0, idleTx: 0, longestSec: 900, maxConnections: 100 },
  }));
  for (const c of s.checks) {
    if (c.ratio === null) continue;
    assert.ok(c.ratio >= 0 && c.ratio <= 1, `${c.key} ratio=${c.ratio}`);
  }
});
