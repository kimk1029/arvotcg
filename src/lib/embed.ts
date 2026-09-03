// 웹·모바일 공유 단일 소스 — 판정 규칙은 [[/shared/embed.ts]] 에.
// 이 파일은 웹 브라우저 환경(document/sessionStorage) 감지 래퍼 + re-export shim.
export * from '../../shared/embed';
import { EMBED_STORAGE_KEY, hasEmbedQuery, isEmbedUserAgent } from '../../shared/embed';

/**
 * 현재 페이지가 앱 인앱 WebView 안에서 열렸는지.
 * layout.tsx 의 부트스트랩 스크립트가 hydration 전에 같은 규칙으로
 * `<html data-embed="1">` 을 찍어 두므로 그 속성을 우선 신뢰한다(깜빡임 방지).
 */
export function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (document.documentElement.getAttribute('data-embed') === '1') return true;
    if (hasEmbedQuery(window.location.search)) return true;
    if (isEmbedUserAgent(navigator.userAgent)) return true;
    return window.sessionStorage.getItem(EMBED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
