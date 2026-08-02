/**
 * 카드 팩 카탈로그 - 홈/팩 상세에서 "팩별 힛카드" 그리드를 만드는 시드.
 *
 * 데이터(`CARD_PACKS`, `CardPackMeta`, `CardPackHit`, `getCardPack`)는 모바일
 * 앱과 공유하기 위해 [[/shared/data/cardPacks.ts]] 에서 단일 소스로 관리한다.
 * 이 파일은 그 데이터를 그대로 re-export 하고, 웹에서만 쓰는 enum / 헬퍼만
 * 추가로 정의한다.
 *
 * 각 팩은 다음 두 가지 방식으로 힛카드를 채운다:
 *   1) group: `apparelGroupId` 로 스니커덩크 박스/싱글카드 그룹을 직접 조회
 *   2) curated/fallback: `hits` 배열 또는 `searchQuery` 검색으로 부족분 채움
 *
 * 따라서 `hits` 가 비어 있어도 시스템은 그룹 API와 검색만으로 동작한다.
 */

export {
  CARD_PACKS,
  getCardPack,
  type CardPackMeta,
  type CardPackHit,
} from '../../shared/data/cardPacks';

import { CARD_PACKS, type CardPackMeta } from '../../shared/data/cardPacks';

/**
 * 카드 팩 코드 enum.
 * `CARD_PACKS` 의 `code` 와 1:1 대응. UI 코드가 magic string ('sv9') 대신
 * `CardPackCode.SV9` 를 쓰면 오타/누락 컴파일러가 잡아준다.
 *
 * 키는 대문자 + 점 제거 (e.g. 'sv11w' → SV11W, 'm1l' → M1L).
 */
export enum CardPackCode {
  M6 = 'm6',
  M5 = 'm5',
  M4 = 'm4',
  M3 = 'm3',
  M2A = 'm2a',
  M2 = 'm2',
  M1S = 'm1s',
  M1L = 'm1l',
  SV11W = 'sv11w',
  SV11B = 'sv11b',
  SV10 = 'sv10',
  SV9A = 'sv9a',
  SV9 = 'sv9',
  SV8A = 'sv8a',
  SV8 = 'sv8',
  SV7A = 'sv7a',
  SV7 = 'sv7',
  SV6A = 'sv6a',
  SV6 = 'sv6',
  SV5A = 'sv5a',
  SV5M = 'sv5m',
  SV5K = 'sv5k',
  SV4A = 'sv4a',
  SV4M = 'sv4m',
  SV4K = 'sv4k',
  SV3A = 'sv3a',
  SV3 = 'sv3',
  SV2A = 'sv2a',
  SV2D = 'sv2d',
  SV2P = 'sv2p',
  SV1A = 'sv1a',
  SV1V = 'sv1v',
  SV1S = 'sv1s',
  S12A = 's12a',
  S12 = 's12',
  S11 = 's11',
  S10B = 's10b',
  S8B = 's8b',
  S6A = 's6a',
  S4A = 's4a',
}

/** enum 으로 등록된 모든 팩 코드 (CARD_PACKS 의 순서 그대로). */
export const CARD_PACK_CODES: readonly CardPackCode[] = Object.values(CardPackCode);

/**
 * enum / 문자열 어느 쪽으로도 호출 가능한 메타 조회.
 * 알 수 없는 코드면 `undefined`.
 */
export function getCardPackMeta(code: CardPackCode | string): CardPackMeta | undefined {
  return CARD_PACKS.find((p) => p.code === code);
}

/** runtime 에서 임의 문자열이 등록된 팩 코드인지 검증. */
export function isCardPackCode(code: string): code is CardPackCode {
  return CARD_PACK_CODES.includes(code as CardPackCode);
}
