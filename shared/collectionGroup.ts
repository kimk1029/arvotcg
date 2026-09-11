/**
 * 컬렉션 중복 카드 그룹화 — 같은 상품(스니덩크 apparelId)·같은 등급으로 등록된
 * 여러 장을 한 줄로 묶는다. 등록(매입)가는 장마다 다르므로 각 장은 items 로 남겨
 * 펼쳐서 개별 가격을 보여준다.
 *
 * 웹 CollectionScreen ↔ 앱 my/cards.tsx 공통 정본 — 두 화면이 같은 규칙으로 묶는다.
 * 정렬이 끝난 배열을 넣으면 첫 등장 순서를 유지하고, 대표(head)는 정렬상 첫 카드.
 */

export interface GroupableCard {
  id: number;
  /** 사용자가 직접 묶은 묶음 id — 있으면 상품·등급과 무관하게 같은 묶음끼리 한 줄. */
  bundleId?: string | null;
  snkrdunkApparelId?: number | null;
  cardId?: string | null;
  graded?: boolean | null;
  gradeCompany?: string | null;
  gradeValue?: string | null;
}

export interface GroupableRow<C extends GroupableCard> {
  c: C;
  /** 등록 시 입력한 수량. */
  qty: number;
  /** 평가액(현재가 × 수량). */
  value: number;
  /** 기준가(구매가 ?? 등록가) × 1장. 그룹 손익률 계산용. */
  basisJpy: number | null;
}

export interface CardGroup<R> {
  key: string;
  /** 대표 행 — 이름·이미지·현재가는 그룹 내 모두 같다. */
  head: R;
  /** 등록된 각 장 (등록가·손익이 서로 다름). */
  items: R[];
  /** 총 보유 장수 (수량 합). */
  qty: number;
  /** 그룹 평가액 합. */
  value: number;
  /** 그룹 손익률(%) — Σ(현재가×수량) vs Σ(기준가×수량). 기준가 있는 장만. */
  profitPct: number | null;
  /** Σ(기준가×수량) — 기준가 있는 장만. */
  investedJpy: number;
  /** 평가액 − 매입액(기준가 있는 장만). 기준가가 하나도 없으면 null. */
  profitAbsJpy: number | null;
}

/** 같은 카드·같은 등급이면 같은 키. 사용자 묶음(bundleId)이 있으면 그 키가 우선. 상품 식별자가 없으면 자기 자신(묶이지 않음). */
export function duplicateGroupKey(c: GroupableCard): string {
  if (c.bundleId) return `b${c.bundleId}`;
  const id =
    c.snkrdunkApparelId != null ? `a${c.snkrdunkApparelId}` : c.cardId ? `c${c.cardId}` : `u${c.id}`;
  const grade = c.graded ? `${(c.gradeCompany ?? 'PSA').toUpperCase()} ${c.gradeValue ?? ''}`.trim() : 'RAW';
  return `${id}|${grade}`;
}

export function groupDuplicates<C extends GroupableCard, R extends GroupableRow<C>>(
  rows: R[],
): Array<CardGroup<R>> {
  const byKey = new Map<string, CardGroup<R>>();
  const out: Array<CardGroup<R>> = [];
  for (const r of rows) {
    const key = duplicateGroupKey(r.c);
    const g = byKey.get(key);
    if (g) {
      g.items.push(r);
      g.qty += r.qty;
      g.value += r.value;
      continue;
    }
    const next: CardGroup<R> = {
      key, head: r, items: [r], qty: r.qty, value: r.value,
      profitPct: null, investedJpy: 0, profitAbsJpy: null,
    };
    byKey.set(key, next);
    out.push(next);
  }
  for (const g of out) {
    let invested = 0;
    let current = 0;
    for (const r of g.items) {
      if (r.basisJpy && r.basisJpy > 0) {
        invested += r.basisJpy * r.qty;
        current += r.value;
      }
    }
    g.investedJpy = invested;
    g.profitAbsJpy = invested > 0 ? current - invested : null;
    g.profitPct = invested > 0 ? ((current - invested) / invested) * 100 : null;
  }
  return out;
}

/* ── 테마순 섹션 — 게임별 소제목으로 나눈다 (웹 CollectionScreen ↔ 앱 my/cards.tsx 공통) ── */

export type GameSectionKey = 'pokemon' | 'onepiece' | 'yugioh' | 'other';
export const GAME_SECTION_ORDER: GameSectionKey[] = ['pokemon', 'onepiece', 'yugioh', 'other'];
export const GAME_SECTION_LABEL: Record<GameSectionKey, string> = { pokemon: '포켓몬', onepiece: '원피스', yugioh: '유희왕', other: '기타' };

export interface GameSection<G> {
  game: GameSectionKey;
  label: string;
  groups: G[];
}

/** 정렬된 그룹 배열을 게임별 섹션으로 — 비어 있는 게임은 생략, 순서는 포켓몬→원피스→유희왕→기타. */
export function sectionsByGame<G>(groups: readonly G[], gameOf: (g: G) => string | null | undefined): GameSection<G>[] {
  const buckets = new Map<GameSectionKey, G[]>();
  for (const g of groups) {
    const raw = gameOf(g);
    const key: GameSectionKey = raw === 'pokemon' || raw === 'onepiece' || raw === 'yugioh' ? raw : 'other';
    const arr = buckets.get(key) ?? [];
    arr.push(g);
    buckets.set(key, arr);
  }
  return GAME_SECTION_ORDER.filter((k) => buckets.has(k)).map((k) => ({ game: k, label: GAME_SECTION_LABEL[k], groups: buckets.get(k)! }));
}
