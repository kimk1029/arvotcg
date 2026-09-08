-- page_views.source: 'web' | 'mobile' | 'webview' — 접속 출처 (어드민 대시보드 웹/앱 분리)
ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'web';

-- 기존 행 백필: 앱 인앱 WebView(UA 토큰 ARVOTCG-App) 는 webview 로.
UPDATE "page_views" SET "source" = 'webview' WHERE "ua" LIKE '%ARVOTCG-App%' AND "source" = 'web';
UPDATE "action_logs" SET "source" = 'webview' WHERE "ua" LIKE '%ARVOTCG-App%' AND "source" = 'web';
