/**
 * 앱 인앱 WebView(임베드) 모드 식별 — 웹·앱 공통 정본.
 *
 * 앱이 웹 페이지(카드쇼 사전예약, 약관, 배너 링크 등)를 WebView 로 띄우면
 * 앱의 네이티브 탭바가 이미 있으므로 웹의 하단 네비게이션을 그리면 안 된다.
 * 식별 채널 두 가지(둘 중 하나면 임베드):
 *  1. URL 쿼리 `?embed=1` — 첫 진입 URL 에 앱이 붙인다. 웹은 sessionStorage 에
 *     저장해 이후 클라이언트 라우팅/새 페이지 이동에도 유지.
 *  2. User-Agent 에 `ARVOTCG-App` 토큰 — 앱 WebView 의 applicationNameForUserAgent.
 *     쿼리가 유실돼도(외부 링크 → 우리 도메인 복귀 등) 항상 살아 있다.
 */
export const EMBED_QUERY_KEY = 'embed';
export const EMBED_STORAGE_KEY = 'pf30:embed';
/** react-native-webview `applicationNameForUserAgent` 값 — UA 끝에 `ARVOTCG-App/1.0` 형태로 붙는다. */
export const EMBED_UA_TOKEN = 'ARVOTCG-App';

export function isEmbedUserAgent(ua: string | null | undefined): boolean {
  return !!ua && ua.includes(EMBED_UA_TOKEN);
}

export function hasEmbedQuery(search: string | null | undefined): boolean {
  if (!search) return false;
  try {
    return new URLSearchParams(search).get(EMBED_QUERY_KEY) === '1';
  } catch {
    return false;
  }
}
