import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectionTotals } from './collectionTotals';

test('총액은 등록가 폴백까지 포함해 수량만큼 합산, 손익은 실시세 카드만', () => {
  const t = collectionTotals(
    [
      { currentPriceJpy: 1500, registerPriceJpy: 1000, qty: 2 }, // 실시세
      { currentPriceJpy: 0, priceSingleJpy: 0, registerPriceJpy: 800, qty: 1 }, // 시세 미확보 → 등록가
      { currentPriceJpy: 0, priceSingleJpy: 0, pricePsa10Jpy: 0, qty: 1 }, // 값 없음 → 0
      { currentPriceJpy: 500, buyPrice: 4750, buyCurrency: 'KRW', qty: 1 }, // 구매가(원화) 환산 500엔
    ],
    9.5,
  );
  assert.equal(t.totalJpy, 1500 * 2 + 800 + 0 + 500);
  assert.equal(t.qty, 5);
  // 손익 = (1500-1000)*2 + (500-500)*1
  assert.equal(t.investedJpy, 1000 * 2 + 500);
  assert.equal(Math.round(t.profitJpy), 1000);
  assert.equal(t.profitPct != null, true);
});
