/**
 * 포트폴리오 일별 히스토리에서 N일 변화 — 웹 PortfolioScreen ↔ 앱 my/portfolio 공통 정본.
 *
 * 히스토리는 사용자가 접속한 날만 스냅샷이 남아 드문드문하다. 예전엔 배열 인덱스로
 * `h[len-1-7]` 을 "7일 전"으로 썼는데, 빈 날이 있으면 20일 전 값과 비교돼 금액이 틀렸다.
 * 여기선 날짜로 찾는다: 마지막 날짜에서 N일 뺀 날짜 이하의 가장 최근 스냅샷이 기준.
 * 그런 스냅샷이 없으면(데이터가 N일치 미만) null.
 */
export interface HistoryPoint {
  /** YYYY-MM-DD */
  date: string;
  totalJpy: number;
}

export interface HistoryDelta {
  abs: number;
  pct: number;
  /** 비교 기준이 된 스냅샷 날짜. */
  baseDate: string;
}

function shiftDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function historyDelta(history: ReadonlyArray<HistoryPoint>, days: number): HistoryDelta | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const target = shiftDate(last.date, days);
  let base: HistoryPoint | null = null;
  for (const h of sorted) {
    if (h.date <= target) base = h;
    else break;
  }
  if (!base || !(base.totalJpy > 0)) return null;
  const abs = last.totalJpy - base.totalJpy;
  return { abs, pct: (abs / base.totalJpy) * 100, baseDate: base.date };
}
