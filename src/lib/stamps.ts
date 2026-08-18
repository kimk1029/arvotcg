/** 아르보TCG 스탬프 랠리 스펙 (레거시 이벤트 — 현재 미노출). */

export interface StampSpot {
  no: number;
  /** places.id 와 매칭 (혼잡도 참조용). 없으면 참조 없이 독립 표시. */
  placeId: string;
  name: string;
  subtitle?: string;
  emoji: string;
  bg: string;
  /** 실제 도로명/지번 주소 — Naver Map 에서 Geocoder 로 좌표 보정에 사용 */
  address: string;
  /** 근사 좌표 — Geocoder 실패 또는 로드 전 초기값 */
  coord: { lat: number; lng: number };
}

export const STAMP_SPOTS: StampSpot[] = [
  {
    no: 1,
    placeId: 'shoe',
    name: '성수 구두 테마공원',
    subtitle: '연무장5길 입구',
    emoji: '👟',
    bg: '#FB923C',
    address: '서울 성동구 연무장5길 9-26',
    coord: { lat: 37.5430, lng: 127.0558 },
  },
  {
    no: 2,
    placeId: 'trend',
    name: 'TCG 파티 팝업',
    subtitle: '트렌드팟 바이 올리브영N · 팩토리얼성수',
    emoji: '🎊',
    bg: '#FFD23F',
    address: '서울 성동구 연무장7길 13',
    coord: { lat: 37.5441, lng: 127.0550 },
  },
  {
    no: 3,
    placeId: 'metamong',
    name: '메타몽 놀이터',
    subtitle: '성수동2가 · 성수이로7가길',
    emoji: '🎪',
    bg: '#4ADE80',
    address: '서울 성동구 성수이로7가길 9',
    coord: { lat: 37.5443, lng: 127.0546 },
  },
  {
    no: 4,
    placeId: 'rainbow',
    name: '어린이 무지개 공원',
    subtitle: '성수동2가 844',
    emoji: '🌈',
    bg: '#6FC0E5',
    address: '서울 성동구 성수동2가 844',
    coord: { lat: 37.5432, lng: 127.0528 },
  },
  {
    no: 5,
    placeId: 'secret',
    name: '시크릿 포레스트 입구',
    subtitle: '서울숲 은행나무길',
    emoji: '🌲',
    bg: '#6B3FA0',
    address: '서울 성동구 성수동1가 685-30',
    coord: { lat: 37.5460, lng: 127.0410 },
  },
  {
    no: 6,
    placeId: 'secret',
    name: '시크릿 포레스트 팝업',
    subtitle: '서울숲 은행나무길 팝업관',
    emoji: '🎁',
    bg: '#E63946',
    address: '서울 성동구 성수동1가 685-30',
    // 5번과 같은 주소지만 마커 겹치지 않게 미세 오프셋
    coord: { lat: 37.5463, lng: 127.0413 },
  },
];

export interface StampReward {
  count: number;
  title: string;
  summary: string;
  emoji: string;
  desc: string;
  color: string;
}

export const STAMP_REWARDS: StampReward[] = [
  {
    count: 1,
    title: '첫 스탬프 보상',
    summary: '한정 스티커',
    emoji: '🎁',
    desc: '첫 번째 스팟 방문 시 한정판 스티커 1매 증정',
    color: '#4ADE80',
  },
  {
    count: 3,
    title: '한정 프로모 카드',
    summary: '메인 보상',
    emoji: '🎴',
    desc: '스탬프 3개 수집 시 한정 프로모 카드 지급. 이벤트 한정 일러스트',
    color: '#E63946',
  },
  {
    count: 6,
    title: '그랜드 프라이즈 응모권',
    summary: '경품 응모',
    emoji: '🏆',
    desc: '스탬프 6개 전부 모으면 대형 경품 응모권 제공. 추첨으로 굿즈 패키지 증정',
    color: '#FFD23F',
  },
];

export const EVENT_META = {
  title: '아르보TCG 스탬프 랠리',
  period: '2026.05.01 – 05.31',
  location: '서울 성수 일대',
  how: '6곳의 이벤트 스팟 방문 → 스탬프 수집 → 보상 센터 방문하여 교환',
};
