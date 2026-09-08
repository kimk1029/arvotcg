/** 로그인 전 필요한 최소 API. 그 외에는 기본적으로 인증한다. */
export function isPublicApi(path: string, method: string): boolean {
  const read = method === 'GET' || method === 'HEAD';
  return (read && (path === '/api/app-release' || path === '/api/app-release/' || path === '/api/navercafe/img' || path.startsWith('/api/cdn/')))
    || (method === 'POST' && ['/api/metrics/action', '/api/metrics/pageview', '/api/metrics/ad'].includes(path));
}

/** 별도 관리자/서버 비밀키를 해당 라우트에서 검사한다. 공개 API가 아니다. */
export function hasIndependentApiAuth(path: string, method: string): boolean {
  return path === '/api/admin' || path.startsWith('/api/admin/')
    || ((path === '/api/app-release' || path === '/api/app-release/') && method === 'PUT')
    || (path === '/api/psa-relay' && method === 'GET');
}
