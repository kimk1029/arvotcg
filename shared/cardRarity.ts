/**
 * 카드 등급(레어도) 단일 소스 — 게임별 등급 사다리 + 라벨·색 + 상품명에서 등급 추출.
 *
 * 웹·모바일 공유 정본 — src/lib/cardRarity.ts, mobile/src/lib/cardRarity.ts 는
 * 이 파일의 re-export shim.
 *
 * **등급 체계는 게임마다 다르다.** 포켓몬(SAR/AR/RR…), 원피스(SEC/L/파라렐),
 * 유희왕(SE/PSE/UL/CR…)은 서로 다른 사다리를 쓰므로 게임별로 관리한다.
 * 토큰의 뜻이 겹치는 것(SR=슈퍼레어, R=레어, C=커먼 …)은 RARITY_META 한 곳에서
 * 라벨·색을 공유하고, **순서와 소속만** RARITY_LADDER_BY_GAME 이 정한다.
 *
 * 사다리 배열 순서 = 표시 순서: **높은 등급 → 낮은 등급**.
 * `chip: false` 인 일반 등급(커먼·언커먼·레어)은 목록 필터 칩에서 제외한다.
 *
 * 여기는 **화면 표시용**(필터 칩·배지) 정본이다. DB 적재용 레어도 파싱은
 * [[/shared/cardStatics.ts]] 의 parseCardStatics 가 담당한다 — 저장값 호환 때문에
 * 토큰 셋이 다르므로, 둘을 합치려면 적재 데이터 마이그레이션까지 함께 봐야 한다.
 */

import type { CardPackGame } from './data/cardPacks';
import { getCardPack } from './data/cardPacks';
import { parseCardStatics } from './cardStatics';

/** 등급 체계를 가진 게임 구분 — 카드팩 카탈로그(CardPackGame)와 같은 키. */
export type RarityGame = CardPackGame;

export interface RarityMeta {
  /** 칩/배지에 찍는 짧은 라벨 (스니덩크 상품명 토큰 그대로). */
  label: string;
  /** 툴팁·보조 설명용 한글 이름. */
  name: string;
  bg: string;
  fg: string;
}

const INK = '#1A1A2E';
const WHITE = '#FFFFFF';

/**
 * 등급 라벨·색 표 — 라벨 관리는 전부 여기서.
 * 게임이 달라도 뜻이 같은 토큰(SR/R/C/UC/UR…)은 한 줄을 공유한다.
 */
export const RARITY_META = {
  // ── 포켓몬 ──
  MUR: { label: 'MUR', name: '메가 울트라 레어', bg: '#FFD23F', fg: INK },
  BWR: { label: 'BWR', name: '블랙&화이트 레어', bg: '#1F2937', fg: WHITE },
  SAR: { label: 'SAR', name: '스페셜 아트 레어', bg: '#EC4899', fg: WHITE },
  HR: { label: 'HR', name: '하이퍼 레어', bg: '#F97316', fg: WHITE },
  CSR: { label: 'CSR', name: '캐릭터 슈퍼 레어', bg: '#E09B2D', fg: WHITE },
  CHR: { label: 'CHR', name: '캐릭터 레어', bg: '#F2B441', fg: INK },
  SSR: { label: 'SSR', name: '샤이니 슈퍼 레어', bg: '#C084FC', fg: INK },
  S: { label: 'S', name: '샤이니', bg: '#CBD5E1', fg: INK },
  AR: { label: 'AR', name: '아트 레어', bg: '#A855F7', fg: WHITE },
  IR: { label: 'IR', name: '일러스트 레어', bg: '#7E22CE', fg: WHITE },
  K: { label: 'K', name: '빛나는 포켓몬', bg: '#FDE68A', fg: INK },
  ACE: { label: 'ACE', name: '에이스 스펙', bg: '#059669', fg: WHITE },
  MA: { label: 'MA', name: '마스터볼 미러', bg: '#DC2626', fg: WHITE },
  RRR: { label: 'RRR', name: '트리플 레어', bg: '#2563EB', fg: WHITE },
  RR: { label: 'RR', name: '더블 레어', bg: '#0EA5E9', fg: WHITE },
  // ── 원피스 ──
  SEC: { label: 'SEC', name: '시크릿 레어', bg: '#DB2777', fg: WHITE },
  TR: { label: 'TR', name: '트레저 레어', bg: '#B45309', fg: WHITE },
  L: { label: 'L', name: '리더', bg: '#0F766E', fg: WHITE },
  UC: { label: 'UC', name: '언커먼', bg: '#4ADE80', fg: INK },
  P: { label: 'P', name: '프로모', bg: '#64748B', fg: WHITE },
  // ── 유희왕 ──
  GMR: { label: 'GMR', name: '골드 레어 (시리얼)', bg: '#CA8A04', fg: WHITE },
  CR: { label: 'CR', name: '컬렉터즈 레어', bg: '#38BDF8', fg: INK },
  QCSE: { label: 'QCSE', name: '쿼터 센추리 시크릿 레어', bg: '#A21CAF', fg: WHITE },
  PSE: { label: 'PSE', name: '프리즈마틱 시크릿 레어', bg: '#F43F5E', fg: WHITE },
  SEP: { label: 'SEP', name: '시크릿 패러렐', bg: '#E11D48', fg: WHITE },
  SE: { label: 'SE', name: '시크릿 레어', bg: '#BE123C', fg: WHITE },
  UL: { label: 'UL', name: '얼티밋 레어(레리프)', bg: '#14B8A6', fg: WHITE },
  URP: { label: 'URP', name: '울트라 패러렐', bg: '#9333EA', fg: WHITE },
  SRP: { label: 'SRP', name: '슈퍼 패러렐', bg: '#8B5CF6', fg: WHITE },
  NP: { label: 'NP', name: '노멀 패러렐', bg: '#6366F1', fg: WHITE },
  N: { label: 'N', name: '노멀', bg: '#94A3B8', fg: WHITE },
  // ── 공통 ──
  UR: { label: 'UR', name: '울트라 레어', bg: '#F59E0B', fg: INK },
  SR: { label: 'SR', name: '슈퍼 레어', bg: '#7C3AED', fg: WHITE },
  PROMO: { label: 'PROMO', name: '프로모', bg: '#10B981', fg: WHITE },
  R: { label: 'R', name: '레어', bg: '#3A5BD9', fg: WHITE },
  U: { label: 'U', name: '언커먼', bg: '#22C55E', fg: WHITE },
  C: { label: 'C', name: '커먼', bg: '#94A3B8', fg: WHITE },
} as const satisfies Record<string, RarityMeta>;

export type RarityId = keyof typeof RARITY_META;

/** 사다리 한 칸 — `chip: false` 면 필터 칩에서 뺀다(일반 등급). */
interface LadderStep {
  id: RarityId;
  chip?: boolean;
}

/**
 * 포켓몬(일본판) 등급 — 높은 등급 → 낮은 등급.
 * MUR(메가 울트라)·BWR 은 2026 신규 세트의 최상위, MA 는 마스터볼 미러 패러렐.
 */
const POKEMON_LADDER: LadderStep[] = [
  { id: 'MUR' }, { id: 'BWR' }, { id: 'SAR' }, { id: 'UR' }, { id: 'HR' },
  { id: 'CSR' }, { id: 'CHR' }, { id: 'SSR' }, { id: 'S' }, { id: 'SR' },
  { id: 'AR' }, { id: 'IR' }, { id: 'K' }, { id: 'ACE' }, { id: 'MA' },
  { id: 'PROMO' }, { id: 'RRR' }, { id: 'RR' },
  { id: 'R', chip: false }, { id: 'U', chip: false }, { id: 'C', chip: false },
];

/**
 * 원피스 등급 — 높은 등급 → 낮은 등급.
 * 파라렐(-P)·스페셜(-SP/-SPC/-GSP)은 기준 등급으로 합쳐서 센다 (SR-P → SR).
 */
const ONEPIECE_LADDER: LadderStep[] = [
  { id: 'SEC' }, { id: 'TR' }, { id: 'L' }, { id: 'SR' }, { id: 'PROMO' }, { id: 'P' },
  { id: 'R', chip: false }, { id: 'UC', chip: false }, { id: 'C', chip: false },
];

/**
 * 유희왕(OCG) 등급 — 높은 등급 → 낮은 등급.
 * 패러렐(NP/SRP/URP/SEP)은 별도 등급으로 취급한다 — 실제 시세가 기준 등급과 다르다.
 */
const YUGIOH_LADDER: LadderStep[] = [
  { id: 'GMR' }, { id: 'CR' }, { id: 'QCSE' }, { id: 'PSE' }, { id: 'SEP' },
  { id: 'SE' }, { id: 'UL' }, { id: 'URP' }, { id: 'UR' }, { id: 'SRP' },
  { id: 'SR' }, { id: 'PROMO' }, { id: 'NP' },
  { id: 'R', chip: false }, { id: 'N', chip: false },
];

/** 스포츠 카드는 등급 표기가 없다 — 필터 칩도 없음. */
const SPORTS_LADDER: LadderStep[] = [];

/** 게임별 등급 사다리 (높은 등급 → 낮은 등급). */
export const RARITY_LADDER_BY_GAME: Record<RarityGame, LadderStep[]> = {
  pokemon: POKEMON_LADDER,
  onepiece: ONEPIECE_LADDER,
  yugioh: YUGIOH_LADDER,
  sports: SPORTS_LADDER,
};

/** 게임별 필터 칩 노출 등급 — 높은 등급 → 낮은 등급. */
export const FILTER_RARITIES_BY_GAME: Record<RarityGame, RarityId[]> = {
  pokemon: POKEMON_LADDER.filter((s) => s.chip !== false).map((s) => s.id),
  onepiece: ONEPIECE_LADDER.filter((s) => s.chip !== false).map((s) => s.id),
  yugioh: YUGIOH_LADDER.filter((s) => s.chip !== false).map((s) => s.id),
  sports: [],
};

const RANK_BY_GAME: Record<RarityGame, Record<string, number>> = {
  pokemon: rankOf(POKEMON_LADDER),
  onepiece: rankOf(ONEPIECE_LADDER),
  yugioh: rankOf(YUGIOH_LADDER),
  sports: {},
};

function rankOf(ladder: LadderStep[]): Record<string, number> {
  const out: Record<string, number> = {};
  ladder.forEach((step, i) => { out[step.id] = i; });
  return out;
}

export function isRarityId(value: string | null | undefined): value is RarityId {
  return !!value && Object.prototype.hasOwnProperty.call(RARITY_META, value);
}

/** 등급 메타 조회 — 표에 없는 토큰이면 라벨만 채운 회색 기본값. */
export function rarityMetaOf(id: string): RarityMeta {
  if (isRarityId(id)) return RARITY_META[id];
  return { label: id, name: '기타', bg: '#94A3B8', fg: WHITE };
}

/** 해당 게임에서 필터 칩으로 노출하는 등급인지. */
export function isFilterRarity(game: RarityGame, id: string): id is RarityId {
  return FILTER_RARITIES_BY_GAME[game].includes(id as RarityId);
}

/** 등급 정렬 — 그 게임 사다리 기준 높은 등급 먼저. 사다리 밖 토큰은 뒤로. */
export function sortRarityIds<T extends string>(game: RarityGame, ids: T[]): T[] {
  const rank = RANK_BY_GAME[game];
  const size = RARITY_LADDER_BY_GAME[game].length;
  const at = (id: string): number => rank[id] ?? size;
  return [...ids].sort((a, b) => at(a) - at(b) || a.localeCompare(b));
}

/* ------------------------------------------------------------------ *
 * 상품명 → 등급 토큰 추출
 * ------------------------------------------------------------------ */

/** 등급 토큰 후보 — 'SAR' 'UR' 'R-SP' 'SR+' 처럼 대문자/숫자와 -,+ 조합만. */
const RARITY_TOKEN_RE = /^[A-Z][A-Z0-9]{0,4}(?:[-+][A-Z0-9]{1,4})*$/;

/** 마스터볼 미러(포켓몬 SV) — 기준 등급 대신 MA 로 잡는다. */
const MASTER_BALL_RE = /master\s*ball|マスターボール|마스터볼|마스타보루/i;

/**
 * 파생 접미사 중 그 자체가 별도 등급인 것 — 기준 등급 대신 이 값을 쓴다.
 * 원피스 'R-TR' = 트레저 레어(기준 R 보다 훨씬 상위). 'SR-P'(파라렐)·'SR-SP'
 * (스페셜 카드) 같은 단순 파생은 기준 등급으로 합친다.
 */
const SUFFIX_RARITIES = new Set(['TR']);

/** 등급이 아니라 카드 종류·색상·파생 표기라 토큰으로 오인하면 안 되는 것들. */
const NON_RARITY_TOKENS = new Set([
  'EX', 'GX', 'V', 'VMAX', 'VSTAR', 'BREAK', 'LV', 'X', 'PSA', 'BGS', 'DX',
  'RED', 'BLUE', 'GREEN', 'BLACK', 'WHITE', 'SA', 'SP',
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
 * 파생 표기는 기준 등급으로 합친다 ('SR-SPC' → 'SR', 'R-P' → 'R').
 */
export function extractRarityToken(
  ...names: Array<string | null | undefined>
): string | null {
  for (const raw of names) {
    if (!raw) continue;
    if (MASTER_BALL_RE.test(raw)) return 'MA';
    const parts = stripNameDecorations(raw).split(' ').filter(Boolean);
    // 뒤에서부터 — 'Roronoa Zoro SR Parallel' 처럼 꼬리말이 붙어도 등급을 찾는다.
    // 첫 토큰(index 0)은 카드 이름 자체라 후보에서 제외.
    for (let i = parts.length - 1; i >= 1; i -= 1) {
      const tok = parts[i];
      if (!RARITY_TOKEN_RE.test(tok)) continue;
      const [base, ...suffixes] = tok.split(/[-+]/);
      if (!base || NON_RARITY_TOKENS.has(base)) continue;
      const special = suffixes.find((sfx) => SUFFIX_RARITIES.has(sfx));
      return special ?? base;
    }
  }
  return null;
}

/** 그 게임에서 필터 칩으로 쓰는 고등급만 — 일반 등급·등급 없음은 null. */
export function filterRarityOf(
  game: RarityGame,
  ...names: Array<string | null | undefined>
): RarityId | null {
  const token = extractRarityToken(...names);
  return token && isFilterRarity(game, token) ? token : null;
}

/**
 * 팩의 게임 판정 — 카탈로그(shared/data/cardPacks) 우선, 없으면 카드명에서 추론.
 * 서버 카탈로그가 번들보다 앞서 새 팩을 내보내는 경우를 위한 폴백이다.
 */
export function resolveRarityGame(
  packCode: string | null | undefined,
  sampleNames: Array<string | null | undefined> = [],
): RarityGame {
  const fromCatalog = packCode ? getCardPack(packCode)?.game : undefined;
  if (fromCatalog) return fromCatalog;

  const votes: Record<string, number> = {};
  for (const name of sampleNames.slice(0, 30)) {
    if (!name) continue;
    const { game } = parseCardStatics(name);
    if (game === 'other') continue;
    votes[game] = (votes[game] ?? 0) + 1;
  }
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (best && (best[0] === 'onepiece' || best[0] === 'yugioh')) return best[0];
  return 'pokemon';
}
