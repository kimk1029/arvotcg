/**
 * 포켓몬 TCG 등급 토큰 (C / U / R / RR / AR / SAR / SR / HR / UR / MA / MUR / CHR).
 * 스니덩크 상품명/별칭에서 가장 잘 어울리는 등급을 추출한다.
 *
 * 웹·모바일 공유 단일 소스 — src/lib/cardRarity.ts, mobile/src/lib/cardRarity.ts 는
 * 이 파일의 re-export shim.
 *
 * 우선순위: 가장 긴 토큰부터 매칭 (SAR 가 AR 보다 먼저, MUR 가 UR 보다 먼저).
 * 매칭이 안 되면 'C'.
 */

export type Rarity =
  | 'C'
  | 'U'
  | 'R'
  | 'RR'
  | 'AR'
  | 'SAR'
  | 'SR'
  | 'HR'
  | 'UR'
  | 'MA'
  | 'MUR'
  | 'CHR';

/** 필터 / 라벨 순서 — 낮은 등급 → 높은 등급. */
export const RARITY_ORDER: Rarity[] = [
  'C',
  'U',
  'R',
  'RR',
  'AR',
  'SR',
  'SAR',
  'HR',
  'UR',
  'MA',
  'MUR',
  'CHR',
];

/** 픽셀프레스 배지 색 — RR 이상은 골드/퍼플 강조. */
export const RARITY_BG: Record<Rarity, string> = {
  C: '#94A3B8',
  U: '#22C55E',
  R: '#3A5BD9',
  RR: '#0EA5E9',
  AR: '#A855F7',
  SR: '#7C3AED',
  SAR: '#EC4899',
  HR: '#F97316',
  UR: '#F59E0B',
  MA: '#DC2626',
  MUR: '#B91C1C',
  CHR: '#FFD23F',
};

export const RARITY_FG: Record<Rarity, string> = {
  C: '#FFFFFF',
  U: '#FFFFFF',
  R: '#FFFFFF',
  RR: '#FFFFFF',
  AR: '#FFFFFF',
  SR: '#FFFFFF',
  SAR: '#FFFFFF',
  HR: '#FFFFFF',
  UR: '#1A1A2E',
  MA: '#FFFFFF',
  MUR: '#FFFFFF',
  CHR: '#1A1A2E',
};

// 긴 토큰 먼저. 단어 경계는 매칭에서 직접 체크 (한국어/일본어 콘텍스트 호환을 위해 \b 미사용).
const TOKENS_BY_LENGTH: Rarity[] = [
  'MUR',
  'SAR',
  'CHR',
  'MA',
  'AR',
  'HR',
  'UR',
  'SR',
  'RR',
  'R',
  'U',
  'C',
];

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-Za-z0-9]/.test(ch);
}

/**
 * 카드명 후보들에서 등급 토큰을 추출.
 * 단어 경계 (영문/숫자 인접 X) 를 손수 확인 — 한글/일본어/괄호 등의 사이에 끼인 토큰을 잡아낸다.
 *   '리자몽 ex SAR (091/064)' → 'SAR'
 *   'リザードンex SR' → 'SR'
 *   '피카츄 ex AR-홀로' → 'AR'
 */
export function detectRarity(
  ...names: Array<string | null | undefined>
): Rarity {
  for (const raw of names) {
    if (!raw) continue;
    const upper = raw.toUpperCase();
    for (const tok of TOKENS_BY_LENGTH) {
      let idx = 0;
      while ((idx = upper.indexOf(tok, idx)) !== -1) {
        const before = upper[idx - 1];
        const after = upper[idx + tok.length];
        if (!isWordChar(before) && !isWordChar(after)) {
          return tok;
        }
        idx += tok.length;
      }
    }
  }
  return 'C';
}

/* ------------------------------------------------------------------ *
 * 목록 등급 필터 (팩 상세 싱글카드 리스트) — 웹/앱 공용
 * ------------------------------------------------------------------ */

/** 등급 토큰이 없는 카드(스포츠·미표기 커먼 등)를 담는 묶음 라벨. */
export const OTHER_RARITY_LABEL = '기타';

/**
 * 필터 칩 정렬 순서 (낮은 등급 → 높은 등급). 포켓몬 구·신 표기에 원피스(L/P/SEC)·
 * 유희왕(SE/PSE/UL) 토큰까지 포함한다. 목록에 없는 토큰은 알파벳순으로 뒤에 붙고,
 * OTHER_RARITY_LABEL 은 언제나 마지막.
 */
const RARITY_LABEL_ORDER: string[] = [
  'C', 'U', 'UC', 'N', 'R', 'RR', 'RRR', 'K', 'S', 'SSR',
  'AR', 'SR', 'SAR', 'HR', 'UR', 'MA', 'MUR', 'CHR', 'BWR',
  'SE', 'PSE', 'UL', 'L', 'P', 'SEC',
];

/** 등급 토큰 후보 — 'SAR' 'UR' 'R-SP' 'SR+' 처럼 대문자/숫자와 -,+ 조합만. */
const RARITY_TOKEN_RE = /^[A-Z][A-Z0-9]{0,4}(?:[-+][A-Z0-9]{1,4})*$/;

/** 등급이 아니라 카드 종류를 뜻하는 접미사 — 토큰으로 오인하지 않는다. */
const NON_RARITY_TOKENS = new Set([
  'EX', 'GX', 'V', 'VMAX', 'VSTAR', 'BREAK', 'LV', 'X', 'PSA', 'BGS', 'DX',
]);

/**
 * 스니덩크 상품명에서 부가 표기를 떼어낸다 — 카드번호 대괄호부터 뒤 전부,
 * 중간 괄호 설명, 콜론 뒤 파생 표기.
 *   'Zekrom ex SAR [SV11B 169/086](Expansion Pack "Black Bolt")' → 'Zekrom ex SAR'
 *   "Professor's Research (Professor Sada) SR[SV1S 099/078]"     → "Professor's Research SR"
 *   'Volcarona R :Master Ball Mirror [SV11B 019/086]'            → 'Volcarona R'
 */
function stripNameDecorations(raw: string): string {
  return raw
    .replace(/[[［].*$/s, ' ')
    .replace(/[(（][^)）]*[)）]/g, ' ')
    .replace(/[:：].*$/s, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 상품명 구조로 등급 토큰을 뽑는다 — 카드명 뒤쪽에서부터 첫 등급 토큰.
 * detectRarity 의 부분 문자열 탐색과 달리 포켓몬 외 게임(원피스 SEC/L, 유희왕 PSE/UL)
 * 토큰도 그대로 살리고, 등급 표기가 없는 카드(스포츠)는 null 을 준다.
 * 파생 표기는 기준 등급으로 합친다 ('SR-SPC' → 'SR').
 */
export function extractRarityToken(
  ...names: Array<string | null | undefined>
): string | null {
  for (const raw of names) {
    if (!raw) continue;
    const parts = stripNameDecorations(raw).split(' ').filter(Boolean);
    // 뒤에서부터 — 'Roronoa Zoro SR Parallel' 처럼 꼬리말이 붙어도 등급을 찾는다.
    // 첫 토큰(index 0)은 카드 이름 자체라 후보에서 제외.
    for (let i = parts.length - 1; i >= 1; i -= 1) {
      const tok = parts[i];
      if (!RARITY_TOKEN_RE.test(tok)) continue;
      const base = tok.split(/[-+]/)[0];
      if (!base || NON_RARITY_TOKENS.has(base)) continue;
      return base;
    }
  }
  return null;
}

/** 필터 칩에 쓸 라벨 — 토큰이 없으면 '기타'. */
export function rarityLabelOf(
  ...names: Array<string | null | undefined>
): string {
  return extractRarityToken(...names) ?? OTHER_RARITY_LABEL;
}

/** 라벨 정렬 — RARITY_LABEL_ORDER → 미지 토큰(알파벳) → '기타'. */
export function sortRarityLabels(labels: string[]): string[] {
  const rank = (label: string): number => {
    if (label === OTHER_RARITY_LABEL) return Number.MAX_SAFE_INTEGER;
    const i = RARITY_LABEL_ORDER.indexOf(label);
    return i === -1 ? RARITY_LABEL_ORDER.length : i;
  };
  return [...labels].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
