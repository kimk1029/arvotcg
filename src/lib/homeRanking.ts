import { createRankingCache, type RankingEntry } from '../../shared/rankingCache';
import type { SnkrdunkRow } from '@/lib/snkrdunkRow';

/** 홈 하단 랭킹 행 — HOT 캐러셀 행(SnkrdunkRow) + 컬렉션 TOP 의 보유자·수량 (CleanHome RankRow 와 동일). */
export type HomeRankRow = SnkrdunkRow & { holders?: number; qty?: number };
const memory = new Map<string, RankingEntry<HomeRankRow>>();
/** 홈 랭킹 캐시(웹) — 메모리 + localStorage, 앱 mobile/src/lib/homeRanking.ts 페어. 정본 shared/rankingCache.ts */
export const homeRanking = createRankingCache<HomeRankRow>(
  key => {
    if (memory.has(key)) return memory.get(key)!;
    try { const entry = JSON.parse(localStorage.getItem(key) ?? 'null'); if (entry && Array.isArray(entry.rows) && typeof entry.at === 'number') { memory.set(key, entry); return entry; } } catch { /* storage unavailable */ }
    return null;
  },
  (key, entry) => { memory.set(key, entry); try { localStorage.setItem(key, JSON.stringify(entry)); } catch { /* storage full */ } },
  async (game, kind) => {
    const response = await fetch(`/api/snkrdunk/ranking?game=${game}&kind=${kind}&limit=10`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('랭킹을 불러오지 못했어요');
    const result = await response.json();
    if (!Array.isArray(result.data)) throw new Error('랭킹을 불러오지 못했어요');
    return result.data;
  },
);
