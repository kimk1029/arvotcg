import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
import { isPublicApi, hasIndependentApiAuth } from '../shared/accessPolicy';

const request = (path: string, headers: Record<string, string> = {}) => new NextRequest(`https://www.arvotcg.com${path}`, { headers });

test('unauthenticated pages, RSC, API and forged embed markers fail closed', async () => {
  for (const [path, headers] of [
    ['/', {}], ['/?embed=1', {}], ['/', { 'user-agent': 'ARVOTCG-App' }],
    ['/cards?embed=1', { RSC: '1' }], ['/cards/fake.json', {}],
  ] as Array<[string, Record<string, string>]>) {
    const res = await middleware(request(path, headers));
    assert.equal(res.status, 307);
    assert.equal(new URL(res.headers.get('location')!).pathname, '/login');
  }
  for (const path of ['/api/me', '/api/navercafe/list', '/api/new-feature']) {
    assert.equal((await middleware(request(path))).status, 401);
  }
});

test('verified sessions pass; invalid sessions and auth outages cannot reveal pages', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, opts) => {
      assert.equal(opts?.cache, 'no-store');
      return Response.json({ user: new Headers(opts?.headers).get('Authorization') === 'Bearer valid' ? { id: 'member' } : null });
    };
    assert.equal((await middleware(request('/', { cookie: 'pf30_session=invalid' }))).status, 307);
    const allowed = await middleware(request('/', { cookie: 'pf30_session=valid' }));
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('cache-control'), 'private, no-store');
    assert.equal((await middleware(request('/api/me', { authorization: 'Bearer valid' }))).status, 200);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await middleware(request('/', { cookie: 'pf30_session=valid' }))).status, 307);
  } finally { globalThis.fetch = original; }
});

test('old and new app tokens exchange for HttpOnly cookies without redirect loops or URL leaks', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, opts) => Response.json({ user: new Headers(opts?.headers).get('Authorization') === 'Bearer valid' ? { id: 'member' } : null });
  try {
    for (const req of [request('/event/cardshow?embed=1&token=valid'), request('/event/cardshow?embed=1', { authorization: 'Bearer valid' })]) {
      const res = await middleware(req);
      const queryToken = req.nextUrl.searchParams.has('token');
      assert.equal(res.status, queryToken ? 307 : 200);
      if (queryToken) assert.equal(new URL(res.headers.get('location')!).searchParams.has('token'), false);
      else {
        assert.equal(res.headers.get('location'), null);
        assert.match(res.headers.get('x-middleware-request-cookie')!, /pf30_session=valid/);
      }
      assert.equal(res.cookies.get('pf30_session')?.httpOnly, true);
      assert.equal(res.cookies.get('pf30_session')?.secure, true);
    }
    assert.equal((await middleware(request('/event/cardshow?embed=1', { authorization: 'Bearer valid', cookie: 'pf30_session=valid' }))).status, 200);
    const invalid = await middleware(request('/event/cardshow?token=invalid&embed=1'));
    assert.equal(invalid.cookies.get('pf30_session'), undefined);
    assert.equal(invalid.headers.get('location')!.includes('token'), false);
    const invalidHeader = await middleware(request('/event/cardshow?embed=1', { authorization: 'Bearer invalid' }));
    assert.equal(new URL(invalidHeader.headers.get('location')!).pathname, '/login');
    assert.equal(invalidHeader.cookies.get('pf30_session'), undefined);
  } finally { globalThis.fetch = original; }
});

test('public exceptions are narrow and method-specific', async () => {
  assert.equal((await middleware(request('/app-ads.txt'))).status, 200);
  assert.equal((await middleware(request('/app-ads.txt/private'))).status, 307);
  assert.equal((await middleware(request('/login'))).status, 200);
  assert.equal((await middleware(request('/privacy'))).status, 200);
  assert.equal(isPublicApi('/api/app-release', 'GET'), true);
  assert.equal(isPublicApi('/api/app-release', 'POST'), false);
  assert.equal(isPublicApi('/api/metrics/action', 'POST'), true);
  assert.equal(isPublicApi('/api/metrics/action/extra', 'POST'), false);
  assert.equal(isPublicApi('/api/metrics', 'GET'), false);
  // 공개 시세·카탈로그 조회는 미로그인 앱도 받아야 한다(구버전 스토어 빌드).
  assert.equal(isPublicApi('/api/snkrdunk/apparels/1/sales-history', 'GET'), true);
  assert.equal(isPublicApi('/api/card-packs', 'GET'), true);
  assert.equal(isPublicApi('/api/snkrdunk/apparels/1', 'POST'), false);
  assert.equal(isPublicApi('/api/snkrdunk-fake', 'GET'), false);
  assert.equal(isPublicApi('/api/feeds', 'GET'), false);
  assert.equal(isPublicApi('/api/me', 'GET'), false);
  assert.equal(hasIndependentApiAuth('/api/admin-fake', 'GET'), false);
});

test('client 401 opens the login page once, never from exempt pages or foreign hosts', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const [originalWindow, originalDocument] = [g.window, g.document];
  const replaced: string[] = [];
  const location = { origin: 'https://www.arvotcg.com', pathname: '/login', search: '', replace: (u: string) => { replaced.push(u); } };
  g.document = { documentElement: { getAttribute: () => null } };
  g.window = {
    location,
    sessionStorage: { getItem: () => null },
    fetch: async (input: string) => new Response(null, { status: String(input).includes('/deny') ? 401 : 200 }),
  };
  try {
    const { installUnauthorizedRedirect } = await import('../src/lib/authRedirect');
    installUnauthorizedRedirect();
    const call = (url: string) => (g.window as { fetch: (u: string) => Promise<Response> }).fetch(url);
    await call('/api/me/deny');                                  // 로그인 화면에서는 이동하지 않는다
    assert.deepEqual(replaced, []);
    location.pathname = '/cards';
    await call('https://evil.example/api/deny');                 // 우리 API 가 아니면 무시
    await call('/auth/me/deny');                                 // /api 외 경로도 무시
    assert.deepEqual(replaced, []);
    await call('/api/me/deny');
    await call('/api/feeds/deny');                               // 401 이 몰려도 이동은 한 번
    assert.deepEqual(replaced, ['/login?callbackUrl=%2Fcards']);
  } finally {
    g.window = originalWindow;
    g.document = originalDocument;
  }
});

test('image proxy refuses non-CDN hosts, redirects and active content', async () => {
  const { GET } = await import('../src/app/api/navercafe/img/route');
  const original = globalThis.fetch;
  let contentType = 'text/html';
  globalThis.fetch = async (_url, opts) => {
    assert.equal(opts?.redirect, 'error');
    return new Response('test image', { headers: { 'Content-Type': contentType } });
  };
  try {
    const requestImage = (url: string) => new Request(`https://www.arvotcg.com/api/navercafe/img?u=${encodeURIComponent(url)}`);
    assert.equal((await GET(requestImage('http://127.0.0.1/'))).status, 403);
    assert.equal((await GET(requestImage('https://pstatic.net.evil.example/'))).status, 403);
    assert.equal((await GET(requestImage('https://cafe.pstatic.net/image'))).status, 502);
    contentType = 'image/svg+xml';
    assert.equal((await GET(requestImage('https://cafe.pstatic.net/image'))).status, 502);
    contentType = 'image/jpeg';
    const res = await GET(requestImage('https://cafe.pstatic.net/image'));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  } finally { globalThis.fetch = original; }
});
