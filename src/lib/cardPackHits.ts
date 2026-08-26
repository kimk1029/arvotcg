/** 카드팩 힛카드 타입 (서버 구현은 server/lib/cardPackHits.ts). */

export type SnkrdunkItemKind = 'single' | 'box';

export interface PackHitCard {
  apparelId: number;
  name: string;
  koName: string;
  itemKind: SnkrdunkItemKind;
  shortName: string;
  imageUrl: string | null;
  /** 최저 매물 호가(JPY). */
  minPrice: number;
  /** 시세상세 헤드라인과 동일한 대표 시세(JPY). 0 이면 minPrice 로 폴백. */
  headlinePrice: number;
  /** 대표 시세 기준 등급 ('PSA 10' | 'PSA 9' | 'RAW'). */
  headlineBasis: string | null;
  displayPrice: string;
  listingCount: number;
  listingCountText: string;
  productNumber: string;
  lastSalePrice: number;
  lastSaleText: string;
  lastSaleSort: number;
}

export interface PackWithHits {
  code: string;
  name: string;
  shortName: string;
  emoji: string;
  bg: string;
  releasedAt?: string;
  boxImageUrl: string | null;
  boxName: string | null;
  boxKoName: string | null;
  hits: PackHitCard[];
}
