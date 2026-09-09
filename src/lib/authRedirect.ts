'use client';
/**
 * 인증 필요 API 가 401 을 주면 로그인 화면으로 보낸다 (앱 apiClient 와 같은 규칙).
 *
 * 페이지 진입은 middleware 가 막지만, 열어둔 화면에서 세션이 만료되면 각 컴포넌트가
 * "로그인이 필요해요" 문구만 띄우고 멈춘다 — 그 자리마다 분기를 넣는 대신
 * 모든 호출이 지나가는 fetch 한 곳에서 처리한다.
 *
 * 제외: 로그인·OAuth 등 게이트 면제 경로(무한 이동 방지), 앱 인앱 WebView(앱이 자체
 * 로그인 플로우를 가진다), 우리 API 가 아닌 요청.
 */
import { isEntryGateExempt } from '../../shared/onboarding';
import { isEmbedded } from '@/lib/embed';

let sent = false;

export function redirectToLogin() {
  if (sent || typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (isEntryGateExempt(pathname) || isEmbedded()) return;
  sent = true;
  window.location.replace(`/login?callbackUrl=${encodeURIComponent(pathname + search)}`);
}

function isOwnApi(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

let installed = false;

/** 앱 시작(레이아웃 마운트) 시 한 번만 호출. */
export function installUnauthorizedRedirect() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await original(input, init);
    if (res.status === 401 && isOwnApi(input)) redirectToLogin();
    return res;
  };
}
