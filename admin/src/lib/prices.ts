/**
 * 메인 앱(src/lib/avatars.ts, src/lib/shop.ts) 의 가격 테이블 미러.
 * 어드민에서 사용자가 사용한 포인트를 추정할 때 사용.
 *
 * 메인 앱에서 가격이 바뀌면 여기도 동기화해야 함 — 어드민이 메인 코드를 직접
 * import 하지 않는 구조이므로, 간단히 복제 유지.
 */

export interface PricedItem {
  id: string;
  name: string;
  price: number; // 0 이면 무료(기본 보유) — 사용 내역에서 제외
}

/** 메인 src/lib/avatars.ts AVATARS — shop 모드 항목만(price>0). free/level 은 포인트 사용 X. */
export const AVATAR_PRICES: PricedItem[] = [
  { id: 'butterfree', name: '나비',   price: 300 },
  { id: 'pidgeotto',  name: '매',     price: 300 },
  { id: 'voltorb',    name: '레드볼', price: 400 },
  { id: 'ditto',      name: '젤리',   price: 500 },
  { id: 'eevee',      name: '여우',   price: 500 },
  { id: 'mr-mime',    name: '광대',   price: 800 },
  { id: 'jynx',       name: '디바',   price: 900 },
  { id: 'porygon',    name: '프리즘',   price: 1000 },
  { id: 'snorlax',    name: '곰돌이',   price: 1200 },
  { id: 'lapras',     name: '해룡', price: 1500 },
  { id: 'gyarados',   name: '드래곤', price: 2200 },
  { id: 'articuno',   name: '서리새',   price: 3000 },
  { id: 'zapdos',     name: '천둥새',     price: 3000 },
  { id: 'moltres',    name: '불새',   price: 3000 },
  { id: 'mewtwo',     name: '유전자',     price: 5000 },
  { id: 'mew',        name: '별빛',       price: 5000 },
];

/** 메인 src/lib/shop.ts BACKGROUNDS — price>0 항목만. */
export const BACKGROUND_PRICES: PricedItem[] = [
  { id: 'grass',    name: '풀밭',      price: 150 },
  { id: 'sea',      name: '바다',      price: 200 },
  { id: 'mountain', name: '산',        price: 250 },
  { id: 'forest',   name: '숲',        price: 300 },
  { id: 'sunset',   name: '노을',      price: 400 },
  { id: 'city',     name: '도시 야경', price: 500 },
  { id: 'cave',     name: '동굴',      price: 500 },
  { id: 'volcano',  name: '화산',      price: 800 },
  { id: 'space',    name: '우주',      price: 1200 },
];

/** 메인 src/lib/shop.ts FRAMES — price>0 항목만. */
export const FRAME_PRICES: PricedItem[] = [
  { id: 'simple',  name: '픽셀 테두리',  price: 100 },
  { id: 'leaf',    name: '나뭇잎 테두리', price: 400 },
  { id: 'gold',    name: '황금 테두리',  price: 500 },
  { id: 'ice',     name: '얼음 테두리',  price: 700 },
  { id: 'fire',    name: '불꽃 테두리',  price: 800 },
  { id: 'rainbow', name: '무지개 테두리', price: 1500 },
];

const AVATAR_BY = new Map(AVATAR_PRICES.map((x) => [x.id, x]));
const BG_BY = new Map(BACKGROUND_PRICES.map((x) => [x.id, x]));
const FRAME_BY = new Map(FRAME_PRICES.map((x) => [x.id, x]));

export function lookupAvatar(id: string): PricedItem | undefined {
  return AVATAR_BY.get(id);
}
export function lookupBackground(id: string): PricedItem | undefined {
  return BG_BY.get(id);
}
export function lookupFrame(id: string): PricedItem | undefined {
  return FRAME_BY.get(id);
}
