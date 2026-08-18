/**
 * 꾸미기 샵 카탈로그 — 웹 [[src/lib/avatars.ts]] / [[src/lib/shop.ts]] 와 1:1.
 * 모바일이 백엔드 메타데이터를 별도 호출하지 않고 같은 ID/가격으로 구매 요청을 보낸다.
 */

export type AvatarId =
  | 'bulbasaur' | 'charmander' | 'squirtle' | 'butterfree' | 'pidgeotto'
  | 'rattata' | 'pikachu' | 'diglett' | 'voltorb' | 'mr-mime' | 'jynx'
  | 'gyarados' | 'lapras' | 'ditto' | 'eevee' | 'porygon' | 'snorlax'
  | 'articuno' | 'zapdos' | 'moltres' | 'mewtwo' | 'mew';

export type UnlockMode = 'free' | 'level' | 'shop';

export interface AvatarMeta {
  id: AvatarId;
  dex: number;
  name: string;
  mode: UnlockMode;
  level?: number;
  price?: number;
  tag?: 'legend' | 'hot' | 'new';
  /** 모바일 픽셀 표시용 이모지 — 웹 프로필 아바타 컴포넌트와 동일한 표시 방식. */
  glyph: string;
}

export const AVATARS: AvatarMeta[] = [
  { id: 'bulbasaur',  dex: 1,   name: '새싹이',   mode: 'free', glyph: '🌱' },
  { id: 'charmander', dex: 4,   name: '불꽃이',     mode: 'free', glyph: '🔥' },
  { id: 'squirtle',   dex: 7,   name: '물방울이',     mode: 'free', glyph: '💧' },
  { id: 'rattata',    dex: 19,  name: '들쥐',       mode: 'level', level: 2, glyph: '🐭' },
  { id: 'pikachu',    dex: 25,  name: '번개꼬리',     mode: 'level', level: 3, tag: 'hot', glyph: '⚡' },
  { id: 'diglett',    dex: 50,  name: '두더지',     mode: 'level', level: 5, glyph: '🟫' },
  { id: 'butterfree', dex: 12,  name: '나비',     mode: 'shop', price: 300, glyph: '🦋' },
  { id: 'pidgeotto',  dex: 17,  name: '매',       mode: 'shop', price: 300, glyph: '🦅' },
  { id: 'voltorb',    dex: 100, name: '레드볼',   mode: 'shop', price: 400, glyph: '🔴' },
  { id: 'ditto',      dex: 132, name: '젤리',     mode: 'shop', price: 500, glyph: '🟪' },
  { id: 'eevee',      dex: 133, name: '여우',     mode: 'shop', price: 500, tag: 'hot', glyph: '🦊' },
  { id: 'mr-mime',    dex: 122, name: '광대',     mode: 'shop', price: 800, glyph: '🤡' },
  { id: 'jynx',       dex: 124, name: '디바',     mode: 'shop', price: 900, glyph: '💋' },
  { id: 'porygon',    dex: 137, name: '프리즘',     mode: 'shop', price: 1000, tag: 'new', glyph: '🔷' },
  { id: 'snorlax',    dex: 143, name: '곰돌이',     mode: 'shop', price: 1200, glyph: '🐻' },
  { id: 'lapras',     dex: 131, name: '해룡',   mode: 'shop', price: 1500, glyph: '🦕' },
  { id: 'gyarados',   dex: 130, name: '드래곤',   mode: 'shop', price: 2200, tag: 'legend', glyph: '🐉' },
  { id: 'articuno',   dex: 144, name: '서리새',     mode: 'shop', price: 3000, tag: 'legend', glyph: '❄️' },
  { id: 'zapdos',     dex: 145, name: '천둥새',       mode: 'shop', price: 3000, tag: 'legend', glyph: '⚡' },
  { id: 'moltres',    dex: 146, name: '불새',     mode: 'shop', price: 3000, tag: 'legend', glyph: '🔥' },
  { id: 'mewtwo',     dex: 150, name: '유전자',       mode: 'shop', price: 5000, tag: 'legend', glyph: '🧬' },
  { id: 'mew',        dex: 151, name: '별빛',         mode: 'shop', price: 5000, tag: 'legend', glyph: '✨' },
];

export type BackgroundId =
  | 'default' | 'grass' | 'sea' | 'mountain' | 'forest' | 'sunset'
  | 'city' | 'space' | 'volcano' | 'cave';

export interface BackgroundMeta {
  id: BackgroundId;
  name: string;
  price: number;
  preview: string;
  tag?: 'hot' | 'new' | 'legend';
}

export const BACKGROUNDS: BackgroundMeta[] = [
  { id: 'default',  name: '기본',      price: 0,    preview: '⚪' },
  { id: 'grass',    name: '풀밭',      price: 150,  preview: '🌿' },
  { id: 'sea',      name: '바다',      price: 200,  preview: '🌊' },
  { id: 'mountain', name: '산',        price: 250,  preview: '🏔', tag: 'hot' },
  { id: 'forest',   name: '숲',        price: 300,  preview: '🌲' },
  { id: 'sunset',   name: '노을',      price: 400,  preview: '🌅' },
  { id: 'city',     name: '도시 야경',  price: 500,  preview: '🌃', tag: 'new' },
  { id: 'cave',     name: '동굴',      price: 500,  preview: '🕳' },
  { id: 'volcano',  name: '화산',      price: 800,  preview: '🌋' },
  { id: 'space',    name: '우주',      price: 1200, preview: '🌌', tag: 'legend' },
];

export type FrameId = 'none' | 'simple' | 'gold' | 'ice' | 'fire' | 'leaf' | 'rainbow';

export interface FrameMeta {
  id: FrameId;
  name: string;
  price: number;
  preview: string;
  tag?: 'hot' | 'new' | 'legend';
}

export const FRAMES: FrameMeta[] = [
  { id: 'none',    name: '없음',          price: 0,    preview: '—' },
  { id: 'simple',  name: '픽셀 테두리',    price: 100,  preview: '◼' },
  { id: 'gold',    name: '황금 테두리',    price: 500,  preview: '🥇', tag: 'hot' },
  { id: 'leaf',    name: '나뭇잎 테두리',  price: 400,  preview: '🌿' },
  { id: 'ice',     name: '얼음 테두리',    price: 700,  preview: '❄' },
  { id: 'fire',    name: '불꽃 테두리',    price: 800,  preview: '🔥' },
  { id: 'rainbow', name: '무지개 테두리',  price: 1500, preview: '🌈', tag: 'legend' },
];
