/**
 * 내 컬렉션 총 자산 — 웹·앱의 모든 화면(내 컬렉션 히어로, 마이페이지 요약, 포트폴리오 상세)이
 * **이 함수 하나로** 같은 숫자를 그린다. 화면마다 다르게 합산해 값이 어긋나던 문제의 정본.
 *
 * 규칙(서버 /api/me/portfolio 와 동일):
 *  · 단가 = 등급 일치 시세(currentPriceJpy) → 싱글 → PSA10 → 등록가(폴백, evaluationUnitJpy)
 *  · 총액 = Σ 단가 × 수량 — 시세를 못 받은 카드도 등록가로 반드시 합산된다
 *  · 손익 = 실시세가 있는 카드만 (등록가 폴백 카드는 손익 0 으로 섞이지 않게)
 */
import { evaluationUnitJpy } from './snkrdunkPrice';

export interface TotalsCard {
  currentPriceJpy?: number | null;
  priceSingleJpy?: number | null;
  pricePsa10Jpy?: number | null;
  registerPriceJpy?: number | null;
  buyPrice?: number | null;
  buyCurrency?: string | null;
  qty?: number | null;
  graded?: boolean | null;
  itemKind?: 'single' | 'box' | null;
}

export interface CollectionTotals {
  /** 총 자산 가치(엔). */
  totalJpy: number;
  /** 보유 장수(수량 합). */
  qty: number;
  /** 매입(등록) 합계 — 실시세가 있는 카드만. */
  investedJpy: number;
  /** 평가 손익 — 실시세가 있는 카드만. */
  profitJpy: number;
  /** 누적 수익률(%) — 매입 합계가 0 이면 null. */
  profitPct: number | null;
}

/** 기준가(엔) — 구매가 우선(원화면 rate 로 환산), 없으면 등록가. */
export function basisJpyOf(c: TotalsCard, jpyKrwRate: number): number | null {
  if (c.buyPrice != null && c.buyPrice > 0) {
    return c.buyCurrency === 'JPY' ? c.buyPrice : c.buyPrice / (jpyKrwRate || 1);
  }
  return c.registerPriceJpy != null && c.registerPriceJpy > 0 ? c.registerPriceJpy : null;
}

/** 등급 일치 실시세(엔) — 0 이면 시세 미확보. */
export function livePriceJpyOf(c: TotalsCard): number {
  const cur = c.currentPriceJpy ?? 0;
  if (cur > 0) return cur;
  return (c.graded ? c.pricePsa10Jpy : c.priceSingleJpy) ?? 0;
}

export function collectionTotals(cards: TotalsCard[], jpyKrwRate: number): CollectionTotals {
  let totalJpy = 0;
  let qty = 0;
  let investedJpy = 0;
  let currentJpy = 0;
  for (const c of cards) {
    const n = Math.max(1, c.qty || 1);
    const basis = basisJpyOf(c, jpyKrwRate);
    const live = livePriceJpyOf(c);
    const unit = evaluationUnitJpy({
      gradeJpy: live,
      singleJpy: c.priceSingleJpy,
      psa10Jpy: c.pricePsa10Jpy,
      basisJpy: basis,
    });
    qty += n;
    totalJpy += unit * n;
    if (basis && basis > 0 && live > 0) {
      investedJpy += basis * n;
      currentJpy += live * n;
    }
  }
  const profitJpy = currentJpy - investedJpy;
  return {
    totalJpy,
    qty,
    investedJpy,
    profitJpy,
    profitPct: investedJpy > 0 ? (profitJpy / investedJpy) * 100 : null,
  };
}

/**
 * 화면에 그릴 총 자산(엔) — **목록을 이미 받아왔다면 그 목록이 정본**이다.
 *
 * 카드를 전부 지워 목록이 비면 0 이 진실이므로 서버/세션 캐시의 옛 총액으로 폴백하지 않는다.
 * (기존 `local > 0 ? local : server` 폴백이 빈 컬렉션에서 삭제 전 금액을 되살렸다.)
 * 폴백은 목록을 아직 못 받았을 때(localCount === null)와, 목록은 있는데 합계가 0 인
 * 과도기(시세 미수신)에만 쓴다.
 */
export function displayTotalJpy(o: {
  /** 화면이 합산한 카드 수. 목록 미수신이면 null. */
  localCount: number | null;
  /** collectionTotals(...).totalJpy */
  localTotalJpy: number;
  /** 서버 /api/me/portfolio totalJpy */
  serverTotalJpy?: number | null;
  /** 서버 PSA10 환산 총액 — 화면이 PSA10 모드일 때만 쓴다. */
  serverPsa10Jpy?: number | null;
  usePsa10?: boolean;
}): number {
  // 빈 컬렉션 — 0 이 정답. 서버/캐시의 옛 값으로 되돌아가지 않는다.
  if (o.localCount === 0) return 0;
  if (o.usePsa10 && (o.serverPsa10Jpy ?? 0) > 0) return o.serverPsa10Jpy as number;
  if (o.localTotalJpy > 0) return o.localTotalJpy;
  return o.serverTotalJpy ?? 0;
}
