export type AvatarId =
  | 'bulbasaur'   // 이상해씨  #1
  | 'charmander'  // 파이리    #4
  | 'squirtle'    // 꼬부기    #7
  | 'butterfree'  // 버터플    #12
  | 'pidgeotto'   // 피존      #17
  | 'rattata'     // 꼬렛      #19
  | 'pikachu'     // 피카츄    #25
  | 'diglett'     // 디그다    #50
  | 'voltorb'     // 찌리리공  #100
  | 'mr-mime'     // 마임맨    #122
  | 'jynx'        // 루주라    #124
  | 'gyarados'    // 갸라도스  #130
  | 'lapras'      // 라프라스  #131
  | 'ditto'       // 메타몽    #132
  | 'eevee'       // 이브이    #133
  | 'porygon'     // 폴리곤    #137
  | 'snorlax'     // 잠만보    #143
  | 'articuno'    // 프리저    #144
  | 'zapdos'      // 썬더      #145
  | 'moltres'     // 파이어    #146
  | 'mewtwo'      // 뮤츠      #150
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
  { id: 'bulbasaur',  dex: 1,   name: '이상해씨', mode: 'free', glyph: '🌱' },
  { id: 'charmander', dex: 4,   name: '파이리',   mode: 'free', glyph: '🔥' },
  { id: 'squirtle',   dex: 7,   name: '꼬부기',   mode: 'free', glyph: '💧' },
  // 레벨 달성 (3)
  { id: 'rattata',    dex: 19,  name: '꼬렛',     mode: 'level', level: 2, glyph: '🐭' },
  { id: 'pikachu',    dex: 25,  name: '피카츄',   mode: 'level', level: 3, tag: 'hot', glyph: '⚡' },
  { id: 'diglett',    dex: 50,  name: '디그다',   mode: 'level', level: 5, glyph: '🟫' },
  // 포인트 상점 — 저가 (5)
  { id: 'butterfree', dex: 12,  name: '버터플',   mode: 'shop', price: 300, glyph: '🦋' },
  { id: 'pidgeotto',  dex: 17,  name: '피존',     mode: 'shop', price: 300, glyph: '🦅' },
  { id: 'voltorb',    dex: 100, name: '찌리리공', mode: 'shop', price: 400, glyph: '🔴' },
  { id: 'ditto',      dex: 132, name: '메타몽',   mode: 'shop', price: 500, glyph: '🟪' },
  { id: 'eevee',      dex: 133, name: '이브이',   mode: 'shop', price: 500, tag: 'hot', glyph: '🦊' },
  // 중가 (5)
  { id: 'mr-mime',    dex: 122, name: '마임맨',   mode: 'shop', price: 800, glyph: '🤡' },
  { id: 'jynx',       dex: 124, name: '루주라',   mode: 'shop', price: 900, glyph: '💋' },
  { id: 'porygon',    dex: 137, name: '폴리곤',   mode: 'shop', price: 1000, tag: 'new', glyph: '🔷' },
  { id: 'snorlax',    dex: 143, name: '잠만보',   mode: 'shop', price: 1200, glyph: '🐻' },
  { id: 'lapras',     dex: 131, name: '라프라스', mode: 'shop', price: 1500, glyph: '🦕' },
  // 전설 (6)
  { id: 'gyarados',   dex: 130, name: '갸라도스', mode: 'shop', price: 2200, tag: 'legend', glyph: '🐉' },
  { id: 'articuno',   dex: 144, name: '프리저',   mode: 'shop', price: 3000, tag: 'legend', glyph: '❄️' },
  { id: 'zapdos',     dex: 145, name: '썬더',     mode: 'shop', price: 3000, tag: 'legend', glyph: '⚡' },
  { id: 'moltres',    dex: 146, name: '파이어',   mode: 'shop', price: 3000, tag: 'legend', glyph: '🔥' },
  { id: 'mewtwo',     dex: 150, name: '뮤츠',     mode: 'shop', price: 5000, tag: 'legend', glyph: '🧬' },
  { id: 'mew',        dex: 151, name: '뮤',       mode: 'shop', price: 5000, tag: 'legend', glyph: '✨' },
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
