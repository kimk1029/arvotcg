export type AvatarId =
  | 'bulbasaur' | 'charmander' | 'squirtle' | 'butterfree' | 'pidgeotto'
  | 'rattata' | 'pikachu' | 'diglett' | 'voltorb' | 'mr-mime' | 'jynx'
  | 'gyarados' | 'lapras' | 'ditto' | 'eevee' | 'porygon' | 'snorlax'
  | 'articuno' | 'zapdos' | 'moltres' | 'mewtwo' | 'mew';

export type UnlockMode = 'free' | 'level' | 'shop';

export interface AvatarMeta {
  id: AvatarId;
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
  { id: 'bulbasaur',  name: '새싹이', mode: 'free', glyph: '🌱' },
  { id: 'charmander', name: '불꽃이',   mode: 'free', glyph: '🔥' },
  { id: 'squirtle',   name: '물방울이',   mode: 'free', glyph: '💧' },
  // 레벨 달성 (3)
  { id: 'rattata',    name: '들쥐',     mode: 'level', level: 2, glyph: '🐭' },
  { id: 'pikachu',    name: '번개꼬리',   mode: 'level', level: 3, tag: 'hot', glyph: '⚡' },
  { id: 'diglett',    name: '두더지',   mode: 'level', level: 5, glyph: '🟫' },
  // 포인트 상점 — 저가 (5)
  { id: 'butterfree', name: '나비',   mode: 'shop', price: 300, glyph: '🦋' },
  { id: 'pidgeotto',  name: '매',     mode: 'shop', price: 300, glyph: '🦅' },
  { id: 'voltorb',    name: '레드볼', mode: 'shop', price: 400, glyph: '🔴' },
  { id: 'ditto',      name: '젤리',   mode: 'shop', price: 500, glyph: '🟪' },
  { id: 'eevee',      name: '여우',   mode: 'shop', price: 500, tag: 'hot', glyph: '🦊' },
  // 중가 (5)
  { id: 'mr-mime',    name: '광대',   mode: 'shop', price: 800, glyph: '🤡' },
  { id: 'jynx',       name: '디바',   mode: 'shop', price: 900, glyph: '💋' },
  { id: 'porygon',    name: '프리즘',   mode: 'shop', price: 1000, tag: 'new', glyph: '🔷' },
  { id: 'snorlax',    name: '곰돌이',   mode: 'shop', price: 1200, glyph: '🐻' },
  { id: 'lapras',     name: '해룡', mode: 'shop', price: 1500, glyph: '🦕' },
  // 전설 (6)
  { id: 'gyarados',   name: '드래곤', mode: 'shop', price: 2200, tag: 'legend', glyph: '🐉' },
  { id: 'articuno',   name: '서리새',   mode: 'shop', price: 3000, tag: 'legend', glyph: '❄️' },
  { id: 'zapdos',     name: '천둥새',     mode: 'shop', price: 3000, tag: 'legend', glyph: '⚡' },
  { id: 'moltres',    name: '불새',   mode: 'shop', price: 3000, tag: 'legend', glyph: '🔥' },
  { id: 'mewtwo',     name: '유전자',     mode: 'shop', price: 5000, tag: 'legend', glyph: '🧬' },
  { id: 'mew',        name: '별빛',       mode: 'shop', price: 5000, tag: 'legend', glyph: '✨' },
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
