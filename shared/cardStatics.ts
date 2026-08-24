/**
 * 카드 정적 정보 파서 — 스니덩 카드명/품번에서 게임 구분 · 세트코드 · 카드번호 ·
 * 레어도를 추출하는 단일 구현. 서버(적재)와 어드민(재파싱)이 공유한다.
 *
 * 원칙: 세트코드와 카드번호는 항상 분리해서 반환한다 (한 필드에 합치지 않음).
 *
 * 게임별 카드 코드 형식:
 *   - 원피스:  OP02-059 / EB01-006 / ST04-005 / PRB01-001 / P-001 (프로모)
 *   - 유희왕:  QCCP-JP049 / RC04-JP021 (세트코드-지역+번호)
 *   - 포켓몬:  SV2a 199/165 / m1L 005/063 / SV-P 048 (프로모)
 */

export type CardGame = 'pokemon' | 'onepiece' | 'yugioh' | 'other';

export interface ParsedCardStatics {
  setCode: string | null;
  cardNumber: string | null;
  rarity: string | null;
  game: CardGame;
}

export const CARD_GAME_LABEL: Record<CardGame, string> = {
  pokemon: '포켓몬',
  onepiece: '원피스',
  yugioh: '유희왕',
  other: '기타',
};

// 적재용 레어도 — 저장값 호환 때문에 토큰 셋을 함부로 늘리지 않는다.
// 화면 표시(필터 칩·배지)용 등급 enum 은 [[/shared/cardRarity.ts]] 참고.
const RARITY_RE = /\b(SAR|CSR|CHR|HR|UR|SSR|SR|RRR|RR|AR|IR|SEC|PROMO|プロモ)\b/i;

// 원피스: OP01-120 / EB01-006 / ST04-005 / PRB01-001 (대괄호 유무 무관)
const ONEPIECE_RE = /\b(OP|EB|ST|PRB)-?(\d{2})-(\d{3})\b/i;
// 원피스 프로모: "P-001" — 이름 시작/공백/괄호 뒤에서만 (오매칭 방지)
const ONEPIECE_PROMO_RE = /(?:^|[\s[【［(])P-(\d{3})\b/;

// 유희왕: QCCP-JP049 — "-JP/EN/KR" 지역 토큰이 강한 식별자
const YUGIOH_RE = /\b([A-Z0-9]{2,6})-(JP|EN|KR)(\d{2,4})\b/i;

// 포켓몬 프로모: "SV-P 048" / "S-P 123" / "XY-P 001"
const POKEMON_PROMO_RE = /\b([A-Za-z]{1,3}-P)[\s-]?(\d{1,4})\b/;
// 포켓몬 세트+번호: "SV2a 199/165" / "m1L 005/063" / "S12a-215/172"
const POKEMON_SETNUM_RE = /\b([A-Za-z]{1,4}\d{1,3}[A-Za-z]?)[\s-]+(\d{1,4}\/\d{1,4})\b/;
// 번호 단독: "199/165"
const FRACTION_RE = /\b(\d{1,4}\/\d{1,4})\b/;

/** 이름 키워드 기반 게임 분류 — 코드 패턴보다 우선 적용. */
function gameFromKeywords(src: string): CardGame | null {
  if (/ワンピース|ONE\s*PIECE|원피스/i.test(src)) return 'onepiece';
  if (/遊戯王|YU-?GI-?OH|유희왕/i.test(src)) return 'yugioh';
  if (/ポケモン|ポケカ|POKEMON|포켓몬/i.test(src)) return 'pokemon';
  return null;
}

/**
 * 카드 이름/품번에서 정적 정보를 best-effort 로 추출.
 * 세트코드/카드번호는 항상 분리 — 파싱 실패 필드만 null.
 */
export function parseCardStatics(name: string, productNumber?: string | null): ParsedCardStatics {
  const src = `${name} ${productNumber ?? ''}`;
  const rarity = src.match(RARITY_RE)?.[1]?.toUpperCase() ?? null;
  const keywordGame = gameFromKeywords(src);

  // 0) 포켓몬 스니덩 구조화 코드 — 숫자 없는 세트코드(MC 등)까지 잡는다.
  //    품번 "pkmn-tcg-MC-765" 또는 이름 "[MC 765/742]" 형식.
  const pkProd = src.match(/pkmn-tcg-(.+?)-(\d{1,4})\b/i);
  if (pkProd) {
    return { setCode: pkProd[1].toUpperCase(), cardNumber: pkProd[2], rarity, game: keywordGame ?? 'pokemon' };
  }
  const pkBracket = name.match(/\[([A-Za-z][A-Za-z0-9-]{0,5})\s+(\d{1,4})\s*\/\s*\d{1,4}\]/);
  if (pkBracket && keywordGame !== 'onepiece' && keywordGame !== 'yugioh') {
    return { setCode: pkBracket[1].toUpperCase(), cardNumber: pkBracket[2], rarity, game: keywordGame ?? 'pokemon' };
  }

  // 1) 원피스 — 코드 형식이 가장 명확.
  const op = src.match(ONEPIECE_RE);
  if (op) {
    return {
      setCode: `${op[1].toUpperCase()}${op[2]}`,
      cardNumber: op[3],
      rarity,
      game: keywordGame ?? 'onepiece',
    };
  }
  const opPromo = keywordGame === 'onepiece' ? src.match(ONEPIECE_PROMO_RE) : null;
  if (opPromo) {
    return { setCode: 'P', cardNumber: opPromo[1], rarity, game: 'onepiece' };
  }

  // 2) 유희왕 — "-JP/EN/KR" 지역 토큰.
  const ygo = src.match(YUGIOH_RE);
  if (ygo) {
    return {
      setCode: ygo[1].toUpperCase(),
      cardNumber: `${ygo[2].toUpperCase()}${ygo[3]}`,
      rarity,
      game: keywordGame ?? 'yugioh',
    };
  }

  // 3) 포켓몬 프로모 (SV-P 048).
  const pkPromo = src.match(POKEMON_PROMO_RE);
  if (pkPromo) {
    return {
      setCode: pkPromo[1].toUpperCase(),
      cardNumber: pkPromo[2],
      rarity,
      game: keywordGame ?? 'pokemon',
    };
  }

  // 4) 포켓몬 세트+번호 (SV2a 199/165).
  const pk = src.match(POKEMON_SETNUM_RE);
  if (pk) {
    return {
      setCode: pk[1].toUpperCase(),
      cardNumber: pk[2],
      rarity,
      game: keywordGame ?? 'pokemon',
    };
  }

  // 5) 번호 단독 (199/165) — 세트코드 미상.
  const frac = src.match(FRACTION_RE);
  if (frac) {
    return { setCode: null, cardNumber: frac[1], rarity, game: keywordGame ?? 'pokemon' };
  }

  return { setCode: null, cardNumber: null, rarity, game: keywordGame ?? 'other' };
}
