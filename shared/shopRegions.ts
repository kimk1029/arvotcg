/**
 * 카드샵 지역 선택 — 웹·앱 공통 정본.
 *
 * card_shops 엔 지역 컬럼이 없다(어드민은 이름·주소·좌표만 관리). 그래서 지역은
 * 주소 문자열에서 그때그때 파싱한다 — 좌표표를 따로 들고 있으면 어드민이 새 지역에
 * 샵을 넣을 때마다 코드를 고쳐야 하기 때문. 선택지(시/도 → 구/군)도 실제 등록된
 * 샵에서 만들어 내므로 샵이 없는 지역은 목록에 나오지 않는다.
 *
 * 기본 선택은 '내 주변'(= 전체, 어드민 정렬순). 그 칩을 누르면 시/도 → 구/군을
 * 골라 좁힐 수 있다. 지도 중심은 선택 결과 샵들의 좌표 평균으로 잡는다.
 */

/** 기본(전체) 선택의 표시 라벨. */
export const NEARBY_LABEL = '내 주변';

export interface RegionFocus {
  lat: number;
  lng: number;
  zoom: number;
}

export interface RegionableShop {
  name: string;
  addr: string;
  lat?: number | null;
  lng?: number | null;
}

/** 지역 선택 상태 — 둘 다 null 이면 '내 주변'(전체). */
export interface RegionSelection {
  /** '서울' | '경기' | … */
  sido: string | null;
  /** '성동구' | '성남시' | … (sido 가 있을 때만 의미) */
  gu: string | null;
}

export const ALL_REGIONS: RegionSelection = { sido: null, gu: null };

/* ── 주소 파싱 ────────────────────────────────────────────────── */

// 긴 표기(서울특별시)와 짧은 표기(서울)를 한 키로 모은다. 순서 무관 — 접두 매칭.
const SIDO_RULES: Array<[string, RegExp]> = [
  ['서울', /^서울(특별시|시)?/],
  ['부산', /^부산(광역시|시)?/],
  ['대구', /^대구(광역시|시)?/],
  ['인천', /^인천(광역시|시)?/],
  ['광주', /^광주(광역시|시)?/],
  ['대전', /^대전(광역시|시)?/],
  ['울산', /^울산(광역시|시)?/],
  ['세종', /^세종(특별자치시|시)?/],
  ['경기', /^경기(도)?/],
  ['강원', /^강원(특별자치도|도)?/],
  ['충북', /^(충청북도|충북)/],
  ['충남', /^(충청남도|충남)/],
  ['전북', /^(전북특별자치도|전라북도|전북)/],
  ['전남', /^(전라남도|전남)/],
  ['경북', /^(경상북도|경북)/],
  ['경남', /^(경상남도|경남)/],
  ['제주', /^제주(특별자치도|도)?/],
];

/** 시/도 표시 순서 — 목록이 매번 같은 순서로 보이도록 고정. */
export const SIDO_ORDER: string[] = SIDO_RULES.map(([name]) => name);

/** 특별시·광역시 — 이 아래는 바로 구/군이다(도(道)는 시/군이 먼저). */
const METRO_SIDO = new Set(['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종']);

export interface ParsedAddr {
  /** '서울' | '경기' | … 못 찾으면 null. */
  sido: string | null;
  /** '성동구' | '성남시' | '양양군' … 못 찾으면 null. */
  gu: string | null;
}

/**
 * 도로명/지번 주소에서 시/도와 구·군·시를 뽑는다.
 * '서울 성동구 연무장길 21' → { sido: '서울', gu: '성동구' }
 * '경기도 성남시 분당구 …'  → { sido: '경기', gu: '성남시' }  (첫 시/구/군 토큰)
 */
export function parseKrAddr(addr: string | null | undefined): ParsedAddr {
  const raw = (addr ?? '').trim();
  if (!raw) return { sido: null, gu: null };
  let sido: string | null = null;
  let rest = raw;
  for (const [name, re] of SIDO_RULES) {
    const m = re.exec(raw);
    if (m) {
      sido = name;
      rest = raw.slice(m[0].length);
      break;
    }
  }
  // 시/도를 못 읽었으면 구/군만 있어도 지역을 만들 수 없다(어느 시의 중구인지 모름).
  if (!sido) return { sido: null, gu: null };
  // 특별·광역시는 그 아래가 바로 구/군. 도(道)는 시/군이 한 단계 위라 그쪽을 먼저 —
  // '경기 성남시 분당구'는 '분당구'보다 '성남시'가 지역 라벨로 자연스럽다.
  const guFirst = /(\S+?[구군])(?:\s|$)/.exec(rest)?.[1] ?? null;
  const siFirst = /(\S+?시)(?:\s|$)/.exec(rest)?.[1] ?? null;
  const gu = METRO_SIDO.has(sido) ? guFirst ?? siFirst : siFirst ?? guFirst;
  return { sido, gu };
}

/* ── 선택지 트리 (실제 등록된 샵에서 생성) ─────────────────────── */

export interface RegionGuNode {
  name: string;
  count: number;
}
export interface RegionSidoNode {
  name: string;
  count: number;
  gus: RegionGuNode[];
}

/** 등록된 샵 주소에서 시/도 → 구/군 선택지를 만든다. 샵이 없는 지역은 나오지 않는다. */
export function buildRegionTree(shops: readonly RegionableShop[]): RegionSidoNode[] {
  const bySido = new Map<string, Map<string, number>>();
  for (const s of shops) {
    const { sido, gu } = parseKrAddr(s.addr);
    if (!sido) continue;
    const gus = bySido.get(sido) ?? new Map<string, number>();
    if (gu) gus.set(gu, (gus.get(gu) ?? 0) + 1);
    // 구를 못 읽은 샵도 시/도 카운트에는 들어가야 한다 — 빈 키로 따로 센다.
    gus.set('', (gus.get('') ?? 0) + (gu ? 0 : 1));
    bySido.set(sido, gus);
  }
  const nodes: RegionSidoNode[] = [];
  for (const [sido, gus] of bySido) {
    const list: RegionGuNode[] = [];
    let count = 0;
    for (const [name, n] of gus) {
      count += n;
      if (name) list.push({ name, count: n });
    }
    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
    nodes.push({ name: sido, count, gus: list });
  }
  nodes.sort((a, b) => {
    const ia = SIDO_ORDER.indexOf(a.name);
    const ib = SIDO_ORDER.indexOf(b.name);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return nodes;
}

/* ── 필터 / 라벨 / 지도 포커스 ─────────────────────────────────── */

/** 선택된 지역의 샵만. '내 주변'(sido null)이면 전부 그대로. */
export function filterShopsByRegion<T extends RegionableShop>(
  list: readonly T[],
  sel: RegionSelection,
): T[] {
  if (!sel.sido) return [...list];
  return list.filter((s) => {
    const p = parseKrAddr(s.addr);
    if (p.sido !== sel.sido) return false;
    return sel.gu ? p.gu === sel.gu : true;
  });
}

/** 지역 칩에 쓸 라벨 — '내 주변' | '서울 전체' | '서울 성동구'. */
export function regionLabel(sel: RegionSelection): string {
  if (!sel.sido) return NEARBY_LABEL;
  return sel.gu ? `${sel.sido} ${sel.gu}` : `${sel.sido} 전체`;
}

/** 선택이 '내 주변'인지. */
export function isAllRegions(sel: RegionSelection): boolean {
  return !sel.sido;
}

/**
 * 지도 중심 — 선택된 샵들의 좌표 평균. 좌표가 있는 샵이 없으면 null
 * (호출부는 핀 전체 프레이밍/기본 중심으로 폴백).
 * 줌은 선택 깊이에 맞춘다: 구 단위 15 · 시/도 단위 12.
 */
export function regionFocusOf(sel: RegionSelection, shops: readonly RegionableShop[]): RegionFocus | null {
  if (!sel.sido) return null;
  const pts = filterShopsByRegion(shops, sel)
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({ lat: s.lat as number, lng: s.lng as number }));
  if (pts.length === 0) return null;
  const lat = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
  const lng = pts.reduce((a, p) => a + p.lng, 0) / pts.length;
  return { lat, lng, zoom: sel.gu ? 15 : 12 };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ── 카드샵 국가 탭 ────────────────────────────────────────────── */

export const SHOP_COUNTRIES = [
  { id: 'kr', label: '한국 카드샵' },
  { id: 'jp', label: '일본 카드샵' },
] as const;
export type ShopCountry = (typeof SHOP_COUNTRIES)[number]['id'];

/**
 * 카드샵 화면 '준비중' 커튼 — 한국·일본 둘 다 아직 오픈 전이라 화면을 딤 처리하고
 * 앞에 안내를 덮는다. 오픈할 때 이 값만 false 로 내리면 커튼이 사라진다.
 */
export const SHOP_COMING_SOON: Record<ShopCountry, boolean> = { kr: true, jp: true };
export const SHOP_COMING_SOON_TEXT = '준비중';
export const SHOP_COMING_SOON_SUB = '카드샵 정보를 모으는 중이에요. 곧 만나요!';
