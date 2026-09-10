-- user_cards.bundleId: 사용자가 직접 묶은 묶음 id (컬렉션 묶음 기능)
ALTER TABLE "user_cards" ADD COLUMN IF NOT EXISTS "bundleId" TEXT;
