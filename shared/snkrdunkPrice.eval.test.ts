import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluationUnitJpy } from './snkrdunkPrice';

test('평가 단가 폴백 — 등급가 → 싱글 → PSA10 → 등록가', () => {
  assert.equal(evaluationUnitJpy({ gradeJpy: 900, singleJpy: 500, basisJpy: 100 }), 900);
  assert.equal(evaluationUnitJpy({ gradeJpy: 0, singleJpy: 500, basisJpy: 100 }), 500);
  assert.equal(evaluationUnitJpy({ gradeJpy: 0, singleJpy: 0, psa10Jpy: 700, basisJpy: 100 }), 700);
  // 시세를 하나도 못 받은 카드 — 등록가로라도 합산된다.
  assert.equal(evaluationUnitJpy({ basisJpy: 100 }), 100);
  // 아무 값도 없으면 0 (합산 제외).
  assert.equal(evaluationUnitJpy({ gradeJpy: null, singleJpy: 0, psa10Jpy: null, basisJpy: null }), 0);
});
