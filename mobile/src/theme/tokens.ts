/**
 * 아르보TCG — 디자인 토큰 (ARVOTCG 통합)
 * 웹 globals.css :root 변수와 1:1 매핑.
 */

export const colors = {
  red: '#E63946',
  redLt: '#FF6470',
  redDk: '#8F1620',
  yel: '#FFD23F',
  yelLt: '#FFE987',
  yelDk: '#B88400',
  /** ARVOTCG gold (yel 별칭 — 의미 명확화용) */
  gold: '#FFD23F',
  goldLt: '#FFE987',
  goldDk: '#B88400',
  /** 웹 --gold-soft 대응 — 골드 틴트 면(가격 필 등). 픽셀 테마는 골드 원색과 동일. */
  goldSoft: '#FFD23F',
  blu: '#3A5BD9',
  bluLt: '#7A94FF',
  bluDk: '#1B2E89',
  grn: '#4ADE80',
  grnLt: '#8BF5AB',
  grnDk: '#0F6B2E',
  orn: '#FB923C',
  ornLt: '#FDB57D',
  ornDk: '#8F3F08',
  pur: '#6B3FA0',
  purLt: '#9B6FD0',
  purDk: '#3D1D6B',
  pnk: '#EC4899',
  pnkLt: '#F9A8D4',
  pnkDk: '#831843',
  teal: '#0D7377',
  nav: '#1B2E89',
  navLt: '#2E4ACA',
  navDk: '#0D1A5A',
  // 웹 globals.css :root 와 1:1 (박스 테두리/그림자/배경 톤 일치).
  ink: '#1A1A2E',
  ink2: '#2E3550',
  ink3: '#6B7490',
  ink4: '#94A3B8',
  bg: '#F7F3E3',
  paper: '#F7F3E3',
  pap2: '#E8DFB8',
  pap3: '#C9BD8A',
  papdk: '#8A7F56',
  white: '#FFFFFF',
  /** Rarity */
  rCommon: '#6B7490',
  rUncommon: '#22C55E',
  rRare: '#3A5BD9',
  rSr: '#7C3AED',
  rHr: '#EC4899',
  rSecret: '#FFD23F',
  /** PSA grade */
  psa10: '#FFD700',
  psa9: '#C0C0C0',
  psa8: '#CD7F32',
  psa7: '#94A3B8',
};

export const fonts = {
  pixel: 'PressStart2P_400Regular',
  ko: 'Galmuri11',
  koBold: 'Galmuri11_Bold',
} as const;

export const space = {
  gap: 14,
  // 웹 --cg 는 12px 지만, 모바일 픽셀 박스는 드롭섀도(~6px)를 실제 레이아웃 공간으로
  // 예약한다(웹 box-shadow 는 공간을 안 먹고 마진 위로 겹침). 그래서 6 으로 두면
  // 카드 간격 = cg(6) + 그림자(6) ≈ 12 로 웹과 같아진다.
  cg: 6,
};

/** 웹의 픽셀 박스 그림자 패턴을 RN에서 흉내내는 헬퍼. */
export const pixelBoxShadow = {
  borderWidth: 3,
  borderColor: colors.ink,
};
