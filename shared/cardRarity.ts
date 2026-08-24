/**
 * 카드 등급(레어도) 단일 소스 — 등급 enum(라벨·색·정렬 순서) + 상품명에서 등급 추출.
 *
 * 웹·모바일 공유 정본 — src/lib/cardRarity.ts, mobile/src/lib/cardRarity.ts 는
 * 이 파일의 re-export shim.
 *
 * RARITY_IDS 배열 순서가 곧 표시 순서다: **높은 등급 → 낮은 등급**.
 * 목록 필터 칩에는 `filter: true` 인 고등급만 노출한다 (커먼·언커먼·레어는 제외).
 *
 * 여기는 **화면 표시용**(필터 칩·배지) 정본이다. DB 적재용 레어도 파싱은
 * [[/shared/cardStatics.ts]] 의 parseCardStatics 가 담당한다 — 저장값 호환 때문에
 * 토큰 셋이 다르므로, 둘을 합치려면 적재 데이터 마이그레이션까지 함께 봐야 한다.
 */

/** 등급 enum — 이 배열 순서가 정렬 순서(높은 등급 먼저). */
export const RARITY_IDS = [
  'MUR', 'CHR', 'CSR', 'MA', 'UR', 'HR', 'SAR', 'SSR',
  'SEC', 'GMR', 'PSE', 'SEP', 'URP', 'SRP', 'CR', 'SE', 'UL', 'NP',
  'SR', 'L', 'P', 'PROMO', 'ACE', 'BWR', 'IR', 'AR', 'RRR', 'RR', 'K', 'S',
  'R', 'UC', 'U', 'N', 'C',
] as const;

export type RarityId = (typeof RARITY_IDS)[number];

export interface RarityMeta {
  id: RarityId;
  /** 칩/배지에 찍는 짧은 라벨 (토큰 그대로). */
  label: string;
  /** 툴팁·보조 설명용 한글 이름. */
  name: string;
  bg: string;
  fg: string;
  /** 목록 필터 칩에 노출할 등급인지 — 커먼~레어는 false. */
  filter: boolean;
}

const INK = '#1A1A2E';
const WHITE = '#FFFFFF';

/** 등급별 라벨·색·필터 노출 여부. 라벨 관리는 전부 이 표에서. */
export const RARITY_META: Record<RarityId, RarityMeta> = {
  // ── 최상위 특수 (황금 계열) ──
  MUR: { id: 'MUR', label: 'MUR', name: '메가 울트라 레어', bg: '#FFD23F', fg: INK, filter: true },
  CHR: { id: 'CHR', label: 'CHR', name: '캐릭터 레어', bg: '#F2B441', fg: INK, filter: true },
  CSR: { id: 'CSR', label: 'CSR', name: '캐릭터 슈퍼 레어', bg: '#E09B2D', fg: WHITE, filter: true },
  MA: { id: 'MA', label: 'MA', name: '마스터볼 미러', bg: '#DC2626', fg: WHITE, filter: true },
  // ── 울트라/하이퍼 ──
  UR: { id: 'UR', label: 'UR', name: '울트라 레어', bg: '#F59E0B', fg: INK, filter: true },
  HR: { id: 'HR', label: 'HR', name: '하이퍼 레어', bg: '#F97316', fg: WHITE, filter: true },
  SAR: { id: 'SAR', label: 'SAR', name: '스페셜 아트 레어', bg: '#EC4899', fg: WHITE, filter: true },
  SSR: { id: 'SSR', label: 'SSR', name: '샤이니 슈퍼 레어', bg: '#C084FC', fg: INK, filter: true },
  // ── 시크릿 계열 (원피스·유희왕) ──
  SEC: { id: 'SEC', label: 'SEC', name: '시크릿 레어', bg: '#DB2777', fg: WHITE, filter: true },
  GMR: { id: 'GMR', label: 'GMR', name: '골드 미스틱 레어', bg: '#B45309', fg: WHITE, filter: true },
  PSE: { id: 'PSE', label: 'PSE', name: '프리즈마틱 시크릿 레어', bg: '#F43F5E', fg: WHITE, filter: true },
  SEP: { id: 'SEP', label: 'SEP', name: '시크릿 패러렐', bg: '#E11D48', fg: WHITE, filter: true },
  URP: { id: 'URP', label: 'URP', name: '울트라 패러렐', bg: '#9333EA', fg: WHITE, filter: true },
  SRP: { id: 'SRP', label: 'SRP', name: '슈퍼 패러렐', bg: '#8B5CF6', fg: WHITE, filter: true },
  CR: { id: 'CR', label: 'CR', name: '컬렉터즈 레어', bg: '#38BDF8', fg: INK, filter: true },
  SE: { id: 'SE', label: 'SE', name: '시크릿 레어', bg: '#BE123C', fg: WHITE, filter: true },
  UL: { id: 'UL', label: 'UL', name: '얼티밋 레어', bg: '#14B8A6', fg: WHITE, filter: true },
  NP: { id: 'NP', label: 'NP', name: '노멀 패러렐', bg: '#6366F1', fg: WHITE, filter: true },
  // ── 슈퍼레어 이하 히트 ──
  SR: { id: 'SR', label: 'SR', name: '슈퍼 레어', bg: '#7C3AED', fg: WHITE, filter: true },
  L: { id: 'L', label: 'L', name: '리더', bg: '#0F766E', fg: WHITE, filter: true },
  P: { id: 'P', label: 'P', name: '프로모 패러렐', bg: '#64748B', fg: WHITE, filter: true },
  PROMO: { id: 'PROMO', label: 'PROMO', name: '프로모', bg: '#10B981', fg: WHITE, filter: true },
  ACE: { id: 'ACE', label: 'ACE', name: '에이스 스펙', bg: '#059669', fg: WHITE, filter: true },
  BWR: { id: 'BWR', label: 'BWR', name: '블랙&화이트 레어', bg: '#1F2937', fg: WHITE, filter: true },
  IR: { id: 'IR', label: 'IR', name: '일러스트 레어', bg: '#7E22CE', fg: WHITE, filter: true },
  AR: { id: 'AR', label: 'AR', name: '아트 레어', bg: '#A855F7', fg: WHITE, filter: true },
  RRR: { id: 'RRR', label: 'RRR', name: '트리플 레어', bg: '#2563EB', fg: WHITE, filter: true },
  RR: { id: 'RR', label: 'RR', name: '더블 레어', bg: '#0EA5E9', fg: WHITE, filter: true },
  K: { id: 'K', label: 'K', name: '빛나는 포켓몬', bg: '#FDE68A', fg: INK, filter: true },
  S: { id: 'S', label: 'S', name: '샤이니', bg: '#CBD5E1', fg: INK, filter: true },
  // ── 일반 등급 — 필터 칩에는 노출하지 않는다 ──
  R: { id: 'R', label: 'R', name: '레어', bg: '#3A5BD9', fg: WHITE, filter: false },
  UC: { id: 'UC', label: 'UC', name: '언커먼', bg: '#4ADE80', fg: INK, filter: false },
  U: { id: 'U', label: 'U', name: '언커먼', bg: '#22C55E', fg: WHITE, filter: false },
  N: { id: 'N', label: 'N', name: '노멀', bg: '#94A3B8', fg: WHITE, filter: false },
  C: { id: 'C', label: 'C', name: '커먼', bg: '#94A3B8', fg: WHITE, filter: false },
};

/** enum 밖 토큰(신규 세트의 미등록 등급)용 기본 스타일. */
export const RARITY_FALLBACK_META: Omit<RarityMeta, 'id' | 'label'> = {
  name: '기타',
  bg: '#94A3B8',
  fg: WHITE,
  filter: false,
};

/** 목록 필터 칩에 노출할 등급 — 높은 등급 → 낮은 등급 순. */
export const FILTER_RARITY_IDS: RarityId[] = RARITY_IDS.filter(
  (id) => RARITY_META[id].filter,
);

const RARITY_RANK: Record<string, number> = Object.fromEntries(
  RARITY_IDS.map((id, i) => [id, i]),
);

export function isRarityId(value: string | null | undefined): value is RarityId {
  return !!value && Object.prototype.hasOwnProperty.call(RARITY_META, value);
}

/** 등급 메타 조회 — enum 밖 토큰이면 라벨만 채운 기본값. */
export function rarityMetaOf(id: string): RarityMeta {
  if (isRarityId(id)) return RARITY_META[id];
  return { ...RARITY_FALLBACK_META, id: id as RarityId, label: id };
}

/** 등급 정렬 — 높은 등급 먼저. enum 밖 토큰은 뒤로 밀고 알파벳순. */
export function sortRarityIds<T extends string>(ids: T[]): T[] {
  const rank = (id: string): number => RARITY_RANK[id] ?? RARITY_IDS.length;
  return [...ids].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/* ------------------------------------------------------------------ *
 * 상품명 → 등급 토큰 추출
 * ------------------------------------------------------------------ */

/** 등급 토큰 후보 — 'SAR' 'UR' 'R-SP' 'SR+' 처럼 대문자/숫자와 -,+ 조합만. */
const RARITY_TOKEN_RE = /^[A-Z][A-Z0-9]{0,4}(?:[-+][A-Z0-9]{1,4})*$/;

/** 등급이 아니라 카드 종류·색상 표기라 토큰으로 오인하면 안 되는 것들. */
const NON_RARITY_TOKENS = new Set([
  'EX', 'GX', 'V', 'VMAX', 'VSTAR', 'BREAK', 'LV', 'X', 'PSA', 'BGS', 'DX',
  'RED', 'BLUE', 'GREEN', 'BLACK', 'WHITE', 'SP', 'TR', 'SA',
]);

/**
 * 스니덩크 상품명에서 부가 표기를 떼어낸다 — 카드번호 대괄호부터 뒤 전부,
 * 중간 괄호 설명. 콜론은 잘라내지 않고 구분자로만 바꾼다.
 *   'Zekrom ex SAR [SV11B 169/086](Expansion Pack "Black Bolt")' → 'Zekrom ex SAR'
 *   "Professor's Research (Professor Sada) SR[SV1S 099/078]"     → "Professor's Research SR"
 *   'Volcarona R :Master Ball Mirror [SV11B 019/086]'            → 'Volcarona R Master Ball Mirror'
 * 콜론을 통째로 잘라내면 'Litwick C: Master Ball Mirror'(등급 뒤 콜론) 나
 * 'Number C104: ... PSE'(이름 속 콜론) 중 한쪽이 반드시 깨진다. 구분자로만 바꾸고
 * 뒤에서부터 훑으면 'Master Ball Mirror' 같은 꾸밈말은 자연히 걸러진다.
 */
function stripNameDecorations(raw: string): string {
  return raw
    .replace(/[[［].*$/s, ' ')
    .replace(/[(（][^)）]*[)）]/g, ' ')
    .replace(/[:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 상품명 구조로 등급 토큰을 뽑는다 — 카드명 뒤쪽에서부터 첫 등급 토큰.
 * 포켓몬(SAR/AR/MUR…) 뿐 아니라 원피스(SEC/L/P)·유희왕(PSE/SE/UL) 토큰도 그대로 살리고,
 * 등급 표기가 없는 카드(스포츠 등)는 null 을 준다.
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

/** 필터 대상 고등급만 — 커먼~레어이거나 등급 표기가 없으면 null. */
export function filterRarityOf(
  ...names: Array<string | null | undefined>
): RarityId | null {
  const token = extractRarityToken(...names);
  return token && isRarityId(token) && RARITY_META[token].filter ? token : null;
}
