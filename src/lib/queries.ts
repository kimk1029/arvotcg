/** 서버 쿼리 결과 타입 (서버 구현은 server/lib/queries.ts). */

export interface MyCardRow {
  id: number;
  cardId: string | null;
  ocrSetCode: string | null;
  ocrCardNumber: string | null;
  snkrdunkApparelId: number | null;
  nickname: string | null;
  memo: string | null;
  gradeEstimate: string | null;
  centeringScore: number | null;
  photoUrl: string | null;
  /** 등록 시점 시세(JPY) 기준값(등급카드는 등급 시세) — 리스트 등락률용. 없으면 null. */
  registerPriceJpy: number | null;
  /** 등급(그레이딩) 카드 여부 + 등급사/등급 — 등록 팝업 입력값. */
  graded: boolean;
  gradeCompany: string | null;
  gradeValue: string | null;
  createdAt: string;
}

export interface MyCardWithPrice extends MyCardRow {
  latestPrice: number;
  /** 최근 7개 스냅샷 평균값들 (오래된 → 최신). 데이터 부족 시 빈 배열. */
  trend: number[];
  /** snkrdunkApparelId 가 있을 때만 채워짐. */
  snkrdunkName: string | null;
  snkrdunkImageUrl: string | null;
  /** 호환용 — priceSingleJpy 와 동일. */
  snkrdunkMinPriceJpy: number;
  /** 싱글카드 (raw, non-PSA10) 중앙값 시세. */
  priceSingleJpy: number;
  /** PSA10 중앙값 시세. 데이터 없으면 0. */
  pricePsa10Jpy: number;
  /** PSA9 중앙값 시세. 데이터 없으면 0. */
  pricePsa9Jpy: number;
  /** PSA8 중앙값 시세. 데이터 없으면 0. */
  pricePsa8Jpy: number;
  /**
   * 등급 기준 현재시세(JPY) — 등록가와 같은 규칙(PSA10/9/8→등급가, 타사→PSA10,
   * 싱글→raw)으로 산정. 등락률은 이 값과 registerPriceJpy 를 비교한다. 없으면 0.
   */
  currentPriceJpy: number;
}

export interface MyFavoriteRow {
  id: number;
  snkrdunkApparelId: number;
  createdAt: string;
  name: string | null;
  imageUrl: string | null;
  minPriceJpy: number;
  /** 일별 시세 추이(오래된 → 최신). 스냅샷이 없으면 빈 배열. */
  trend: number[];
  /** 어제(직전 체결일) 대비 등락률(%). 데이터 부족 시 null. */
  changePct: number | null;
}
