/**
 * 웹 로그인 필수 게이트 — 서버(엣지) 단계.
 *
 * 클라이언트 EntryGate(src/components/EntryGate.tsx)만으로는 세션 판정 전 SSR 본문이 그대로
 * 노출되고(JS 꺼짐·크롤러·판정 지연) 로그인 없이 화면을 볼 수 있었다(2026-09-09 확인).
 * 여기서 세션 쿠키가 없는 요청을 비면제 경로에서 /login 으로 먼저 돌려보낸다.
 * 판정 규칙(면제 경로·임베드)은 shared/onboarding.ts·shared/embed.ts 정본을 그대로 쓴다.
 *
 *  · 쿠키 존재만 본다(서명 검증은 /auth/me 가 담당) — 만료·위조 토큰은 클라이언트 EntryGate 가 마무리.
 *  · 앱 인앱 WebView(UA 토큰 ARVOTCG-App 또는 ?embed=1)는 앱이 이미 게이트를 통과한 뒤이므로 면제.
 *  · /api·/auth(Express 프록시)·정적 파일·SEO 메타 파일은 matcher 에서 제외.
 * 앱 페어: mobile/src/components/EntryGate.tsx (앱은 네이티브 게이트만으로 충분).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isEntryGateExempt } from '../shared/onboarding';
import { hasEmbedQuery, isEmbedUserAgent } from '../shared/embed';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'pf30_session';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isEntryGateExempt(pathname)) return NextResponse.next();
  if (hasEmbedQuery(search) || isEmbedUserAgent(req.headers.get('user-agent'))) return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const login = req.nextUrl.clone();
  login.pathname = '/login';
  login.search = '';
  login.searchParams.set('callbackUrl', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // 페이지 요청만 — API/인증 프록시, Next 내부 자산, 파비콘·매니페스트·robots·sitemap, 확장자 있는 정적 파일 제외.
  matcher: [
    '/((?!api|auth|_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
