-- Idempotent schema sync for snkrdunkApparelId + favorite_cards.
--
-- Why this exists: prisma migrate deploy is non-fatal in CI (admin
-- db push owns the live schema), so the 20260522170000 migration never
-- actually ran on prod. This file is executed by `prisma db execute`
-- on every deploy as a safety net — IF NOT EXISTS makes it safe to
-- re-run forever.

-- 1) UserCard.snkrdunkApparelId — needed for collection + portfolio.
ALTER TABLE "user_cards" ADD COLUMN IF NOT EXISTS "snkrdunkApparelId" INTEGER;
CREATE INDEX IF NOT EXISTS "user_cards_snkrdunkApparelId_idx"
  ON "user_cards" ("snkrdunkApparelId");

-- 1b) UserCard.registerPriceJpy — 컬렉션 리스트 "등록가 → 현재가 등락률" 기준값.
ALTER TABLE "user_cards" ADD COLUMN IF NOT EXISTS "registerPriceJpy" INTEGER;

-- 2) FavoriteCard table — wishlist, separate from collection.
CREATE TABLE IF NOT EXISTS "favorite_cards" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "snkrdunkApparelId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FK can't be IF NOT EXISTS — guard via pg_constraint lookup.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'favorite_cards_userId_fkey'
  ) THEN
    ALTER TABLE "favorite_cards"
      ADD CONSTRAINT "favorite_cards_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "favorite_cards_userId_snkrdunkApparelId_key"
  ON "favorite_cards" ("userId", "snkrdunkApparelId");

CREATE INDEX IF NOT EXISTS "favorite_cards_userId_createdAt_idx"
  ON "favorite_cards" ("userId", "createdAt" DESC);

-- 3) PortfolioDailySnapshot — 등락율/차트용 일별 스냅샷.
CREATE TABLE IF NOT EXISTS "portfolio_daily_snapshots" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "totalJpy" INTEGER NOT NULL,
  "pricedCount" INTEGER NOT NULL,
  "totalCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_daily_snapshots_userId_fkey'
  ) THEN
    ALTER TABLE "portfolio_daily_snapshots"
      ADD CONSTRAINT "portfolio_daily_snapshots_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_daily_snapshots_userId_date_key"
  ON "portfolio_daily_snapshots" ("userId", "date");

CREATE INDEX IF NOT EXISTS "portfolio_daily_snapshots_userId_date_idx"
  ON "portfolio_daily_snapshots" ("userId", "date" DESC);

-- 4) SnkrdunkCard — 정적 마스터 카드 카탈로그 (시세 없음, 시세는 5번 스냅샷에만).
CREATE TABLE IF NOT EXISTS "snkrdunk_cards" (
  "apparelId"      INTEGER PRIMARY KEY,
  "name"           TEXT NOT NULL DEFAULT '',
  "localizedName"  TEXT NOT NULL DEFAULT '',
  "koName"         TEXT NOT NULL DEFAULT '',
  "itemKind"       TEXT NOT NULL DEFAULT 'single',
  "shortName"      TEXT NOT NULL DEFAULT '',
  "imageUrl"       TEXT,
  "productNumber"  TEXT NOT NULL DEFAULT '',
  "releasedAt"     TEXT,
  "packCode"       TEXT,
  "apparelGroupId" INTEGER,
  "firstSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "snkrdunk_cards_packCode_idx"
  ON "snkrdunk_cards" ("packCode");

-- 5) SnkrdunkPriceSnapshot — 시세 갱신마다 한 줄 누적. 현재가 = apparelId 별 최신 행.
CREATE TABLE IF NOT EXISTS "snkrdunk_price_snapshots" (
  "id"           SERIAL PRIMARY KEY,
  "apparelId"    INTEGER NOT NULL,
  "minPrice"     INTEGER NOT NULL,
  "listingCount" INTEGER NOT NULL DEFAULT 0,
  "fetchedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "snkrdunk_price_snapshots_apparelId_fetchedAt_idx"
  ON "snkrdunk_price_snapshots" ("apparelId", "fetchedAt" DESC);

-- 6) PsaSpec — PSA 인구 리포트 매핑+캐시 (setCode+번호 ↔ SpecID, 등급별 pop).
CREATE TABLE IF NOT EXISTS "psa_specs" (
  "id"           SERIAL PRIMARY KEY,
  "cardKey"      TEXT NOT NULL,
  "setCode"      TEXT NOT NULL,
  "cardNumber"   TEXT NOT NULL,
  "specId"       INTEGER NOT NULL,
  "certNumber"   TEXT NOT NULL DEFAULT '',
  "subject"      TEXT NOT NULL DEFAULT '',
  "variety"      TEXT NOT NULL DEFAULT '',
  "brand"        TEXT NOT NULL DEFAULT '',
  "year"         TEXT NOT NULL DEFAULT '',
  "grades"       JSONB,
  "popTotal"     INTEGER NOT NULL DEFAULT 0,
  "popRaw"       JSONB,
  "popFetchedAt" TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "psa_specs_cardKey_key" ON "psa_specs" ("cardKey");

-- 7) ActionLog — 회원/비회원 모든 행동(클릭·페이지이동) 원시 로그 (중복제거 없음).
CREATE TABLE IF NOT EXISTS "action_logs" (
  "id"        SERIAL PRIMARY KEY,
  "type"      TEXT NOT NULL,
  "path"      TEXT NOT NULL DEFAULT '',
  "target"    TEXT NOT NULL DEFAULT '',
  "source"    TEXT NOT NULL DEFAULT 'web',
  "userId"    TEXT,
  "anonId"    TEXT,
  "ip"        TEXT,
  "ua"        TEXT,
  "referer"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "action_logs_createdAt_idx" ON "action_logs" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "action_logs_type_createdAt_idx" ON "action_logs" ("type", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "action_logs_path_createdAt_idx" ON "action_logs" ("path", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "action_logs_userId_idx" ON "action_logs" ("userId");
CREATE INDEX IF NOT EXISTS "action_logs_anonId_idx" ON "action_logs" ("anonId");

-- 8) 커뮤니티 피드 카테고리 (2026-08-06) — migrate deploy 드리프트 대비 안전망.
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "category" TEXT;
