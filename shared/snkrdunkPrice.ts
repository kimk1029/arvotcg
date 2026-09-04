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
  // RAW 판정은 gradeAgg('RAW') 와 반드시 같은 술어를 써야 한다 — 목록가(중앙값)와
  // 시세상세 RAW 탭이 같은 표본에서 나와야 숫자가 일치한다.
  const rawMedian = median(pickPrices((b) => !isGradedSnkrdunkBadge(b)));
  const rawCeil = rawMedian > 0 ? rawMedian * 2.5 : Infinity;
  const trendJpy = (chartPoints ?? [])
    .map((p) => p[1])
    .filter((n) => typeof n === 'number' && n > 0 && n <= rawCeil);
  const hasGradedSales = pickPrices((b) => isGradedSnkrdunkBadge(b)).length > 0;

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
  /**
   * 대표가 — 최근 체결 중앙값(최대 7건). 목록(홈 HOT·컬렉션)과 시세상세 헤드라인이
   * 모두 이 값을 쓴다. 단일 체결(recent)은 튀는 값 하나에 화면이 흔들려 기준으로
   * 쓰지 않는다(파일 상단 규칙 — "최근 체결 중앙값"이 정본).
   */
  median: number;
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
  if (matches.length === 0) return { key, median: 0, recent: 0, avg: 0, low: 0, count: 0 };
  const top5 = matches.slice(0, 5);
  const avg = Math.round(top5.reduce((a, b) => a + b, 0) / top5.length);
  const low = Math.min(...matches.slice(0, 10));
  // computeApparelPrices 와 같은 표본(최근 7건)·같은 통계(중앙값).
  return { key, median: median(matches.slice(0, 7)), recent: matches[0], avg, low, count: matches.length };
}

/** RAW→PSA10 그레이딩 시 가격 상승폭 — 등급별 투자 수익률 섹션(웹·앱 공통). */
export interface GradeUplift {
  rawAvg: number;
  psa10Avg: number;
  /** psa10Avg - rawAvg (JPY). */
  diff: number;
  /** rawAvg 대비 상승률(%). */
  pct: number;
}

/** RAW 평균가 → PSA10 평균가 상승폭. 한쪽이라도 데이터가 없으면 null (UI 는 '데이터 부족'). */
export function gradeUplift(rawAvg: number, psa10Avg: number): GradeUplift | null {
  if (!(rawAvg > 0) || !(psa10Avg > 0)) return null;
  const diff = psa10Avg - rawAvg;
  return { rawAvg, psa10Avg, diff, pct: (diff / rawAvg) * 100 };
}

/** 대표 시세 결과 — 가격 + 어느 등급 기준인지('PSA 10' | 'PSA 9' | 'RAW'). */
export interface Headline {
  price: number;
  basis: string;
}

/** 시세상세가 노출하는 등급 탭 — 표시 순서 그대로. */
export function gradeAggsFromHistory(history: SnkrdunkSaleEntry[]): SnkrGradeAgg[] {
  // PSA 8 은 체결이 있을 때만 탭을 만든다 — 등록가가 PSA8 기준인 컬렉션 카드가
  // 시세상세에서 같은 가격을 보이려면 탭이 있어야 한다(빈 탭은 만들지 않음).
  const psa8 = gradeAgg(history, (b) => PSA8_RE.test(b), 'PSA 8');
  return [
    gradeAgg(history, (b) => PSA10_RE.test(b), 'PSA 10'),
    gradeAgg(history, (b) => PSA9_RE.test(b), 'PSA 9'),
    ...(psa8.count > 0 ? [psa8] : []),
    gradeAgg(history, (b) => !isGradedSnkrdunkBadge(b), 'RAW'),
  ];
}

/**
 * 한 등급의 화면 표시가 — 중앙값 → 평균 → 최저매물 순 폴백.
 * 목록(홈 HOT·컬렉션)과 시세상세 헤드라인이 반드시 이 함수를 거쳐야 숫자가 일치한다.
 */
export function gradeDisplayJpy(agg: SnkrGradeAgg | undefined, minPrice: number): number {
  return agg?.median || agg?.avg || minPrice || 0;
}

/** 거래가 가장 많은 등급(= 시세상세 기본 탭). 데이터가 없으면 RAW. */
export function defaultGradeKey(grades: SnkrGradeAgg[]): string {
  return (
    grades.slice().sort((a, b) => b.count - a.count).find((g) => g.count > 0)?.key ??
    grades[grades.length - 1]?.key ??
    'RAW'
  );
}

/**
 * 시세상세 헤드라인과 동일한 '대표 시세' — 거래가 가장 많은 등급의 최근 체결 중앙값
 * (없으면 평균 → 최저매물 순 폴백)과 그 등급 기준을 함께 반환.
 * 목록에서 이 basis 를 시세상세로 넘기면(?grade=) 첫 화면 가격이 목록과 같아진다.
 */
export function headlineFromHistory(history: SnkrdunkSaleEntry[], minPrice: number): Headline {
  const grades = gradeAggsFromHistory(history);
  const key = defaultGradeKey(grades);
  return { price: gradeDisplayJpy(grades.find((g) => g.key === key), minPrice), basis: key };
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

/* ── 박스(미개봉 상품) 시세 — 등급 개념이 없으므로 전체 체결에서 바로 집계 ── */

/**
 * 박스 대표 시세 — 최근 체결(최신순) 7건 중앙값 → 없으면 최저매물.
 * 박스 거래 배지(未開封/シュリンク付き/中古)는 isGradedSnkrdunkBadge 로 걸러지지 않아
 * 등급 집계(gradeAggsFromHistory)를 쓰면 RAW 가 오염된다 → 박스는 이 함수만 쓴다.
 */
export function boxHeadlineFromHistory(
  history: ReadonlyArray<{ price: number }>,
  minPrice: number,
): number {
  const prices = history.filter((h) => typeof h.price === 'number' && h.price > 0).map((h) => h.price);
  if (prices.length === 0) return minPrice || 0;
  return median(prices.slice(0, 7)) || minPrice || 0;
}

/** 시세상세 '전일 대비 / 7일 변동률' — 판매 차트 포인트([ts, price]) 기준. 웹·앱 공통. */
export interface PriceChange {
  prevDiff: number;
  prevPct: number | null;
  wkDiff: number;
  wkPct: number | null;
}

export function priceChangeFromPoints(points: ReadonlyArray<[number, number]>): PriceChange {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  if (pts.length < 2) return { prevDiff: 0, prevPct: null, wkDiff: 0, wkPct: null };
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const prevDiff = last[1] - prev[1];
  const prevPct = prev[1] > 0 ? (prevDiff / prev[1]) * 100 : null;
  const weekAgoTs = last[0] - 7 * 86_400_000;
  let base = pts[0];
  for (const p of pts) {
    if (p[0] <= weekAgoTs) base = p;
    else break;
  }
  const wkDiff = last[1] - base[1];
  const wkPct = base[1] > 0 ? (wkDiff / base[1]) * 100 : null;
  return { prevDiff, prevPct, wkDiff, wkPct };
}

/* ── 박스 가격 추이 — 일일 스냅샷 시리즈 ──────────────────────────── */

/** `/api/snkrdunk/apparels/:id/price-stats` 의 일별 행 (KST 기준 하루 1행). */
export interface DailyPriceStat {
  /** 'YYYY-MM-DD' (KST). */
  date: string;
  single: number;
  minPrice: number;
  psa10: number;
  samples: number;
}

/**
 * 박스 '가격 추이' 포인트 — 일일 스냅샷(priceSingle)에서 만든다.
 *
 * 스니덩크 `/sales-chart` 는 "2박스 세트·카톤" 같은 복수 수량 체결까지 섞은 일별
 * 평균이라 박스 1개 헤드라인가(단일 개체 체결만 남긴 sales-history 중앙값)와
 * 2~4배씩 어긋난다 — 실제로 헤드라인 ¥13,490 인 박스의 차트가 ¥27,000~¥51,000 였다.
 * 스냅샷의 priceSingle 은 헤드라인과 같은 표본·같은 통계라 두 숫자가 맞는다.
 * 스냅샷 보관 기간(최대 90일) 때문에 박스 기간 탭은 BOX_RANGE_MAX_DAYS 까지만 쓴다.
 */
export function boxTrendPoints(daily: readonly DailyPriceStat[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const d of daily ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d?.date ?? '')) continue;
    const price = d.single > 0 ? d.single : d.minPrice;
    if (!(price > 0)) continue;
    const ts = Date.parse(`${d.date}T00:00:00+09:00`);
    if (!Number.isFinite(ts)) continue;
    out.push([ts, price]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/** 스냅샷 보관 상한 — 박스 기간 탭은 이 일수를 넘기지 않는다(서버 price-stats 상한). */
export const BOX_RANGE_MAX_DAYS = 90;
