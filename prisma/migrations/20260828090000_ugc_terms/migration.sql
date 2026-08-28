-- 커뮤니티 이용규칙(UGC EULA) 동의 — App Store 1.2 요건 (shared/ugcTerms.ts, /api/me/ugc-terms).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ugcTermsAgreedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ugcTermsVersion" INTEGER NOT NULL DEFAULT 0;
