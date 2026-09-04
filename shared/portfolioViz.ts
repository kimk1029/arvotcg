/**
 * 포트폴리오 인포그래픽 — 집계·레이아웃 정본 (웹·모바일 공유).
 *
 * 차트는 "무엇을 보여줄지(집계)"와 "어디에 그릴지(기하)"가 정본이고,
 * 그리는 방법만 플랫폼마다 다르다(웹 inline SVG / 앱 react-native-svg).
 * 두 화면이 같은 숫자·같은 배치를 그리도록 이 파일만 고친다.
 *
 * 팔레트는 dataviz 검증기(validate_palette.js)를 통과한 값이다 —
 * 포트폴리오 보드 표면(#0C1426, dark)에서 5슬롯 전 항목 PASS:
 * 명도대역·채도하한·CVD 인접쌍 ΔE 8.4·정상시야 ΔE 19.3·대비 3:1 이상.
 * 슬롯 순서는 고정이며 순환(cycle)하지 않는다 — 6번째부터는 '기타'로 접는다.
 */

/** 카테고리 색 — 고정 순서. 절대 순환시키지 않는다(6번째 = 기타). */
export const VIZ_SERIES: readonly string[] = [
  '#3987e5', // blue
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
];
/** '기타' 묶음 — 중립 회색(카테고리 색을 새로 만들지 않는다). */
export const VIZ_OTHER = '#7D8AA5';
/** 상태색 — 상승/하락 전용. 카테고리 슬롯으로 재사용 금지. */
export const VIZ_UP = '#22C55E';
export const VIZ_DOWN = '#FF5B6E';
/** 보드 표면 — 팔레트 검증 기준면. */
export const VIZ_SURFACE = '#0C1426';

/** 차트 입력용으로 정규화한 보유 카드 1장. */
export interface VizCard {
  id: number;
  name: string;
  /** 평가액(JPY) = 현재시세 × 수량. */
  valueJpy: number;
  /** 매입/등록 기준액(JPY) × 수량. 없으면 null. */
  basisJpy: number | null;
  /** 손익률(%) 또는 일간 등락률(%). 없으면 null. */
  changePct: number | null;
  graded: boolean;
  /** 'RAW' | 'PSA 10' … — 등급 구성 차트용. */
  gradeLabel: string;
  game: string | null;
  series: string | null;
  selfPulled: boolean;
}

/** 누적바/범례 한 칸. */
export interface VizSlice {
  key: string;
  label: string;
  value: number;
  /** 전체 대비 비중(0~100). 전체가 0이면 0. */
  pct: number;
  color: string;
}

function sliceColor(i: number, isOther: boolean): string {
  return isOther ? VIZ_OTHER : (VIZ_SERIES[i] ?? VIZ_OTHER);
}

function toSlices(
  entries: Array<{ key: string; label: string; value: number }>,
  topN: number,
): VizSlice[] {
  const positive = entries.filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((a, e) => a + e.value, 0);
  if (total <= 0) return [];
  const head = positive.slice(0, topN);
  const tail = positive.slice(topN);
  const out: VizSlice[] = head.map((e, i) => ({
    key: e.key,
    label: e.label,
    value: e.value,
    pct: (e.value / total) * 100,
    color: sliceColor(i, false),
  }));
  if (tail.length > 0) {
    const rest = tail.reduce((a, e) => a + e.value, 0);
    out.push({
      key: '__other',
      label: `기타 ${tail.length}종`,
      value: rest,
      pct: (rest / total) * 100,
      color: VIZ_OTHER,
    });
  }
  return out;
}

/** 카드별 평가액 비중 — 상위 topN + 기타. */
export function compositionByCard(cards: VizCard[], topN = 5): VizSlice[] {
  return toSlices(
    cards.map((c) => ({ key: String(c.id), label: c.name, value: c.valueJpy })),
    topN,
  );
}

/** 임의 키로 묶은 평가액 비중 (등급·게임·시리즈·취득경로 공용). */
export function compositionBy(
  cards: VizCard[],
  pick: (c: VizCard) => { key: string; label: string } | null,
  topN = 5,
): VizSlice[] {
  const bucket = new Map<string, { key: string; label: string; value: number }>();
  for (const c of cards) {
    const k = pick(c);
    if (!k) continue;
    const prev = bucket.get(k.key);
    if (prev) prev.value += c.valueJpy;
    else bucket.set(k.key, { key: k.key, label: k.label, value: c.valueJpy });
  }
  return toSlices([...bucket.values()], topN);
}

const GAME_LABEL: Record<string, string> = {
  pokemon: '포켓몬',
  onepiece: '원피스',
  yugioh: '유희왕',
  sports: '스포츠',
  other: '기타 작품',
};

/** 게임(작품)별 구성. */
export function compositionByGame(cards: VizCard[], topN = 5): VizSlice[] {
  return compositionBy(
    cards,
    (c) => {
      const g = c.game ?? 'other';
      return { key: g, label: GAME_LABEL[g] ?? g };
    },
    topN,
  );
}

/** 등급별 구성 — RAW / PSA 10 / … */
export function compositionByGrade(cards: VizCard[], topN = 5): VizSlice[] {
  return compositionBy(cards, (c) => ({ key: c.gradeLabel, label: c.gradeLabel }), topN);
}

/** 취득 경로 — 직접 뽑기 vs 구매. */
export function compositionBySource(cards: VizCard[]): VizSlice[] {
  return compositionBy(
    cards,
    (c) => (c.selfPulled ? { key: 'pull', label: '직접 뽑기' } : { key: 'buy', label: '구매' }),
    2,
  );
}

/** 시리즈(팩)별 구성. */
export function compositionBySeries(cards: VizCard[], topN = 5): VizSlice[] {
  return compositionBy(cards, (c) => (c.series ? { key: c.series, label: c.series } : null), topN);
}

/** 발산형 바 한 줄 — 손익 상·하위. */
export interface VizMover {
  card: VizCard;
  pct: number;
  /** 0~1. 이 목록에서 가장 큰 |pct| 대비 길이 비율. */
  ratio: number;
}

/** 등락률 상위 n·하위 n. 데이터가 없으면 빈 배열. */
export function topMovers(cards: VizCard[], n = 5): { gainers: VizMover[]; losers: VizMover[] } {
  const withPct = cards.filter((c) => c.changePct != null && Number.isFinite(c.changePct));
  if (withPct.length === 0) return { gainers: [], losers: [] };
  const sorted = [...withPct].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  const up = sorted.filter((c) => (c.changePct ?? 0) > 0).slice(0, n);
  const down = sorted
    .filter((c) => (c.changePct ?? 0) < 0)
    .slice(-n)
    .reverse();
  // 좌우 바 길이는 같은 척도(양쪽 통틀어 최대 |%|)로 재야 비교가 성립한다.
  const scale = Math.max(
    ...[...up, ...down].map((c) => Math.abs(c.changePct ?? 0)),
    1,
  );
  const toMover = (c: VizCard): VizMover => ({
    card: c,
    pct: c.changePct ?? 0,
    ratio: Math.min(1, Math.abs(c.changePct ?? 0) / scale),
  });
  return { gainers: up.map(toMover), losers: down.map(toMover) };
}

/** 누적 가로바 배치 — 각 칸의 x/너비(px). 칸 사이 2px 표면 간격(마크 규칙). */
export function stackLayout(
  slices: VizSlice[],
  width: number,
  gap = 2,
): Array<{ slice: VizSlice; x: number; w: number }> {
  if (slices.length === 0 || width <= 0) return [];
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return [];
  const usable = Math.max(0, width - gap * (slices.length - 1));
  let x = 0;
  return slices.map((slice) => {
    // 얇은 칸도 보이도록 최소 3px — 합이 넘치면 마지막 칸이 흡수한다.
    const w = Math.max(3, (slice.value / total) * usable);
    const seg = { slice, x, w };
    x += w + gap;
    return seg;
  });
}

/** 투자원금 대비 평가 요약 — 매입/평가/손익 (수량 반영). */
export interface VizTotals {
  invested: number;
  current: number;
  profit: number;
  /** 손익률(%). 매입 정보가 없으면 null. */
  pct: number | null;
  /** 매입 정보가 있는 카드 수 / 전체. */
  pricedWithBasis: number;
}

export function investedTotals(cards: VizCard[]): VizTotals {
  let invested = 0;
  let current = 0;
  let n = 0;
  for (const c of cards) {
    if (c.basisJpy && c.basisJpy > 0 && c.valueJpy > 0) {
      invested += c.basisJpy;
      current += c.valueJpy;
      n += 1;
    }
  }
  const profit = current - invested;
  return {
    invested,
    current,
    profit,
    pct: invested > 0 ? (profit / invested) * 100 : null,
    pricedWithBasis: n,
  };
}

/** 집중도 지표 — 상위 1종·상위 3종 비중(%). 리스크 한눈에. */
export function concentration(cards: VizCard[]): { top1: number; top3: number } {
  const vals = cards.map((c) => c.valueJpy).filter((v) => v > 0).sort((a, b) => b - a);
  const total = vals.reduce((a, v) => a + v, 0);
  if (total <= 0) return { top1: 0, top3: 0 };
  const sum = (n: number) => vals.slice(0, n).reduce((a, v) => a + v, 0);
  return { top1: (sum(1) / total) * 100, top3: (sum(3) / total) * 100 };
}

/* ------------------------------------------------------------------ */
/* 확장 인포그래픽 — 히스토그램·타임라인·그레이딩 잠재가치·링·시장 비교      */
/* ------------------------------------------------------------------ */

/** 막대 한 칸 — 히스토그램/타임라인 공용. */
export interface VizBar {
  key: string;
  label: string;
  value: number;
  /** 보조 값(타임라인의 매입액 등). */
  extra?: number;
  /** 이 목록 최대값 대비 0~1. */
  ratio: number;
  color: string;
}

function toBars(rows: Array<{ key: string; label: string; value: number; extra?: number; color: string }>): VizBar[] {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return rows.map((r) => ({ ...r, ratio: max > 0 ? r.value / max : 0 }));
}

/** 손익률 분포 — 구간별 종목 수. 손익 정보 없는 카드는 제외. */
export function profitHistogram(cards: VizCard[]): VizBar[] {
  const buckets: Array<{ key: string; label: string; test: (p: number) => boolean; up: boolean }> = [
    { key: 'lt-20', label: '−20%↓', test: (p) => p < -20, up: false },
    { key: '-20-0', label: '−20~0', test: (p) => p >= -20 && p < 0, up: false },
    { key: '0-20', label: '0~20', test: (p) => p >= 0 && p < 20, up: true },
    { key: '20-50', label: '20~50', test: (p) => p >= 20 && p < 50, up: true },
    { key: 'gt50', label: '+50%↑', test: (p) => p >= 50, up: true },
  ];
  const withPct = cards.filter((c) => c.changePct != null && Number.isFinite(c.changePct));
  return toBars(
    buckets.map((b) => ({
      key: b.key,
      label: b.label,
      value: withPct.filter((c) => b.test(c.changePct as number)).length,
      color: b.up ? VIZ_UP : VIZ_DOWN,
    })),
  );
}

/** 평가액(JPY) 가격대 분포 — 구간별 종목 수. */
export function valueHistogram(cards: VizCard[]): VizBar[] {
  const buckets: Array<{ key: string; label: string; lo: number; hi: number }> = [
    { key: 'a', label: '~5천', lo: 0, hi: 5_000 },
    { key: 'b', label: '5천~2만', lo: 5_000, hi: 20_000 },
    { key: 'c', label: '2만~5만', lo: 20_000, hi: 50_000 },
    { key: 'd', label: '5만~10만', lo: 50_000, hi: 100_000 },
    { key: 'e', label: '10만~', lo: 100_000, hi: Infinity },
  ];
  return toBars(
    buckets.map((b) => ({
      key: b.key,
      label: b.label,
      value: cards.filter((c) => c.valueJpy >= b.lo && c.valueJpy < b.hi).length,
      color: VIZ_SERIES[0],
    })),
  );
}

/** 승률·평균/중앙 손익률 — 손익 정보 있는 카드 기준. 없으면 null. */
export interface WinStats {
  n: number;
  winRate: number;
  avgPct: number;
  medianPct: number;
}
export function winStats(cards: VizCard[]): WinStats | null {
  const pcts = cards
    .map((c) => c.changePct)
    .filter((p): p is number => p != null && Number.isFinite(p))
    .sort((a, b) => a - b);
  if (pcts.length === 0) return null;
  const wins = pcts.filter((p) => p > 0).length;
  const mid = Math.floor(pcts.length / 2);
  return {
    n: pcts.length,
    winRate: (wins / pcts.length) * 100,
    avgPct: pcts.reduce((a, b) => a + b, 0) / pcts.length,
    medianPct: pcts.length % 2 ? pcts[mid] : (pcts[mid - 1] + pcts[mid]) / 2,
  };
}

/** 매입 타임라인 입력 — 카드별 취득 월("YYYY-MM")과 매입/등록 기준액. */
export interface VizAcquisition {
  month: string;
  basisJpy: number;
  qty: number;
}

/** 월별 취득 건수·매입액 — 최근 `months`개월(빈 달 0 포함). 오래된 → 최신. */
export function acquisitionTimeline(rows: VizAcquisition[], months = 12): VizBar[] {
  if (rows.length === 0) return [];
  const last = rows.map((r) => r.month).sort().pop() as string;
  const [y0, m0] = last.split('-').map(Number);
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y0, m0 - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const byMonth = new Map<string, { n: number; spend: number }>();
  for (const r of rows) {
    const cur = byMonth.get(r.month) ?? { n: 0, spend: 0 };
    cur.n += Math.max(1, r.qty);
    cur.spend += r.basisJpy;
    byMonth.set(r.month, cur);
  }
  return toBars(
    keys.map((k) => {
      const v = byMonth.get(k);
      return { key: k, label: k.slice(2).replace('-', '.'), value: v?.n ?? 0, extra: v?.spend ?? 0, color: VIZ_SERIES[2] };
    }),
  );
}

/** 그레이딩 잠재가치 — 비등급 보유분의 raw 총액 vs PSA10 환산 총액. */
export interface GradingUpside {
  /** PSA10 시세가 있는 비등급 카드 수. */
  n: number;
  rawJpy: number;
  psa10Jpy: number;
  diffJpy: number;
  pct: number;
}
export function gradingUpside(
  rows: Array<{ graded: boolean; qty: number; singleJpy: number; psa10Jpy: number }>,
): GradingUpside | null {
  let raw = 0;
  let psa = 0;
  let n = 0;
  for (const r of rows) {
    if (r.graded || !(r.singleJpy > 0) || !(r.psa10Jpy > 0)) continue;
    const q = Math.max(1, r.qty);
    raw += r.singleJpy * q;
    psa += r.psa10Jpy * q;
    n += 1;
  }
  if (n === 0 || raw <= 0) return null;
  return { n, rawJpy: raw, psa10Jpy: psa, diffJpy: psa - raw, pct: ((psa - raw) / raw) * 100 };
}

/** 링(도넛) 조각 — SVG arc path. 총합 0 이면 빈 배열. */
export interface RingArc {
  slice: VizSlice;
  d: string;
}
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
export function ringArcs(slices: VizSlice[], cx: number, cy: number, rOuter: number, rInner: number, gapDeg = 2): RingArc[] {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return [];
  let start = 0;
  const out: RingArc[] = [];
  for (const slice of slices) {
    const sweep = (slice.value / total) * 360;
    const a0 = start + gapDeg / 2;
    const a1 = start + sweep - gapDeg / 2;
    start += sweep;
    if (a1 <= a0) continue;
    const large = a1 - a0 > 180 ? 1 : 0;
    const [ox0, oy0] = polar(cx, cy, rOuter, a0);
    const [ox1, oy1] = polar(cx, cy, rOuter, a1);
    const [ix0, iy0] = polar(cx, cy, rInner, a1);
    const [ix1, iy1] = polar(cx, cy, rInner, a0);
    const f = (n: number) => n.toFixed(2);
    out.push({
      slice,
      d: `M ${f(ox0)} ${f(oy0)} A ${rOuter} ${rOuter} 0 ${large} 1 ${f(ox1)} ${f(oy1)} L ${f(ix0)} ${f(iy0)} A ${rInner} ${rInner} 0 ${large} 0 ${f(ix1)} ${f(iy1)} Z`,
    });
  }
  return out;
}

/**
 * 파이(원형) 조각 — ringArcs 의 rInner=0 특수형. 조각 사이 gapDeg 만큼 표면이 비어
 * 인접 색이 맞닿지 않는다(마크 규칙). 조각이 하나뿐이면 arcs 는 비고 `full` 이 켜진다
 * — 호출부가 온전한 원 하나를 그리면 된다(360° 호는 SVG 에서 그릴 수 없다).
 */
export function pieSlices(
  slices: VizSlice[],
  cx: number,
  cy: number,
  r: number,
  gapDeg = 2,
): { arcs: RingArc[]; full: VizSlice | null } {
  const positive = slices.filter((s) => s.value > 0);
  if (positive.length === 1) return { arcs: [], full: positive[0] };
  return { arcs: ringArcs(positive, cx, cy, r, 0, gapDeg), full: null };
}

/** 날짜·값 시계열을 첫 포인트 = 100 으로 재기준화 (내 자산 vs 시장 비교용). */
export function rebaseTo100(points: Array<{ date: string; value: number }>): Array<{ date: string; value: number }> {
  const base = points.find((p) => p.value > 0)?.value;
  if (!base) return [];
  return points.filter((p) => p.value > 0).map((p) => ({ date: p.date, value: (p.value / base) * 100 }));
}

/** 기준 구간(내 자산 히스토리의 첫 날짜 이후)으로 시장 시리즈를 잘라 100 재기준화. */
export function alignAndRebase(
  points: Array<{ date: string; value: number }>,
  fromDate: string,
  toDate: string,
): Array<{ date: string; value: number }> {
  return rebaseTo100(points.filter((p) => p.date >= fromDate && p.date <= toDate));
}
