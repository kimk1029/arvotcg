-- 시장 지표(TCG 인덱스) — 포트폴리오 '시장 지표' 섹션 (server/lib/marketIndex.ts).
CREATE TABLE IF NOT EXISTS "market_index_points" (
  "id"         SERIAL PRIMARY KEY,
  "key"        TEXT NOT NULL,
  "date"       TEXT NOT NULL,
  "value"      DOUBLE PRECISION NOT NULL,
  "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "count"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "market_index_points_key_date_key" ON "market_index_points"("key", "date");
CREATE INDEX IF NOT EXISTS "market_index_points_key_date_idx" ON "market_index_points"("key", "date" DESC);

CREATE TABLE IF NOT EXISTS "market_index_states" (
  "key"       TEXT PRIMARY KEY,
  "json"      JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
