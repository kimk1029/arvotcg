import assert from 'node:assert/strict';
import { test } from 'node:test';
import { additionIndexMap, additionLabel } from './portfolioViz';

test('추가 마커는 히스토리 안의 날짜만 인덱스로 매핑된다', () => {
  const history = [{ date: '2026-09-07' }, { date: '2026-09-08' }, { date: '2026-09-09' }];
  const m = additionIndexMap(history, [
    { date: '2026-09-08', count: 2, names: ['리자몽', '피카츄'] },
    { date: '2026-01-01', count: 1, names: ['옛날카드'] }, // 구간 밖 → 버림
  ]);
  assert.equal(m.size, 1);
  assert.equal(m.get(1)?.count, 2);
  assert.equal(additionLabel(m.get(1)!), '＋ 리자몽 외 1장');
  assert.equal(additionLabel({ date: 'x', count: 1, names: ['리자몽'] }), '＋ 리자몽');
  assert.equal(additionIndexMap(history, undefined).size, 0);
});
