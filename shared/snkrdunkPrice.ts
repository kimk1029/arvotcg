/**
 * 스니덩크 카드 시세 계산 — "최근 체결 중앙값" 단일 진실의 원천.
 * 웹·모바일·NAS 서버 공유 단일 소스 (src/lib/snkrdunkPrice.ts 는 shim).
 *
 * 스캔 매칭 후보 / 내 컬렉션(getMyCardsWithPrices) / 포트폴리오가 모두 이 함수를
 * 써서 같은 카드에 같은 가격을 보여주도록 한다(불일치 방지).
 *
 * 규칙:
 *  - raw(비등급) 최근 체결 중앙값을 단가로 사용.
 *  - PSA 등급 체결은 분리(별도 PSA10 중앙값). raw 단가 계산에서 제외.
 *  - sales-chart/used 시리즈엔 등급 체결이 섞여 끝점이 튀므로, raw 중앙값의 2.5배
 *    초과 포인트는 등급 거래로 보고 제외.
 *  - raw 체결이 없으면: (등급 체결만 있으면) 0 으로 둬 오염 차단, 아니면 차트 끝점
 *    → 최저매물(minPrice) 순으로 폴백.
 */
import { isGradedSnkrdunkBadge, type SnkrdunkSaleEntry } from './snkrdunk';

const PSA10_RE = /PSA\s*10\b/i;
const PSA9_RE = /PSA\s*9\b/i;
const PSA8_RE = /PSA\s*8\b/i;
const PSA_ANY_RE = /PSA\s*\d+/i;

/** PSA 등급 숫자(10/9/8…)에 해당하는 배지 정규식. */
export function psaGradeRe(n: number): RegExp {
  return new RegExp(`PSA\\s*${n}\\b`, 'i');
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export interface ApparelPrices {
  /** raw(비등급) 최근 체결 중앙값. 데이터 없으면 0. */
  single: number;
  /** PSA10 최근 체결 중앙값. 없으면 0. */
  psa10: number;
  /** PSA9 최근 체결 중앙값. 없으면 0. */
  psa9: number;
  /** PSA8 최근 체결 중앙값. 없으면 0. */
  psa8: number;
  /** 차트 일별 시세 시리즈(오래된→최신), 등급 오염 포인트 제외. */
  trendJpy: number[];
}

/** 이미 받아온 sales history/chart + minPrice 로 시세를 계산(순수 함수). */
export function computeApparelPrices(
  history: SnkrdunkSaleEntry[],
  chartPoints: Array<[number, number]>,
  minPrice: number,
): ApparelPrices {
  const pickPrices = (predicate: (badge: string) => boolean) =>
    history
      .filter((h) => typeof h.price === 'number' && h.price > 0)
      .filter((h) => predicate((h.condition || h.label || '').trim()))
      .map((h) => h.price)
      .slice(0, 7);

  const psa10Prices = pickPrices((b) => PSA10_RE.test(b));
  const psa9Prices = pickPrices((b) => PSA9_RE.test(b));
  const psa8Prices = pickPrices((b) => PSA8_RE.test(b));
  const rawMedian = median(pickPrices((b) => !PSA_ANY_RE.test(b)));
  const rawCeil = rawMedian > 0 ? rawMedian * 2.5 : Infinity;
  const trendJpy = (chartPoints ?? [])
    .map((p) => p[1])
    .filter((n) => typeof n === 'number' && n > 0 && n <= rawCeil);
  const hasGradedSales = pickPrices((b) => PSA_ANY_RE.test(b)).length > 0;

  let single = rawMedian;
  if (single === 0 && !hasGradedSales) {
    single = trendJpy.length > 0 ? trendJpy[trendJpy.length - 1] : 0;
    if (single === 0 && typeof minPrice === 'number' && minPrice > 0) {
      single = minPrice;
    }
  }
  return {
    single,
    psa10: median(psa10Prices),
    psa9: median(psa9Prices),
    psa8: median(psa8Prices),
    trendJpy,
  };
}

/* ------------------------------------------------------------------ */
/* 등록가(registerPriceJpy) 산정 — 컬렉션 등록 팝업의 "등록가격" 규칙      */
/* ------------------------------------------------------------------ */

/** 등록가 산정에 쓰이는 카드 형태 정보 (등록 팝업 입력값). */
export interface RegisterGradeInput {
  graded: boolean;
  /** 'PSA' | 'BGS' | 'CGC' | ... (graded 일 때만 의미). */
  gradeCompany?: string | null;
  /** '10' | '9' | '8' ... (graded 일 때만 의미). */
  gradeValue?: string | null;
}

export interface RegisterBasis {
  /** 등록가(JPY). 산정 불가 시 0. */
  price: number;
  /** 어떤 시세를 썼는지 — 'PSA 10' | 'PSA 9' | 'PSA 8' | 'RAW'. 표시/디버깅용. */
  basis: string;
}

/**
 * 구매가 미입력 카드의 등록가(JPY) 결정 — 등록 당시 시세 스냅.
 *  · 등급카드(PSA): 해당 등급(10/9/8) 최근 체결 중앙값. 그 등급 데이터가 없으면
 *    PSA10 → 싱글 순 폴백.
 *  · 등급카드(타사 BGS/CGC 등): 자체 시세 데이터가 없으므로 PSA10 기준.
 *  · 싱글(비등급)/직접뽑기: raw 싱글가.
 * prices 는 computeApparelPrices 결과.
 */
export function registerBasisJpy(prices: ApparelPrices, grade: RegisterGradeInput): RegisterBasis {
  if (!grade.graded) {
    return { price: prices.single, basis: 'RAW' };
  }
  const company = (grade.gradeCompany ?? 'PSA').trim().toUpperCase();
  const n = parseInt(String(grade.gradeValue ?? '').replace(/[^0-9]/g, ''), 10);
  if (company === 'PSA') {
    if (n === 9 && prices.psa9 > 0) return { price: prices.psa9, basis: 'PSA 9' };
    if (n === 8 && prices.psa8 > 0) return { price: prices.psa8, basis: 'PSA 8' };
    if (n === 10 && prices.psa10 > 0) return { price: prices.psa10, basis: 'PSA 10' };
  }
  // 타사 등급 or 해당 PSA 등급 체결 없음 → PSA10 기준, 그것도 없으면 싱글.
  if (prices.psa10 > 0) return { price: prices.psa10, basis: 'PSA 10' };
  return { price: prices.single, basis: 'RAW' };
}

/**
 * 컬렉션 카드의 "현재시세" 기준값 — 등록가와 같은 등급 기준으로 비교해야
 * 등락률이 의미가 있다. 등급 시세가 없으면 PSA10 → 싱글 순 폴백 (등록가와 동일 규칙).
 */
export function currentBasisJpy(prices: ApparelPrices, grade: RegisterGradeInput): number {
  return registerBasisJpy(prices, grade).price;
}

/** 한 등급의 최근가/평균/최저/건수 집계. (history 는 최신순 전제) — 시세상세와 공유. */
export interface SnkrGradeAgg {
  /** 'PSA 10' | 'PSA 9' | 'RAW' */
  key: string;
  recent: number;
  avg: number;
  low: number;
  count: number;
}

/** 거래내역에서 한 등급의 최근가/평균/최저/건수 집계. (history 는 최신순 전제) */
export function gradeAgg(
  history: ReadonlyArray<{ price: number; condition?: string; label?: string }>,
  predicate: (badge: string) => boolean,
  key: string,
): SnkrGradeAgg {
  const matches = history
    .filter((h) => typeof h.price === 'number' && h.price > 0)
    .filter((h) => predicate((h.condition || h.label || '').trim()))
    .map((h) => h.price);
  if (matches.length === 0) return { key, recent: 0, avg: 0, low: 0, count: 0 };
  const top5 = matches.slice(0, 5);
  const avg = Math.round(top5.reduce((a, b) => a + b, 0) / top5.length);
  const low = Math.min(...matches.slice(0, 10));
  return { key, recent: matches[0], avg, low, count: matches.length };
}

/** 대표 시세 결과 — 가격 + 어느 등급 기준인지('PSA 10' | 'PSA 9' | 'RAW'). */
export interface Headline {
  price: number;
  basis: string;
}

/**
 * 시세상세 헤드라인과 동일한 '대표 시세' — 거래가 가장 많은 등급의 최근 체결가
 * (없으면 평균 → 최저매물 순 폴백)와 그 등급 기준을 함께 반환.
 * CardDetailView 의 기본 헤드라인 계산과 일치.
 */
export function headlineFromHistory(history: SnkrdunkSaleEntry[], minPrice: number): Headline {
  const grades = [
    gradeAgg(history, (b) => PSA10_RE.test(b), 'PSA 10'),
    gradeAgg(history, (b) => PSA9_RE.test(b), 'PSA 9'),
    gradeAgg(history, (b) => !isGradedSnkrdunkBadge(b), 'RAW'),
  ];
  const sel =
    grades.slice().sort((a, b) => b.count - a.count).find((g) => g.count > 0) ??
    grades[grades.length - 1];
  return { price: sel?.recent || sel?.avg || minPrice || 0, basis: sel?.key ?? 'RAW' };
}

/** 대표 시세 가격만 (기준 등급은 무시). */
export function headlinePriceFromHistory(history: SnkrdunkSaleEntry[], minPrice: number): number {
  return headlineFromHistory(history, minPrice).price;
}

/**
 * 판매 차트 포인트에서 '어제 대비' 등락률(%)을 계산. 최신 시세 vs 그 하루(24h) 전 시세.
 * 등급 체결 스파이크는 중앙값 2.5배 초과 컷으로 제외(used 차트 오염 방지).
 * 포인트는 [timestamp(ms), price] 형식. 유효 포인트가 2개 미만이면 undefined.
 * 하루 전 포인트가 없으면(그날치만 있음) 직전 체결로 폴백.
 */
export function trendChangePct(points: Array<[number, number]>): number | undefined {
  const DAY_MS = 86_400_000;
  const valid = (points ?? [])
    .filter((p) => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number' && p[1] > 0)
    .sort((a, b) => a[0] - b[0]);
  if (valid.length < 2) return undefined;
  const med = median(valid.map((p) => p[1]));
  const ceil = med > 0 ? med * 2.5 : Infinity;
  const clean = valid.filter((p) => p[1] <= ceil);
  if (clean.length < 2) return undefined;
  const [lastTs, last] = clean[clean.length - 1];
  // 어제 시세 = 최신 포인트보다 약 하루 이상 오래된 가장 최근 포인트.
  const cutoff = lastTs - DAY_MS;
  let prev: number | undefined;
  for (let i = clean.length - 2; i >= 0; i--) {
    if (clean[i][0] <= cutoff) {
      prev = clean[i][1];
      break;
    }
  }
  if (prev === undefined) prev = clean[clean.length - 2][1];
  if (prev <= 0) return undefined;
  return ((last - prev) / prev) * 100;
}
