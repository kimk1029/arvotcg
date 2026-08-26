/**
 * 소셜 로그인 (OAuth) 공통 헬퍼.
 *
 * 서버 흐름: `${WEB_OAUTH_ORIGIN}/auth/<provider>?platform=mobile` 을 열면 Express 가
 * 카카오/네이버/구글로 보냈다가, 콜백에서 성공 시 `pokefesta30://auth?token=<jwt>` 로
 * 302 리다이렉트한다.
 *
 * 토큰 회수 전략: 외부 브라우저/Custom Tabs/딥링크는 커스텀 스킴 복귀가
 * 불안정하고(특히 dev client 는 raw 딥링크를 JS 로 전달하지 않음 → +not-found 404),
 * Chrome 없는 기기에선 Custom Tabs 자체가 없다. 그래서 앱 내부 WebView(app/oauth.tsx)
 * 에서 OAuth 를 진행하고, `pokefesta30://auth?token=` 리다이렉트를 WebView 네비게이션
 * 단계에서 직접 가로채 토큰을 회수한다. → Chrome 없이도, 딥링크 없이도 동작한다.
 */
import { router } from 'expo-router';
import { setSession } from './session';
import { getApiBaseUrl } from './apiClient';

export type AuthProvider = 'kakao' | 'naver' | 'google';

// OAuth 시작 오리진 — 카카오/네이버/구글 콘솔에 등록된 https Redirect URI 도메인과
// 일치해야 한다. EXPO_PUBLIC_WEB_OAUTH_ORIGIN 으로 override 가능.
export const WEB_OAUTH_ORIGIN =
  process.env.EXPO_PUBLIC_WEB_OAUTH_ORIGIN ?? 'https://www.arvotcg.com';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 주어진 provider 의 OAuth 시작 URL. */
export function buildAuthUrl(provider: AuthProvider): string {
  return `${WEB_OAUTH_ORIGIN}/auth/${provider}?platform=mobile`;
}

/**
 * `pokefesta30://auth?token=<jwt>` 형태의 URL 에서 토큰을 추출.
 * React Native(Hermes) 의 URLSearchParams 가 불완전해 수동 파싱한다.
 */
export function extractOAuthToken(url: string | null): string | null {
  if (!url) return null;
  const i = url.indexOf('token=');
  if (i === -1) return null;
  try {
    const raw = url.slice(i + 'token='.length).split('&')[0].split('#')[0];
    const t = decodeURIComponent(raw);
    return t && t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

/** 내부 라우트 경로만 허용 (웹 signIn 의 safe 규칙과 동일 — open redirect 방지). */
function safeCallbackPath(p?: string | null): string {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : '/';
}

/** 추출한 토큰으로 세션을 저장하고 callback(없으면 홈)으로 이동. */
export function persistTokenAndGoHome(token: string, callback?: string | null): void {
  setSession({
    token,
    expiresAt: Date.now() + SESSION_TTL_MS,
    baseUrl: getApiBaseUrl(),
  });
  const target = safeCallbackPath(callback);
  setTimeout(() => router.replace(target as never), 60);
}

/** 소셜 로그인 시작 — 앱 내부 WebView(app/oauth.tsx) 로 이동. 로그인 후 callback 경로로 복귀. */
export function startSocialLogin(provider: AuthProvider, callback?: string | null): void {
  const cb = callback ? `&callback=${encodeURIComponent(callback)}` : '';
  router.push(`/oauth?provider=${provider}${cb}` as never);
}
