-- 커뮤니티 피드 글 카테고리 (자유/시세·정보/자랑). NULL = 레거시 글(사진 유무로 추정 표시).
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "category" TEXT;
