/**
 * 홈 HOT 카드 목록 공유 스토어 (메모리).
 * 홈 캐러셀에 노출된 목록을 그대로 저장해, '더보기'(/cards/snkrdunk) 목록이
 * 같은 항목·같은 순서로 즉시 뜨게 한다 (재조회 없음 → 진입 속도 개선).
 * 웹 src/lib/homeHotCache.ts 와 페어.
 */

export interface HomeHotRow {
  apparelId: number;
  shortName: string;
  localizedName?: string;
  imageUrl: string | null;
  minPrice: number;
  recentPrice?: number;
  changePct?: number;
  listingCountText?: string;
}

interface HomeHotStore {
  game: string;
  rows: HomeHotRow[];
  savedAt: number;
}

const TTL_MS = 10 * 60_000; // 홈 데이터 자체가 10분 캐시 기준

let stored: HomeHotStore | null = null;

export function setHomeHotRows(game: string, rows: HomeHotRow[]): void {
  if (rows.length === 0) return;
  stored = { game, rows, savedAt: Date.now() };
}

export function getHomeHotRows(): HomeHotStore | null {
  if (!stored || stored.rows.length === 0) return null;
  if (Date.now() - stored.savedAt > TTL_MS) return null;
  return stored;
}
