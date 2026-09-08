import { NextResponse, type NextRequest } from 'next/server';
import { isEntryGateExempt } from '../shared/onboarding';
import { resolveApiOrigin } from '../shared/apiEndpoints';
import { isPublicApi, hasIndependentApiAuth } from '../shared/accessPolicy';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'pf30_session';
const PUBLIC_ASSETS = new Set([
  '/app-ads.txt', // AdMob 소유권 확인용 공개 파일. 보호 화면의 로그인 정책과 무관하다.
  '/favicon.ico', '/icon.svg', '/apple-icon.png', '/manifest.webmanifest', '/robots.txt', '/sitemap.xml',
  '/snkrdunk-icon.png', '/app-icon.png', '/meta.png', '/promo/cardshow.png',
  '/grading/ars.webp', '/grading/sgc.webp', '/grading/bgs.webp', '/grading/cgc.webp', '/grading/psa.webp',
]);

/** 쿠키 존재나 앱 표시값을 신뢰하지 않고 서버에서 서명·만료·회원 존재를 확인한다. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const api = pathname === '/api' || pathname.startsWith('/api/');
  if (PUBLIC_ASSETS.has(pathname) || (!api && isEntryGateExempt(pathname))
    || isPublicApi(pathname, req.method) || hasIndependentApiAuth(pathname, req.method)) {
    return NextResponse.next();
  }

  // 구버전 앱 WebView의 쿼리 토큰은 검증 후 HttpOnly 쿠키로 교환하고 URL에서 제거한다.
  const authorization = req.headers.get('authorization');
  const bridgeToken = !api && req.method === 'GET' && pathname.startsWith('/event/')
    ? req.nextUrl.searchParams.get('token') || (authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null) : null;
  const token = bridgeToken || (authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : req.cookies.get(SESSION_COOKIE)?.value);
  let authenticated = false;
  if (token) {
    const origin = resolveApiOrigin({
      explicitOverride: process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_ORIGIN,
      appEnv: process.env.NEXT_PUBLIC_APP_ENV,
      productionOrigin: process.env.API_ORIGIN_PROD,
    });
    try {
      const response = await fetch(`${origin}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      const body = response.ok ? await response.json() : null;
      authenticated = typeof body?.user?.id === 'string' && body.user.id.length > 0;
    } catch { /* 인증 서버 장애 시에도 보호 화면은 열지 않는다. */ }
  }

  const cleanUrl = req.nextUrl.clone();
  cleanUrl.searchParams.delete('token');
  if (!authenticated) {
    if (api) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
    const login = new URL('/login', req.url);
    login.searchParams.set('callbackUrl', `${cleanUrl.pathname}${cleanUrl.search}`);
    return NextResponse.redirect(login, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  }
  const exchange = bridgeToken && (req.nextUrl.searchParams.has('token') || req.cookies.get(SESSION_COOKIE)?.value !== bridgeToken);
  const response = exchange ? NextResponse.redirect(cleanUrl) : NextResponse.next();
  if (exchange) response.cookies.set(SESSION_COOKIE, bridgeToken, {
    httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/',
  });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export const config = {
  // 확장자·API·RSC 요청도 검사한다. 정적 자산 이외의 광범위한 경로 예외를 두지 않는다.
  matcher: ['/((?!_next/static/|_next/image).*)'],
};
