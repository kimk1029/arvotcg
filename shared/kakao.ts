/**
 * 카카오 JavaScript SDK 설정 — 웹(수익인증 카카오톡 공유)·앱 WebView 공통.
 *
 * JavaScript 키는 클라이언트에 노출되는 공개 키다(카카오가 도메인 등록으로 제한한다).
 * 카카오 개발자 콘솔 → 앱 ID 1439301 → 플랫폼 키 → JavaScript 키 → Web 플랫폼에
 * www.arvotcg.com / arvotcg.com 이 등록돼 있어야 동작한다. REST API 키·시크릿과 다르다.
 */
export const KAKAO_JS_KEY = '48f5ba57982ce5ae59551b2f6adbb5ea';
export const KAKAO_JS_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';

/** 카카오톡 공유가 카카오톡 앱을 여는 커스텀 스킴 — 앱 WebView 가 가로채 OS 로 넘긴다. */
export const KAKAO_APP_SCHEMES = ['kakaolink://', 'kakaotalk://', 'kakaoplus://'];

/**
 * 안드로이드 `intent://…#Intent;scheme=kakaolink;package=com.kakao.talk;end` 를
 * `kakaolink://…` 로 바꾼다. WebView 는 intent URL 을 못 열어 앱이 Linking 으로 대신 연다.
 * intent 가 아니면 그대로 돌려준다.
 */
export function intentToScheme(url: string): { url: string; package: string | null } {
  if (!url.startsWith('intent://')) return { url, package: null };
  const hash = url.indexOf('#Intent');
  const body = url.slice('intent://'.length, hash < 0 ? undefined : hash);
  const meta = hash < 0 ? '' : url.slice(hash);
  const scheme = /scheme=([^;]+)/.exec(meta)?.[1] ?? 'kakaolink';
  const pkg = /package=([^;]+)/.exec(meta)?.[1] ?? null;
  return { url: `${scheme}://${body}`, package: pkg };
}

/** 수익인증 공유 링크 — WebView 가 붙인 token/embed 쿼리를 뺀 공개 URL. */
export function flexShareUrl(pathname: string, origin = 'https://www.arvotcg.com'): string {
  return `${origin}${pathname}`;
}
