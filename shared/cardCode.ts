/**
 * 카메라 스캔 fast path 파서 — 카드 **좌하단 정보줄** OCR 텍스트에서
 * 세트코드 / 카드번호 / 레어도만 뽑는다. (웹·앱·서버 공용 순수 함수)
 *
 * 이름·일러스트를 읽지 않고 코드만 보는 이유: 좌하단 줄은 폰트가 작아도
 * 형태가 규칙적이라 온디바이스 OCR 로도 잘 읽히고, "세트코드+번호"만 있으면
 * 우리 DB(SnkrdunkCard.setCode/cardNumber)에서 카드를 바로 특정할 수 있다.
 *
 * 카드명 문자열에서 뽑는 정식 파서는 [[/shared/cardStatics.ts]] 이며 여기서
 * 먼저 시도한다. OCR 텍스트는 토큰 순서가 뒤집히거나("125/098 SV10") 줄이
 * 쪼개져 그 정규식이 빗나가므로, 실패했을 때만 아래 느슨한 규칙을 쓴다.
 */

import { parseCardStatics, type CardGame } from './cardStatics';
import { isRarityId } from './cardRarity';

export interface ScannedCardCode {
  /** 'SV10' 'OP16' 'CORI' 등. 못 읽으면 null. */
  setCode: string | null;
  /** '125' — 총매수(/098)는 제외한 카드 번호. 못 읽으면 null. */
  cardNumber: string | null;
  /** '098' — 총매수. 없으면 null. */
  totalNumber: string | null;
  /** 'SAR' 'U' 등. 없으면 null. */
  rarity: string | null;
  game: CardGame;
  /** 검색/디버그용 원문 (줄 합침). */
  raw: string;
}

const EMPTY: Omit<ScannedCardCode, 'raw' | 'game'> = {
  setCode: null,
  cardNumber: null,
  totalNumber: null,
  rarity: null,
};

/** '125/098' — 카드번호/총매수. */
const FRACTION_RE = /(\d{1,4})\s*\/\s*(\d{1,4})/;
/** 포켓몬 세트코드 — 'SV10' 'sv2a' 'M6' 's12a' 'SV-P'(프로모). */
const POKEMON_SET_RE = /\b([A-Za-z]{1,3}-P|[A-Za-z]{1,4}\d{1,3}[A-Za-z]?)\b/;
/** 원피스 'OP16-042' / 유희왕 'CORI-JP027' — 코드 자체에 번호가 붙는 형식. */
const ONEPIECE_RE = /\b(OP|EB|ST|PRB)-?(\d{2})-(\d{3})\b/i;
const YUGIOH_RE = /\b([A-Z0-9]{2,6})-(JP|EN|KR)(\d{2,4})\b/i;

/**
 * 레어도 토큰 추출 — 등급 enum([[/shared/cardRarity.ts]])에 실제로 있는 토큰만 인정한다.
 * 상품명 파서(extractRarityToken)는 "마지막 대문자 토큰"을 집어서 OCR 조각에서는
 * 세트코드('SV10')를 레어도로 오인한다. 여기서는 화이트리스트로만 고른다.
 */
function pickRarityToken(text: string, setCode: string | null): string | null {
  const tokens = text.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  // 세트코드와 그 조각('SV-P' → SV, P)은 후보에서 제외.
  const fromSet = new Set(
    (setCode ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).concat(setCode ? [setCode.toUpperCase()] : []),
  );
  let found: string | null = null;
  for (const tok of tokens) {
    if (fromSet.has(tok)) continue;
    if (isRarityId(tok)) found = tok; // 뒤쪽 토큰 우선 — 보통 번호 뒤에 찍힌다
  }
  return found;
}

/** OCR 오독 교정 — 코드 문맥에서 흔한 글자/숫자 혼동만 최소로. */
function fixOcrDigits(s: string): string {
  return s.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0').replace(/[lI](?=\d)|(?<=\d)[lI]/g, '1');
}

/**
 * OCR 로 읽은 줄들에서 카드 코드를 뽑는다.
 * 줄 순서·대소문자는 신경 쓰지 않는다 — 좌하단 ROI 한 조각만 넘겨도 되고,
 * 카드 전체 OCR 결과를 넘겨도 동작한다.
 */
export function parseScannedCardCode(lines: Array<string | null | undefined>): ScannedCardCode {
  const clean = lines
    .map((l) => (l ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const raw = clean.join(' ');
  if (!raw) return { ...EMPTY, game: 'other', raw: '' };

  const fixed = fixOcrDigits(raw);

  // 1) 정식 파서 우선 — 원피스/유희왕 코드와 정상 순서의 포켓몬 코드를 잡는다.
  const statics = parseCardStatics(fixed);
  if (statics.setCode && statics.cardNumber) {
    const [num, total] = statics.cardNumber.split('/');
    return {
      setCode: statics.setCode.toUpperCase(),
      cardNumber: num || null,
      totalNumber: total || null,
      rarity: statics.rarity ?? pickRarityToken(fixed, statics.setCode),
      game: statics.game,
      raw,
    };
  }

  // 2) 게임별 코드 형식 직접 매칭 (정식 파서가 놓친 조각 입력).
  const op = fixed.match(ONEPIECE_RE);
  if (op) {
    return {
      setCode: `${op[1].toUpperCase()}${op[2]}`,
      cardNumber: op[3],
      totalNumber: null,
      rarity: pickRarityToken(fixed, `${op[1]}${op[2]}`),
      game: 'onepiece',
      raw,
    };
  }
  const yg = fixed.match(YUGIOH_RE);
  if (yg) {
    return {
      setCode: yg[1].toUpperCase(),
      cardNumber: `${yg[2].toUpperCase()}${yg[3]}`,
      totalNumber: null,
      rarity: pickRarityToken(fixed, yg[1]),
      game: 'yugioh',
      raw,
    };
  }

  // 3) 포켓몬 느슨한 규칙 — '125/098' 을 찾고, 세트코드는 순서 무관하게 근처에서.
  const frac = fixed.match(FRACTION_RE);
  const cardNumber = frac ? frac[1] : null;
  const totalNumber = frac ? frac[2] : null;
  // 세트코드 후보에서 분수(125/098) 부분은 지우고 찾는다 — '098' 이 코드로 잡히는 것 방지.
  const withoutFraction = frac ? fixed.replace(frac[0], ' ') : fixed;
  const setMatch = withoutFraction.match(POKEMON_SET_RE);
  const setCode = setMatch ? setMatch[1].toUpperCase() : null;

  return {
    setCode,
    cardNumber,
    totalNumber,
    rarity: pickRarityToken(fixed, setCode),
    game: setCode || cardNumber ? 'pokemon' : 'other',
    raw,
  };
}

/** 코드가 검색에 쓸 만큼 나왔는지 — 세트코드 + 번호 둘 다 필요. */
export function isUsableCardCode(code: ScannedCardCode): boolean {
  return !!code.setCode && !!code.cardNumber;
}

/** 스니덩 검색어 — 직접입력 검색과 같은 형식('SV10 125'). */
export function cardCodeQuery(code: Pick<ScannedCardCode, 'setCode' | 'cardNumber'>): string {
  return [code.setCode, code.cardNumber].filter(Boolean).join(' ').trim();
}
