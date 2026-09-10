import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyLine, filterByLevel, mergeLogLines, parseLogLines } from './serverLogs';

test('pm2 시각 접두사를 떼어내고 본문만 남긴다', () => {
  const [l] = parseLogLines('2026-09-10T04:16:44: [dailySnapshot] done: 2 recorded', 'out');
  assert.equal(l.at, '2026-09-10T04:16:44');
  assert.equal(l.text, '[dailySnapshot] done: 2 recorded');
  assert.equal(l.level, 'info');
});

test('접두사가 없는 줄도 버리지 않는다', () => {
  const [l] = parseLogLines('plain line without timestamp', 'out');
  assert.equal(l.at, null);
  assert.equal(l.text, 'plain line without timestamp');
});

test('표준 에러로 나온 줄은 내용과 무관하게 error', () => {
  assert.equal(classifyLine('그냥 안내 문구입니다', 'err'), 'error');
  assert.equal(parseLogLines('2026-09-10T04:23:43:     at async foo (x.ts:1:2)', 'err')[0].level, 'error');
});

test('표준 출력에 섞인 실패 로그도 error 로 잡는다', () => {
  for (const s of ['[kream] direct blocked — request failed', 'TypeError: x is not a function',
                   'connect ECONNREFUSED 1.2.3.4:5432', '[feeds.GET] internal error']) {
    assert.equal(classifyLine(s, 'out'), 'error', s);
  }
});

test('평범한 줄을 error 로 오인하지 않는다', () => {
  for (const s of ['OCR server listening http://localhost:3030 vision=on',
                   '[dailySnapshot] next batch in 13m (max 50 cards)',
                   'terror-free deployment']) {
    assert.notEqual(classifyLine(s, 'out'), 'error', s);
  }
});

test('집계 로그의 0건 보고는 에러가 아니다 — 실측 오탐', () => {
  assert.equal(classifyLine('[dailySnapshot] done: 2 recorded / 0 failed / 2 tried', 'out'), 'info');
  assert.equal(classifyLine('[warm] finished with no errors', 'out'), 'info');
  // 0건이 아니면 여전히 에러다.
  assert.equal(classifyLine('[dailySnapshot] done: 2 recorded / 3 failed / 5 tried', 'out'), 'error');
});

test('경고는 warn 으로 따로 구분한다', () => {
  assert.equal(classifyLine('[cache] slow query, retrying', 'out'), 'warn');
  assert.equal(classifyLine('DeprecationWarning: punycode', 'out'), 'warn');
});

test('두 파일을 시각순으로 합치고 마지막 N 줄만 남긴다', () => {
  const out = parseLogLines('2026-09-10T04:00:00: a\n2026-09-10T04:00:30: c', 'out');
  const err = parseLogLines('2026-09-10T04:00:10: b', 'err');
  const merged = mergeLogLines([out, err], 10);
  assert.deepEqual(merged.map((l) => l.text), ['a', 'b', 'c']);
  assert.deepEqual(mergeLogLines([out, err], 2).map((l) => l.text), ['b', 'c']);
});

test('시각 없는 줄은 바로 앞 줄 시각을 물려받아 순서가 안 흐트러진다', () => {
  const err = parseLogLines('2026-09-10T04:00:10: Error: boom\n    at foo\n    at bar', 'err');
  const out = parseLogLines('2026-09-10T04:00:20: after', 'out');
  assert.deepEqual(mergeLogLines([err, out], 10).map((l) => l.text),
    ['Error: boom', '    at foo', '    at bar', 'after']);
});

test('에러만 필터', () => {
  const lines = [
    ...parseLogLines('2026-09-10T04:00:00: ok', 'out'),
    ...parseLogLines('2026-09-10T04:00:01: boom', 'err'),
  ];
  assert.equal(filterByLevel(lines, 'all').length, 2);
  assert.deepEqual(filterByLevel(lines, 'error').map((l) => l.text), ['boom']);
});
