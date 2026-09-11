-- card_shops: 대표 이미지 URL
ALTER TABLE "card_shops" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT NOT NULL DEFAULT '';
