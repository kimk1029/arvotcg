/**
 * 내 컬렉션 관련 세션 캐시 키 — 카드 등록/삭제 같은 뮤테이션 직후 반드시 비운다.
 * (앱은 mobile/src/lib/swr.ts 의 swrInvalidate('me:') 가 같은 역할.)
 */
// v2 (2026-09-07): 박스 판정(itemKind) 규칙 변경 — v1 캐시의 옛 'box' 값을 버리기 위해 키 교체.
export const COLLECTION_CACHE_KEY = 'pf30:collection-cache:v2';
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

/** 세션 캐시에 저장된 내 카드 목록(있으면). 마이페이지 총자산도 컬렉션과 같은 값으로 그리기 위해 쓴다. */
export function peekCollectionCards<T = unknown>(): T[] | null {
  try {
    const raw = sessionStorage.getItem(COLLECTION_CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { cards?: T[] };
    return Array.isArray(j?.cards) ? j.cards : null;
  } catch {
    return null;
  }
}
