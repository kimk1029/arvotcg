/**
 * 세트코드 → 박스(세트) 이름·발매일 매핑.
 *
 * 파서(parseCardStatics)가 카드명/품번에서 뽑은 *대문자* 세트코드(예: "OP02",
 * "EB01", "SV-P")를 한국어 박스 이름과 일본 발매일로 해석한다. 어드민 카탈로그
 * "세트코드별 보기"에서 그룹 헤더에 출시일·박스명을 보여주는 데 쓴다.
 *
 * 포켓몬 본탄(SV·M·S 시리즈)은 CARD_PACKS 에 이름/발매일이 이미 있으므로 여기
 * 중복 등록하지 않는다 — 조회 측에서 CARD_PACKS 로 폴백한다. 여기는 CARD_PACKS
 * 가 다루지 않는 원피스 실제 세트코드(OP/EB/PRB)·유희왕·프로모를 보강한다.
 *
 * 발매일은 일본(JP) 기준. 자료 출처: ONE PIECE 공식·스니덩·각 위키(2026-06 확인).
 */

export interface SetCodeMeta {
  /** 한국어 박스(세트) 이름. */
  name: string;
  /** 일본 발매일 (YYYY-MM-DD). 모르면 생략. */
  releasedAt?: string;
}

/** 세트코드(대문자) → 메타. */
export const SET_CODE_META: Record<string, SetCodeMeta> = {
  // ── 원피스 카드게임 부스터 (OP) ──
  OP01: { name: '로맨스 던', releasedAt: '2022-07-22' },
  OP02: { name: '정상 결전', releasedAt: '2022-11-04' },
  OP03: { name: '강대한 적', releasedAt: '2023-02-11' },
  OP04: { name: '모략의 왕국', releasedAt: '2023-05-27' },
  OP05: { name: '신시대의 주역', releasedAt: '2023-08-26' },
  OP06: { name: '쌍벽의 패자', releasedAt: '2023-11-25' },
  OP07: { name: '500년 후의 미래', releasedAt: '2024-02-24' },
  OP08: { name: '두 개의 전설', releasedAt: '2024-05-25' },
  OP09: { name: '새로운 황제', releasedAt: '2024-08-31' },
  OP10: { name: '왕족의 혈통', releasedAt: '2024-11-30' },
  OP11: { name: '신속의 주먹', releasedAt: '2025-03-01' },
  OP12: { name: '사제의 인연', releasedAt: '2025-05-31' },
  OP13: { name: '계승되는 의지', releasedAt: '2025-08-23' },
  OP14: { name: '창해의 칠무해', releasedAt: '2025-11-22' },
  OP15: { name: '신의 섬의 모험', releasedAt: '2026-02-28' },
  OP16: { name: '결전의 시각', releasedAt: '2026-05-30' },

  // ── 원피스 확장 부스터 (EB) / 프리미엄 부스터 (PRB) ──
  EB01: { name: '메모리얼 컬렉션', releasedAt: '2024-01-27' },
  EB02: { name: 'Anime 25th 컬렉션', releasedAt: '2025-01-25' },
  EB03: { name: '히로인즈 에디션', releasedAt: '2025-10-25' },
  PRB01: { name: 'ONE PIECE CARD THE BEST', releasedAt: '2024-07-27' },
  PRB02: { name: 'ONE PIECE CARD THE BEST vol.2', releasedAt: '2025-07-26' },

  // 원피스 프로모 (P-001 …).
  P: { name: '원피스 프로모' },

  // ── 유희왕 OCG 특전/레어리티 컬렉션 (실제 세트 약호) ──
  RC04: { name: '레어리티 컬렉션 -쿼터 센추리 에디션-', releasedAt: '2024-02-23' },
  QCCP: { name: '쿼터 센추리 크로니클 side:PRIDE', releasedAt: '2024-09-07' },

  // ── 포켓몬 프로모 (SV-P / S-P …) ──
  'SV-P': { name: '포켓몬 프로모 (SV-P)' },
  'S-P': { name: '포켓몬 프로모 (S-P)' },
  'SM-P': { name: '포켓몬 프로모 (SM-P)' },
  'XY-P': { name: '포켓몬 프로모 (XY-P)' },
};

/** 세트코드(대소문자 무관)로 메타 조회. 없으면 undefined. */
export function getSetCodeMeta(setCode: string | null | undefined): SetCodeMeta | undefined {
  if (!setCode) return undefined;
  return SET_CODE_META[setCode.toUpperCase()];
}
