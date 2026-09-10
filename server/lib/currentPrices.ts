import { prisma } from './prisma.js';
import { Prisma } from '@prisma/client';
import { DailyCache, DAY_MS, priceWork, WorkQueue } from './dailyCache';

export interface CurrentPrice {
  apparelId: number;
  minPrice: number;
  listingCount: number;
  priceSingle: number;
  pricePsa10: number;
  pricePsa9: number;
  pricePsa8: number;
  headlinePrice: number;
  headlineBasis: string | null;
  trend: number[] | null;
  representativePrice: number;
  isFull: boolean;
  fetchedAt: Date;
}
export type PriceInput = Partial<Omit<CurrentPrice, 'apparelId' | 'fetchedAt' | 'representativePrice' | 'isFull'>> & { minPrice: number };
const writes = new DailyCache<number>(DAY_MS, 25000, undefined, fetchedAt => fetchedAt);
const money = (n?: number) => Number.isFinite(n) ? Math.max(0, Math.round(n!)) : 0;

/** Atomic cross-process 24h write throttle; partial-to-full upgrades are allowed sooner. */
export async function saveCurrentPrice(apparelId: number, p: PriceInput): Promise<number> {
  const full = p.priceSingle !== undefined || p.pricePsa10 !== undefined;
  return writes.get(`${apparelId}:${full ? 'full' : 'partial'}`, () => priceWork.run(async () => {
    const min = money(p.minPrice), single = money(p.priceSingle), psa10 = money(p.pricePsa10);
    const psa9 = money(p.pricePsa9), psa8 = money(p.pricePsa8), headline = money(p.headlinePrice);
    const changed = await prisma.$queryRaw<Array<{ fetchedAt: Date }>>`
      WITH changed AS (
        INSERT INTO "snkrdunk_current_prices" AS current
          ("apparelId", "minPrice", "listingCount", "priceSingle", "pricePsa10", "pricePsa9", "pricePsa8",
           "headlinePrice", "headlineBasis", trend, "representativePrice", "isFull", "fetchedAt")
        VALUES (${apparelId}, ${min}, ${money(p.listingCount)}, ${single}, ${psa10}, ${psa9}, ${psa8},
          ${headline}, ${p.headlineBasis ?? null}, ${JSON.stringify(p.trend ?? null)}::jsonb,
          ${headline || psa10 || single || min}, ${full}, NOW())
        ON CONFLICT ("apparelId") DO UPDATE SET
          "minPrice"=EXCLUDED."minPrice", "listingCount"=EXCLUDED."listingCount",
          "priceSingle"=EXCLUDED."priceSingle", "pricePsa10"=EXCLUDED."pricePsa10",
          "pricePsa9"=EXCLUDED."pricePsa9", "pricePsa8"=EXCLUDED."pricePsa8",
          "headlinePrice"=EXCLUDED."headlinePrice", "headlineBasis"=EXCLUDED."headlineBasis",
          trend=EXCLUDED.trend, "representativePrice"=EXCLUDED."representativePrice",
          "isFull"=EXCLUDED."isFull", "fetchedAt"=EXCLUDED."fetchedAt"
        WHERE (NOT current."isFull" OR EXCLUDED."isFull") AND
          (current."fetchedAt" < NOW() - INTERVAL '24 hours' OR (NOT current."isFull" AND EXCLUDED."isFull"))
        RETURNING *
      )
      INSERT INTO "snkrdunk_price_snapshots"
        ("apparelId", "minPrice", "listingCount", "priceSingle", "pricePsa10", "pricePsa9", "pricePsa8",
         "headlinePrice", "headlineBasis", trend, "fetchedAt")
      SELECT "apparelId", "minPrice", "listingCount", "priceSingle", "pricePsa10", "pricePsa9", "pricePsa8",
         "headlinePrice", "headlineBasis", trend, "fetchedAt" FROM changed
      RETURNING "fetchedAt"
    `;
    if (changed.length > 0) {
      for (const notify of listeners) notify(apparelId);
      return changed[0].fetchedAt.getTime();
    }
    // A skipped write must not start a new 24h clock from the attempted write.
    const [existing] = await prisma.$queryRaw<Array<{ fetchedAt: Date }>>`
      SELECT "fetchedAt" FROM snkrdunk_current_prices WHERE "apparelId" = ${apparelId}`;
    if (!existing) throw new Error('Current price missing after write');
    return existing.fetchedAt.getTime();
  }), { waitForFresh: true });
}

const listeners = new Set<(id: number) => void>();
export function onCurrentPriceChanged(fn: (id: number) => void) { listeners.add(fn); }
const currentCache = new DailyCache<CurrentPrice[]>(60_000, 256);
const reads = new WorkQueue(1, 100);
onCurrentPriceChanged(id => currentCache.invalidate(key => key.split(',').includes(String(id))));
export async function readCurrentPrices(ids: number[], options: { fresh?: boolean } = {}): Promise<CurrentPrice[]> {
  const unique = [...new Set(ids)].sort((a,b) => a-b);
  const all: CurrentPrice[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i+100);
    const rows = await currentCache.get(batch.join(','), () => reads.run(() => prisma.$queryRaw<CurrentPrice[]>`
      SELECT * FROM "snkrdunk_current_prices" WHERE "apparelId" IN (${Prisma.join(batch)})
    `), { waitForFresh: true, forceRefresh: options.fresh });
    all.push(...rows);
  }
  return all;
}
