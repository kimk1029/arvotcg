import { Image } from 'react-native';
import { createRankingCache, type RankingEntry, type RankingRow } from '../../../shared/rankingCache';
import { swrPeek, swrSet } from './swr';
import { api } from './apiClient';
import { absApiUrl } from './myApi';
/** 홈 랭킹 캐시(앱) — swr 메모리+디스크, 웹 src/lib/homeRanking.ts 페어. 정본 shared/rankingCache.ts */
export const homeRanking = createRankingCache(
  key => swrPeek<RankingEntry>(key),
  (key, entry) => swrSet(key, entry, { persist: true }),
  async (game, kind) => {
    const result = await api<{ data?: RankingRow[] }>(`/api/snkrdunk/ranking?game=${game}&kind=${kind}&limit=10`, { auth: false });
    if (!Array.isArray(result.data)) throw new Error('랭킹을 불러오지 못했어요');
    // 서버 이미지는 상대경로(/api/cdn/…) — RN Image 는 절대 URL 이 필요하다. 캐시에도 절대 URL 로 저장하고
    // 미리 받아 두어(prefetch) 다음 진입·탭 전환 때 즉시 그려진다.
    const rows = result.data.map((r) => ({ ...r, imageUrl: absApiUrl(r.imageUrl) }));
    for (const r of rows) if (r.imageUrl) void Image.prefetch(r.imageUrl).catch(() => undefined);
    return rows;
  },
);
