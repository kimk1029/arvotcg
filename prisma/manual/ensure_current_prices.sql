-- Small serving table: one current price per card. History is only used for charts/backfill.
CREATE TABLE IF NOT EXISTS "snkrdunk_current_prices" (
  "apparelId" INTEGER PRIMARY KEY,
  "minPrice" INTEGER NOT NULL DEFAULT 0,
  "listingCount" INTEGER NOT NULL DEFAULT 0,
  "priceSingle" INTEGER NOT NULL DEFAULT 0,
  "pricePsa10" INTEGER NOT NULL DEFAULT 0,
  "pricePsa9" INTEGER NOT NULL DEFAULT 0,
  "pricePsa8" INTEGER NOT NULL DEFAULT 0,
  "headlinePrice" INTEGER NOT NULL DEFAULT 0,
  "headlineBasis" TEXT,
  "trend" JSONB,
  "representativePrice" INTEGER NOT NULL DEFAULT 0,
  "isFull" BOOLEAN NOT NULL DEFAULT false,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "snkrdunk_current_prices_representativePrice_apparelId_idx"
 ON "snkrdunk_current_prices" ("representativePrice" DESC, "apparelId");
-- API roles cannot read/write this internal cache through PostgREST.
ALTER TABLE "snkrdunk_current_prices" ENABLE ROW LEVEL SECURITY;
