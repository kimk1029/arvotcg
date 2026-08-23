import { readFileSync } from 'node:fs';

/** @type {import('next').NextConfig} */
// Express API/OCR server origin.
//
// 오리진 표의 정본은 /shared/apiEndpoints.ts 다. 다만 Next 14 는 next.config.ts 를
// 지원하지 않아 ESM 인 이 파일에서 TS 를 import 할 수 없다. 리터럴을 두 벌 두면
// 조용히 어긋나므로 빌드 시점에 정본에서 값을 뽑아 쓰고, 패턴이 안 잡히면 즉시
// 빌드를 실패시킨다(드리프트를 숨기지 않는다).
function readSharedOrigins() {
  const src = readFileSync(new URL('./shared/apiEndpoints.ts', import.meta.url), 'utf8');
  const decls = {};
  const re = /export const ([A-Z_]+)(?:\s*:\s*[^=]+)?\s*=\s*(?:'([^']+)'|([A-Z_]+))\s*;/g;
  for (let m; (m = re.exec(src)); ) decls[m[1]] = { literal: m[2], alias: m[3] };
  const resolve = (name, depth = 0) => {
    const d = decls[name];
    if (!d || depth > 4) {
      throw new Error(`[next.config] shared/apiEndpoints.ts 에서 ${name} 을(를) 해석하지 못했습니다.`);
    }
    return d.literal ?? resolve(d.alias, depth + 1);
  };
  return {
    stage: resolve('STAGE_API_ORIGIN'),
    productionFallback: resolve('PRODUCTION_API_ORIGIN_FALLBACK'),
  };
}

const SHARED_ORIGINS = readSharedOrigins();

// 우선순위는 앱(mobile/src/lib/apiEnv.ts)과 동일하게 맞춘다 — 웹↔앱 패리티.
//   1. NEXT_PUBLIC_API_ORIGIN  — 로컬 dev·수동 지정 (예: http://localhost:3030)
//   2. NEXT_PUBLIC_APP_ENV=stage → NAS
//   3. API_ORIGIN_PROD (Vultr) → 없으면 NAS 폴백
const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  (process.env.NEXT_PUBLIC_APP_ENV === 'stage'
    ? SHARED_ORIGINS.stage
    : process.env.API_ORIGIN_PROD || SHARED_ORIGINS.productionFallback)
).replace(/\/+$/, '');

// 상단 StatusBar 버전 표시용 — package.json version 을 빌드 시점에 인라인.
// 버전은 githooks/pre-commit 이 커밋마다 patch 자동 +1 한다.
const { version: APP_VERSION } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  async redirects() {
    return [
      // /card 단수형 → /cards 복수형. 하위 경로(/card/grading, /card/search ...)도 동일.
      { source: '/card', destination: '/cards', permanent: true },
      { source: '/card/:path*', destination: '/cards/:path*', permanent: true },
    ];
  },
  async rewrites() {
    // All /api/* (except /api/auth/* which is still served locally by NextAuth
    // — local files win over `afterFiles` rewrites) and /auth/* (new Express
    // auth) proxy to the Express server. Same-origin proxy keeps cookies on
    // the Next.js host during dev so session cookies set by Express are
    // stored on localhost:3000.
    return [
      { source: '/auth/:path*', destination: `${API_ORIGIN}/auth/:path*` },
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
    ];
  },
};

export default nextConfig;
