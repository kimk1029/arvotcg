/**
 * 카드샵 지역 탭 — 웹·앱 공통 정본.
 *
 * card_shops 엔 지역 컬럼이 없으므로(어드민 ShopManager 가 이름·주소·좌표만 관리)
 * 주소/이름 키워드 → 없으면 지역 중심 좌표에서 3km 이내 로 지역을 약식 판정한다.
 * 지역 탭을 바꾸면 그 지역 샵만 목록·지도에 보이고, 지도는 REGION_FOCUS 로 이동한다.
 */
export const SHOP_REGIONS = ['전체', '성수', '홍대', '강남', '왕십리'] as const;
export type ShopRegion = (typeof SHOP_REGIONS)[number];
export type ShopArea = Exclude<ShopRegion, '전체'>;

export interface RegionFocus {
  lat: number;
  lng: number;
  zoom: number;
}

/** 지역 중심(역 기준) — 샵이 없어도 지도는 여기로 이동한다. */
export const REGION_FOCUS: Record<ShopArea, RegionFocus> = {
  성수: { lat: 37.5445, lng: 127.056, zoom: 14 },
  홍대: { lat: 37.5563, lng: 126.9236, zoom: 14 },
  강남: { lat: 37.4979, lng: 127.0276, zoom: 14 },
  왕십리: { lat: 37.5613, lng: 127.0378, zoom: 14 },
};

// 순서 중요 — '성동구 왕십리로' 처럼 두 지역 키워드가 겹치면 앞선 항목이 이긴다.
const REGION_KEYWORDS: Array<[ShopArea, RegExp]> = [
  ['왕십리', /왕십리|행당|마장동|사근동|도선동|상왕십리|한양대/],
  ['성수', /성수|뚝섬|성동구|서울숲|연무장|성수동/],
  ['홍대', /홍대|홍익|마포구|서교동|연남|합정|상수동|망원|와우산/],
  ['강남', /강남|서초|역삼|논현|신사동|압구정|삼성동|선릉|청담|교대|테헤란/],
];

const NEARBY_KM = 3;

export interface RegionableShop {
  name: string;
  addr: string;
  lat?: number | null;
  lng?: number | null;
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

/** 샵의 지역 — 키워드 우선, 없으면 가장 가까운 지역 중심(3km 이내). 못 정하면 null. */
export function shopRegionOf(shop: RegionableShop): ShopArea | null {
  const hay = `${shop.name} ${shop.addr}`;
  for (const [region, re] of REGION_KEYWORDS) if (re.test(hay)) return region;
  if (shop.lat != null && shop.lng != null) {
    let best: ShopArea | null = null;
    let bestKm = NEARBY_KM;
    for (const key of Object.keys(REGION_FOCUS) as ShopArea[]) {
      const km = distanceKm({ lat: shop.lat, lng: shop.lng }, REGION_FOCUS[key]);
      if (km < bestKm) { bestKm = km; best = key; }
    }
    return best;
  }
  return null;
}

/** 지역 탭 필터 — '전체'(또는 모르는 값)면 전부. */
export function filterShopsByRegion<T extends RegionableShop>(list: readonly T[], region: string): T[] {
  if (region === '전체' || !(SHOP_REGIONS as readonly string[]).includes(region)) return [...list];
  return list.filter((s) => shopRegionOf(s) === region);
}

/** 지역 탭의 지도 포커스 — '전체' 면 null(핀 전체 프레이밍). */
export function regionFocusOf(region: string): RegionFocus | null {
  return region in REGION_FOCUS ? REGION_FOCUS[region as ShopArea] : null;
}
