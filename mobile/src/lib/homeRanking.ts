import { createRankingCache, type RankingEntry, type RankingRow } from '../../../shared/rankingCache';
import { swrPeek, swrSet } from './swr';
import { api } from './apiClient';
/** 홈 랭킹 캐시(앱) — swr 메모리+디스크, 웹 src/lib/homeRanking.ts 페어. 정본 shared/rankingCache.ts */
export const homeRanking = createRankingCache(
  key => swrPeek<RankingEntry>(key),
  (key, entry) => swrSet(key, entry, { persist: true }),
  async (game, kind) => {
    const result = await api<{ data?: RankingRow[] }>(`/api/snkrdunk/ranking?game=${game}&kind=${kind}&limit=10`, { auth: false });
    if (!Array.isArray(result.data)) throw new Error('랭킹을 불러오지 못했어요');
    return result.data;
  },
);
