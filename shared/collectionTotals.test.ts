import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectionTotals, displayTotalJpy } from './collectionTotals';

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

test('컬렉션을 전부 비우면 총액은 0 — 서버/캐시의 옛 총액으로 되돌아가지 않는다', () => {
  assert.equal(
    displayTotalJpy({ localCount: 0, localTotalJpy: 0, serverTotalJpy: 123_456, serverPsa10Jpy: 200_000, usePsa10: true }),
    0,
  );
  // 목록을 아직 못 받았으면(null) 서버 값으로 그린다 — 첫 진입 깜빡임 방지.
  assert.equal(displayTotalJpy({ localCount: null, localTotalJpy: 0, serverTotalJpy: 123_456 }), 123_456);
  // 목록이 있으면 로컬 합계가 정본.
  assert.equal(displayTotalJpy({ localCount: 3, localTotalJpy: 900, serverTotalJpy: 123_456 }), 900);
  // PSA10 모드는 서버 환산 총액 우선 — 단, 목록이 비면 0.
  assert.equal(
    displayTotalJpy({ localCount: 2, localTotalJpy: 900, serverTotalJpy: 800, serverPsa10Jpy: 1500, usePsa10: true }),
    1500,
  );
});
