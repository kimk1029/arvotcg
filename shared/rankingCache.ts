/**
 * 홈 랭킹 캐시 정본 — 저장소·전송은 플랫폼이 주입(웹 localStorage/fetch, 앱 swr/api).
 * TTL 안이면 캐시 즉시, 진행 중 요청은 공유, 실패해도 기존 캐시를 지우지 않는다.
 */
/** 홈 하단 랭킹(SNKR 최고가·컬렉션 TOP) 행 — /api/snkrdunk/ranking 응답. 웹은 SnkrdunkRow 확장형으로 특수화. */
export type RankingRow = { apparelId: number; shortName: string; localizedName?: string; imageUrl: string | null; minPrice: number; recentPrice?: number; basis?: string; holders?: number; qty?: number };
export type RankingEntry<Row extends RankingRow = RankingRow> = { at: number; rows: Row[] };
export const RANKING_TTL = 5 * 60_000;
// Storage and transport are supplied by each platform. Failed requests never replace a good cache.
export function createRankingCache<Row extends RankingRow = RankingRow>(
  read: (key: string) => RankingEntry<Row> | null,
  write: (key: string, entry: RankingEntry<Row>) => void,
  fetchRows: (game: string, kind: string) => Promise<Row[]>,
) {
  const pending = new Map<string, Promise<Row[]>>();
  const key = (game: string, kind: string) => `home:ranking:v2:${game}:${kind}`;
  return {
    peek: (game: string, kind: string) => read(key(game, kind))?.rows,
    load(game: string, kind: string) {
      const k = key(game, kind), cached = read(k);
      if (cached && Date.now() - cached.at < RANKING_TTL) return Promise.resolve(cached.rows);
      const existing = pending.get(k);
      if (existing) return existing;
      const request = fetchRows(game, kind).then(rows => {
        write(k, { at: Date.now(), rows });
        return rows;
      }).finally(() => pending.delete(k));
      pending.set(k, request);
      return request;
    },
  };
}
