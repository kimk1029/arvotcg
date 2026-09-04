/**
 * 내 컬렉션 관련 세션 캐시 키 — 카드 등록/삭제 같은 뮤테이션 직후 반드시 비운다.
 * (앱은 mobile/src/lib/swr.ts 의 swrInvalidate('me:') 가 같은 역할.)
 */
export const COLLECTION_CACHE_KEY = 'pf30:collection-cache:v1';
/** 홈 헤더 포트폴리오 등락 인디케이터 캐시 (CleanHome). */
export const HOME_PORT_CACHE_KEY = 'pf30:homePortPct';

/** 등록/삭제 후 호출 — 다음 진입 시 낡은 총액이 먼저 그려지지 않게 한다. */
export function invalidateCollectionCaches(): void {
  try {
    sessionStorage.removeItem(COLLECTION_CACHE_KEY);
    sessionStorage.removeItem(HOME_PORT_CACHE_KEY);
  } catch {
    /* private mode 등 — 캐시는 가속용일 뿐 */
  }
}
