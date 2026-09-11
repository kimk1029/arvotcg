-- card_shops: 인스타그램 핸들/URL
ALTER TABLE "card_shops" ADD COLUMN IF NOT EXISTS "instagram" TEXT NOT NULL DEFAULT '';
