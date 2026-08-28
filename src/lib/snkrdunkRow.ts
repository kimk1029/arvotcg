/**
 * 홈 HOT/급등 캐러셀·스니덩 랜딩이 공유하는 행 타입 (구 DashboardScreen 에서 이동, 2026-08-28).
 */
export type SnkrdunkCategory = 'SAR' | '프로모' | 'SR' | '원피스';

export interface SnkrdunkRow {
  apparelId: number;
  shortName: string;
  /** 일본어 원문 (소제목 노출용). 비어 있으면 표시 생략. */
  localizedName?: string;
  /** 상세 조회로 확정된 분류 — HOT 카드(싱글 전용) 섹션의 박스 제외에 사용. */
  itemKind?: 'single' | 'box';
  category: SnkrdunkCategory | null;
  imageUrl: string | null;
  /** 최저 매물가(라이브 호가). */
  minPrice: number;
  /** 대표 시세 — 시세상세 헤드라인과 동일(거래 많은 등급의 최근 체결가). 없으면 minPrice 로 폴백 표시. */
  recentPrice?: number;
  /** 대표 시세의 등급 기준('PSA 10' | 'PSA 9' | 'RAW') — 'PSA 10' 이면 HOT 카드 우하단에 PSA10 마크. */
  basis?: string;
  listingCountText: string;
  /** 등락률(%) — 판매 차트 기간 시세 변화. 양수=상승, 음수=하락. 데이터 없으면 미표시. */
  changePct?: number;
}
