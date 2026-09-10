/**
 * 로그인 없이 열어두는 API — 그 외에는 기본적으로 인증한다.
 *
 * 시세·카탈로그(스니덩크/팩/환율/번역/배너 등)는 회원 데이터가 없는 공개 데이터이고,
 * 이미 배포된 구버전 앱(로그인 게이트 이전 빌드)이 미로그인 상태로 조회한다.
 * 회원 콘텐츠(피드·거래·쪽지·내 정보)와 모든 쓰기 요청은 계속 인증이 필요하다.
 */

/** GET/HEAD 무인증 허용 경로. 정확히 일치하거나 그 하위 경로만 매칭한다. */
const PUBLIC_READ_PREFIXES = [
  '/api/snkrdunk',      // 시세 상세·검색·랭킹·차트 (앱 홈/시세 화면 전체)
  '/api/card-packs',
  '/api/cards',         // 카탈로그 조회 (scan 등 쓰기는 라우트에서 requireAuth)
  '/api/kream', '/api/korea-price', '/api/market-index', '/api/fx',
  '/api/psa/pop', '/api/card-lang', '/api/banners', '/api/notices', '/api/places', '/api/shops',
  '/api/search-log/top',
  '/api/app-release', '/api/navercafe/img', '/api/cdn',
  '/api/flex',          // 수익 인증 공유 포스터 (서명 토큰이 있어야 열린다)
];

/** 무인증 허용 POST — 익명 통계 기록과 부수효과 없는 번역 변환. */
const PUBLIC_POSTS = [
  '/api/metrics/action', '/api/metrics/pageview', '/api/metrics/ad',
  '/api/card-lang/ja-ko', '/api/search-log',
];

const underPrefix = (path: string, prefix: string) =>
  path === prefix || path === `${prefix}/` || path.startsWith(`${prefix}/`);

export function isPublicApi(path: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD') {
    return PUBLIC_READ_PREFIXES.some((p) => underPrefix(path, p));
  }
  return method === 'POST' && PUBLIC_POSTS.includes(path.replace(/\/$/, ''));
}

/** 별도 관리자/서버 비밀키를 해당 라우트에서 검사한다. 공개 API가 아니다. */
export function hasIndependentApiAuth(path: string, method: string): boolean {
  return path === '/api/admin' || path.startsWith('/api/admin/')
    || ((path === '/api/app-release' || path === '/api/app-release/') && method === 'PUT')
    || (path === '/api/psa-relay' && method === 'GET');
}
