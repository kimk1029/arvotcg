import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { DailyCache, DAY_MS, WorkQueue } from './dailyCache';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { translateKnownCardNameToKo } from '../../shared/cardTranslate';
import type { RankingRow } from '../../shared/rankingCache';

const cache = new DailyCache<{ data: RankingRow[]; cachedAt: string }>(DAY_MS, 8,
  join(process.env.PRICE_CACHE_DIR || fileURLToPath(new URL('../data/runtime/', import.meta.url)), 'rankings-v3.json'));
const queue = new WorkQueue(1, 8);
export const RANKING_GAMES = ['pokemon', 'onepiece', 'yugioh', 'other'];

export async function getHomeRanking(game: string, kind: 'snkr' | 'collection') {
  if (!RANKING_GAMES.includes(game)) throw new Error('Unsupported game');
  return cache.get(`${kind}:${game}`, () => queue.run(async () => {
    const rows = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '3000ms'`;
      // Collection ranking never touches prices or price history.
      if (kind === 'collection') return tx.$queryRaw<any[]>`
        SELECT c."apparelId", c."shortName", c.name, c."koName", c."localizedName",
          c."imageUrl", c."cdnImageUrl", COUNT(DISTINCT u."userId")::int AS holders,
          SUM(GREATEST(u.qty, 1))::int AS qty
        FROM user_cards u JOIN snkrdunk_cards c ON c."apparelId" = u."snkrdunkApparelId"
        WHERE c.game = ${game}
        GROUP BY c."apparelId"
        ORDER BY qty DESC, holders DESC, c."apparelId" ASC LIMIT 30`;
      return tx.$queryRaw<any[]>`
        SELECT c."apparelId", c."shortName", c.name, c."koName", c."localizedName", c."imageUrl", c."cdnImageUrl",
          s."minPrice", s."representativePrice", s."headlinePrice", s."headlineBasis", s."pricePsa10", s."priceSingle"
        FROM snkrdunk_current_prices s JOIN snkrdunk_cards c ON c."apparelId" = s."apparelId"
        WHERE c.game = ${game} AND c."itemKind" = 'single' AND s."representativePrice" > 0
          AND s."fetchedAt" >= NOW() - INTERVAL '21 days'
        ORDER BY s."representativePrice" DESC, s."apparelId" ASC LIMIT 30`;
    }, { timeout: 5000, maxWait: 2000 });
    return {
      cachedAt: new Date().toISOString(),
      data: rows.map(r => {
        const ja = r.shortName || r.name;
        const ko = (translateKnownCardNameToKo(ja) || r.koName || ja).split(/[|｜]/)[0].trim();
        return { apparelId: Number(r.apparelId), shortName: ko.length > 22 ? ko.slice(0,21) + '…' : ko,
          localizedName: ja, imageUrl: r.cdnImageUrl || r.imageUrl || null,
          minPrice: Number(r.minPrice ?? 0), recentPrice: Number(r.representativePrice ?? 0),
          basis: kind === 'collection' ? undefined : r.headlinePrice > 0 ? (r.headlineBasis || 'RAW') : r.pricePsa10 > 0 ? 'PSA 10' : 'RAW',
          ...(kind === 'collection' ? { holders: Number(r.holders), qty: Number(r.qty) } : {}) };
      }),
    };
  }));
}
