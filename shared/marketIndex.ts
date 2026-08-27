/**
 * 시장 지표(TCG 인덱스) — 타입·요약·차트 기하 정본 (웹·모바일·서버 공유).
 *
 * 포트폴리오 '시장 지표' 섹션이 그리는 데이터. 지수 산출 자체는 서버
 * (server/lib/marketIndex.ts)가 하고, 여기는 응답 타입과 "화면이 같은 숫자를
 * 내도록" 하는 순수 함수(기간 절단·변동률·선 경로)만 둔다.
 *
 * 소스
 *  · pokemon : S&Poké 500 (poké500.com) — TCGplayer 영문 raw 싱글 상위 500종,
 *              가격가중·디바이저 방식, 2024-02-08 = 1000. 공개 JSON 을 캐시 서빙.
 *  · onepiece: ARVO OP200 — 같은 산식을 tcgcsv(TCGplayer 일별 시세 덤프)의
 *              원피스 카테고리에 적용해 서버가 직접 계산. 2024-02-08 = 1000.
 */

export type MarketIndexKey = 'pokemon' | 'onepiece';

export interface MarketIndexPoint {
  /** "YYYY-MM-DD" (UTC 기준일). */
  date: string;
  value: number;
}

export interface MarketIndexBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
}

export interface MarketIndexSeries {
  key: MarketIndexKey;
  /** 화면 제목 — '포켓몬 TCG 지수'. */
  label: string;
  /** 지수 이름 — 'S&Poké 500' | 'ARVO OP200'. */
  indexName: string;
  /** 바스켓 설명 — '영문 raw 싱글 상위 500종 · TCGplayer 시장가'. */
  basketLabel: string;
  /** 출처 표기(저작 귀속). */
  source: string;
  sourceUrl: string;
  /** 마지막 포인트 날짜. */
  asOf: string;
  value: number;
  change1d: number | null;
  change7d: number | null;
  change30d: number | null;
  change90d: number | null;
  breadth: MarketIndexBreadth | null;
  /** 오래된 → 최신. */
  points: MarketIndexPoint[];
}

export interface MarketIndexResponse {
  generatedAt: string;
  series: MarketIndexSeries[];
}

/** 차트 기간 탭 — 일수(0 = 전체). 웹·앱 동일 순서. */
export const MARKET_INDEX_RANGES: ReadonlyArray<{ days: number; label: string }> = [
  { days: 30, label: '1개월' },
  { days: 90, label: '3개월' },
  { days: 180, label: '6개월' },
  { days: 365, label: '1년' },
  { days: 0, label: '전체' },
];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 마지막 포인트 기준 최근 `days`일 구간(0 = 전체). 경계 직전 포인트 하나를 앞에 포함. */
export function sliceRange(points: MarketIndexPoint[], days: number): MarketIndexPoint[] {
  if (days <= 0 || points.length === 0) return points;
  const cutoff = addDays(points[points.length - 1].date, -days);
  let start = points.findIndex((p) => p.date >= cutoff);
  if (start < 0) return points;
  if (start > 0) start -= 1;
  return points.slice(start);
}

/**
 * `days`일 전 대비 변동률(%). 기준값 = 마지막 날짜 − days 이하의 가장 최근 포인트.
 * 그런 포인트가 없으면(시리즈가 더 짧음) null. days=1 은 직전 포인트 대비.
 */
export function pctChangeOver(points: MarketIndexPoint[], days: number): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  if (days <= 1) {
    const prev = points[points.length - 2];
    return prev.value > 0 ? ((last.value - prev.value) / prev.value) * 100 : null;
  }
  const cutoff = addDays(last.date, -days);
  let base: MarketIndexPoint | null = null;
  for (let i = points.length - 2; i >= 0; i--) {
    if (points[i].date <= cutoff) {
      base = points[i];
      break;
    }
  }
  if (!base || base.value <= 0) return null;
  return ((last.value - base.value) / base.value) * 100;
}

/** 시리즈 요약 — 마지막 값 + 1일/7일/30일/90일 변동률. */
export function summarizePoints(points: MarketIndexPoint[]): {
  asOf: string;
  value: number;
  change1d: number | null;
  change7d: number | null;
  change30d: number | null;
  change90d: number | null;
} {
  const last = points[points.length - 1];
  return {
    asOf: last?.date ?? '',
    value: last?.value ?? 0,
    change1d: pctChangeOver(points, 1),
    change7d: pctChangeOver(points, 7),
    change30d: pctChangeOver(points, 30),
    change90d: pctChangeOver(points, 90),
  };
}

/** 선 차트 기하 — 날짜 간격을 실제 일수에 비례해 x 에 배치(주간·일간 혼재 구간 왜곡 방지). */
export interface LineGeometry {
  /** 각 포인트의 [x, y]. */
  xy: Array<[number, number]>;
  /** SVG path d (선). */
  linePath: string;
  /** 선 + 바닥까지 닫은 영역 path d. */
  areaPath: string;
  min: number;
  max: number;
}

export function lineGeometry(
  points: MarketIndexPoint[],
  width: number,
  height: number,
  pad = 6,
): LineGeometry {
  if (points.length === 0) {
    return { xy: [], linePath: '', areaPath: '', min: 0, max: 0 };
  }
  const t0 = Date.parse(`${points[0].date}T00:00:00Z`);
  const t1 = Date.parse(`${points[points.length - 1].date}T00:00:00Z`);
  const span = Math.max(1, t1 - t0);
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const vspan = Math.max(1e-9, max - min);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const xy = points.map((p): [number, number] => {
    const t = Date.parse(`${p.date}T00:00:00Z`);
    const x = pad + ((t - t0) / span) * innerW;
    const y = pad + (1 - (p.value - min) / vspan) * innerH;
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });
  const linePath = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const areaPath =
    xy.length > 0
      ? `${linePath} L ${xy[xy.length - 1][0]} ${height} L ${xy[0][0]} ${height} Z`
      : '';
  return { xy, linePath, areaPath, min, max };
}

/** 가로 좌표(0~1 비율) → 가장 가까운 포인트 인덱스 (호버/터치 크로스헤어용). */
export function nearestIndex(geometry: LineGeometry, fracX: number, width: number): number {
  if (geometry.xy.length === 0) return 0;
  const x = Math.min(1, Math.max(0, fracX)) * width;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < geometry.xy.length; i++) {
    const d = Math.abs(geometry.xy[i][0] - x);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** 여러 시계열을 같은 시간·값 축에 배치 — 내 자산 vs 시장(100 재기준) 비교 차트. */
export interface MultiLineGeometry {
  lines: Array<{ key: string; xy: Array<[number, number]>; path: string }>;
  min: number;
  max: number;
  t0: number;
  t1: number;
}
export function multiLineGeometry(
  series: Array<{ key: string; points: MarketIndexPoint[] }>,
  width: number,
  height: number,
  pad = 6,
): MultiLineGeometry {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return { lines: [], min: 0, max: 0, t0: 0, t1: 0 };
  const ts = all.map((p) => Date.parse(`${p.date}T00:00:00Z`));
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const span = Math.max(1, t1 - t0);
  const vals = all.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const vspan = Math.max(1e-9, max - min);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const lines = series.map((s) => {
    const xy = s.points.map((p): [number, number] => {
      const t = Date.parse(`${p.date}T00:00:00Z`);
      return [
        Number((pad + ((t - t0) / span) * innerW).toFixed(2)),
        Number((pad + (1 - (p.value - min) / vspan) * innerH).toFixed(2)),
      ];
    });
    return { key: s.key, xy, path: xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') };
  });
  return { lines, min, max, t0, t1 };
}
