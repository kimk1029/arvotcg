import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/adminSession';

/**
 * 어드민 접근 제어 — 세션 쿠키(HMAC 서명) 검증.
 * 브라우저 Basic Auth 팝업 대신 /login 페이지로 유도한다.
 */
// /api/oauth = 소셜 로그인 세션 교환 (토큰 검증·권한 확인은 라우트 자체에서 수행)
const PUBLIC_PATHS = new Set(['/login', '/api/login', '/api/oauth']);

export async function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) {
    return new NextResponse(
      'Admin not configured — set ADMIN_USERNAME and ADMIN_PASSWORD env vars.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) {
    // 이미 로그인된 상태로 /login 접근 → 대시보드로
    if (pathname === '/login' && (await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // API 는 401 JSON, 페이지는 로그인으로
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
