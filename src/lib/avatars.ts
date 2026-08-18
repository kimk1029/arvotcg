export type AvatarId =
  | 'bulbasaur'   // 새싹이
  | 'charmander'  // 불꽃이
  | 'squirtle'    // 물방울이
  | 'butterfree'  // 나비
  | 'pidgeotto'   // 매
  | 'rattata'     // 들쥐
  | 'pikachu'     // 번개꼬리
  | 'diglett'     // 두더지
  | 'voltorb'     // 레드볼
  | 'mr-mime'     // 광대
  | 'jynx'        // 디바
  | 'gyarados'    // 드래곤
  | 'lapras'      // 해룡
  | 'ditto'       // 젤리
  | 'eevee'       // 여우
  | 'porygon'     // 프리즘
  | 'snorlax'     // 곰돌이
  | 'articuno'    // 서리새
  | 'zapdos'      // 천둥새
  | 'moltres'     // 불새
  | 'mewtwo'      // 유전자
  | 'mew';        // 뮤        #151

export type UnlockMode = 'free' | 'level' | 'shop';

export interface AvatarMeta {
  id: AvatarId;
  dex: number;
  name: string;
  mode: UnlockMode;
  level?: number;
  price?: number;
  tag?: 'legend' | 'hot' | 'new';
  /** 표시용 이모지 — IP 이미지(도트 스프라이트) 대신 사용. 모바일 shopCatalog 와 1:1. */
  glyph: string;
}

export const AVATARS: AvatarMeta[] = [
  // 무료 (3)
  { id: 'bulbasaur',  dex: 1,   name: '새싹이', mode: 'free', glyph: '🌱' },
  { id: 'charmander', dex: 4,   name: '불꽃이',   mode: 'free', glyph: '🔥' },
  { id: 'squirtle',   dex: 7,   name: '물방울이',   mode: 'free', glyph: '💧' },
  // 레벨 달성 (3)
  { id: 'rattata',    dex: 19,  name: '들쥐',     mode: 'level', level: 2, glyph: '🐭' },
  { id: 'pikachu',    dex: 25,  name: '번개꼬리',   mode: 'level', level: 3, tag: 'hot', glyph: '⚡' },
  { id: 'diglett',    dex: 50,  name: '두더지',   mode: 'level', level: 5, glyph: '🟫' },
  // 포인트 상점 — 저가 (5)
  { id: 'butterfree', dex: 12,  name: '나비',   mode: 'shop', price: 300, glyph: '🦋' },
  { id: 'pidgeotto',  dex: 17,  name: '매',     mode: 'shop', price: 300, glyph: '🦅' },
  { id: 'voltorb',    dex: 100, name: '레드볼', mode: 'shop', price: 400, glyph: '🔴' },
  { id: 'ditto',      dex: 132, name: '젤리',   mode: 'shop', price: 500, glyph: '🟪' },
  { id: 'eevee',      dex: 133, name: '여우',   mode: 'shop', price: 500, tag: 'hot', glyph: '🦊' },
  // 중가 (5)
  { id: 'mr-mime',    dex: 122, name: '광대',   mode: 'shop', price: 800, glyph: '🤡' },
  { id: 'jynx',       dex: 124, name: '디바',   mode: 'shop', price: 900, glyph: '💋' },
  { id: 'porygon',    dex: 137, name: '프리즘',   mode: 'shop', price: 1000, tag: 'new', glyph: '🔷' },
  { id: 'snorlax',    dex: 143, name: '곰돌이',   mode: 'shop', price: 1200, glyph: '🐻' },
  { id: 'lapras',     dex: 131, name: '해룡', mode: 'shop', price: 1500, glyph: '🦕' },
  // 전설 (6)
  { id: 'gyarados',   dex: 130, name: '드래곤', mode: 'shop', price: 2200, tag: 'legend', glyph: '🐉' },
  { id: 'articuno',   dex: 144, name: '서리새',   mode: 'shop', price: 3000, tag: 'legend', glyph: '❄️' },
  { id: 'zapdos',     dex: 145, name: '천둥새',     mode: 'shop', price: 3000, tag: 'legend', glyph: '⚡' },
  { id: 'moltres',    dex: 146, name: '불새',   mode: 'shop', price: 3000, tag: 'legend', glyph: '🔥' },
  { id: 'mewtwo',     dex: 150, name: '유전자',     mode: 'shop', price: 5000, tag: 'legend', glyph: '🧬' },
  { id: 'mew',        dex: 151, name: '별빛',       mode: 'shop', price: 5000, tag: 'legend', glyph: '✨' },
];

export const DEFAULT_AVATAR: AvatarId = 'bulbasaur';

/** 항상 무료 보유인 아바타 */
export const DEFAULT_OWNED: AvatarId[] = AVATARS
  .filter((a) => a.mode === 'free')
  .map((a) => a.id);

const AVATAR_IDS = new Set<string>(AVATARS.map((a) => a.id));
export function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === 'string' && AVATAR_IDS.has(v);
}

export function getAvatarMeta(id: AvatarId): AvatarMeta {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
