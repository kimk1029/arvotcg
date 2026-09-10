import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupDuplicates } from './collectionGroup';

const row = (
  id: number,
  apparelId: number | null,
  basisJpy: number | null,
  cur: number,
  qty = 1,
  graded = false,
) => ({
  c: { id, snkrdunkApparelId: apparelId, graded, gradeCompany: graded ? 'PSA' : null, gradeValue: graded ? '10' : null },
  qty,
  basisJpy,
  value: cur * qty,
});

test('같은 카드·같은 등급만 묶이고, 장수·평가액·손익률이 합산된다', () => {
  const groups = groupDuplicates([
    row(1, 100, 1000, 1500),
    row(2, 100, 2000, 1500), // 같은 카드 중복 등록 — 등록가만 다름
    row(3, 100, 1000, 4000, 1, true), // 같은 카드지만 PSA10 — 별도 그룹
    row(4, null, 500, 700), // 상품 식별자 없음 — 묶이지 않음
  ]);

  assert.equal(groups.length, 3);
  const [dup, psa, unknown] = groups;
  assert.deepEqual(dup.items.map((r) => r.c.id), [1, 2]);
  assert.equal(dup.qty, 2);
  assert.equal(dup.value, 3000);
  // (3000 - 3000) / 3000
  assert.equal(dup.profitPct, 0);
  assert.equal(dup.investedJpy, 3000);
  assert.equal(dup.profitAbsJpy, 0);
  assert.equal(psa.items.length, 1);
  assert.equal(unknown.items.length, 1);
});

test('수량(qty)과 기준가 없는 장을 손익률에서 제외한다', () => {
  const [g] = groupDuplicates([row(1, 7, 1000, 1200, 2), row(2, 7, null, 1200)]);
  assert.equal(g.qty, 3);
  assert.equal(g.value, 3600);
  // 기준가 있는 2장만: (2400-2000)/2000
  assert.equal(g.profitPct, 20);
  assert.equal(g.investedJpy, 2000);
  assert.equal(g.profitAbsJpy, 400);
});

test('사용자 묶음(bundleId)은 상품·등급이 달라도 한 그룹, 없으면 기존 규칙', () => {
  const a = { ...row(1, 100, 1000, 1500), c: { ...row(1, 100, 1000, 1500).c, bundleId: 'x' } };
  const b = { ...row(2, 200, 500, 900, 1, true), c: { ...row(2, 200, 500, 900, 1, true).c, bundleId: 'x' } };
  const groups = groupDuplicates([a, b, row(3, 100, 1000, 1500)]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].items.map((r) => r.c.id), [1, 2]);
  assert.equal(groups[0].value, 2400);
  assert.equal(groups[1].items.length, 1);
});
