import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyDelta } from './portfolioDelta';

test('N일 변화는 인덱스가 아니라 날짜로 기준점을 찾는다', () => {
  // 드문드문한 히스토리 — 인덱스 7칸 전은 존재하지 않는다.
  const h = [
    { date: '2026-08-01', totalJpy: 1000 },
    { date: '2026-08-20', totalJpy: 1500 },
    { date: '2026-09-02', totalJpy: 2000 },
    { date: '2026-09-04', totalJpy: 2100 },
    { date: '2026-09-10', totalJpy: 2400 },
  ];
  const d7 = historyDelta(h, 7);
  // 09-10 − 7일 = 09-03 이하의 최근 스냅샷 = 09-02(2000)
  assert.deepEqual(d7, { abs: 400, pct: 20, baseDate: '2026-09-02' });
  const d30 = historyDelta(h, 30);
  // 08-11 이하 = 08-01(1000)
  assert.equal(d30?.baseDate, '2026-08-01');
  assert.equal(d30?.abs, 1400);
});

test('N일치 데이터가 없으면 null', () => {
  const h = [
    { date: '2026-09-08', totalJpy: 1000 },
    { date: '2026-09-10', totalJpy: 1200 },
  ];
  assert.equal(historyDelta(h, 7), null);
  assert.equal(historyDelta([], 7), null);
});
