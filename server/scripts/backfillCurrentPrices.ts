/** One-time, resumable bounded backfill. Never called from an HTTP request. */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

let cursor = 0, copied = 0;
try {
  for (;;) {
    const cards = await prisma.snkrdunkCard.findMany({ where: { apparelId: { gt: cursor } },
      orderBy: { apparelId: 'asc' }, take: 50, select: { apparelId: true } });
    if (!cards.length) break;
    const ids = cards.map(c => c.apparelId);
    const n = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '3000ms'`;
      return tx.$executeRaw`
        INSERT INTO snkrdunk_current_prices
          ("apparelId", "minPrice", "listingCount", "priceSingle", "pricePsa10", "pricePsa9", "pricePsa8",
           "headlinePrice", "headlineBasis", trend, "representativePrice", "isFull", "fetchedAt")
        SELECT s."apparelId", s."minPrice", s."listingCount", s."priceSingle", s."pricePsa10", s."pricePsa9", s."pricePsa8",
          s."headlinePrice", s."headlineBasis", s.trend,
          COALESCE(NULLIF(s."headlinePrice",0), NULLIF(s."pricePsa10",0), NULLIF(s."priceSingle",0), s."minPrice"),
          (s."priceSingle" > 0 OR s."pricePsa10" > 0), s."fetchedAt"
        FROM unnest(ARRAY[${Prisma.join(ids)}]::int[]) requested(id)
        CROSS JOIN LATERAL (
          SELECT p.* FROM snkrdunk_price_snapshots p WHERE p."apparelId" = requested.id
          ORDER BY p."fetchedAt" DESC LIMIT 1
        ) s
        WHERE NOT EXISTS (SELECT 1 FROM snkrdunk_current_prices c WHERE c."apparelId" = requested.id)
        ON CONFLICT ("apparelId") DO NOTHING`;
    }, { timeout: 5000, maxWait: 2000 });
    copied += n; cursor = ids[ids.length-1];
    if (copied % 500 < 50) console.log({ cursor, copied });
    await new Promise(r => setTimeout(r, 200));
  }
  console.log({ complete: true, copied });
} finally { await prisma.$disconnect(); }
