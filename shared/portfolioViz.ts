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
