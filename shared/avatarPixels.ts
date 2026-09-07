/**
 * 프로필 아바타 픽셀 아트 — 정본(웹·앱 공통).
 *
 * 22종 오리지널 캐릭터를 16×16 문자 그리드로 정의한다. 각 캐릭터는 자기 "원소"
 * (풀·불·물·전기·땅·벌레·비행·얼음·천둥·우주 등)의 특징을 실루엣과 색으로 표현한다.
 * 제3자 IP 이미지·디자인은 사용하지 않는다 (2026-07 도트 스프라이트 제거 이후 대체).
 *
 * 렌더링: {@link spriteRects} 가 가로 런렝스로 병합한 rect 목록을 돌려주므로
 * 웹은 <svg><rect/></svg>, 앱은 react-native-svg <Rect/> 로 그린다. 두 플랫폼 모두
 * viewBox 0 0 16 16, crispEdges.
 *
 * 프로필 배경 신({@link BACKGROUND_SCENES})과 테두리 링({@link FRAME_RINGS})도 여기가 정본.
 */

export const SPRITE_SIZE = 16;

/** 전역 팔레트 — 스프라이트 문자 → 색. '.' 은 투명. */
export const SPRITE_PALETTE: Record<string, string> = {
  k: '#1A1A2E', // 외곽선
  w: '#FFFFFF', // 흰색 / 눈 하이라이트
  i: '#FFF3A0', // 연노랑 하이라이트
  p: '#FF9AA2', // 볼터치
  q: '#EA9EC4', // 핑크
  G: '#7FCE92', // 풀 연두
  g: '#4FA077', // 풀 진초록
  s: '#2E5A1B', // 줄기
  O: '#FB923C', // 주황
  Y: '#FFD23F', // 노랑
  R: '#E63946', // 빨강
  r: '#B01E2B', // 진빨강
  B: '#6FC0E5', // 하늘
  b: '#3A8FC2', // 파랑
  P: '#B48CE0', // 연보라
  u: '#6B3FA0', // 보라
  T: '#C9D4E0', // 연회색
  N: '#A67C52', // 갈색
  m: '#6B4A2B', // 진갈색
  c: '#7FDBD4', // 시안
  d: '#3A2040', // 아주 진한 자주
  M: '#F5C6A5', // 살구
};

export type AvatarSpriteId =
  | 'bulbasaur' | 'charmander' | 'squirtle' | 'butterfree' | 'pidgeotto'
  | 'rattata' | 'pikachu' | 'diglett' | 'voltorb' | 'mr-mime' | 'jynx'
  | 'gyarados' | 'lapras' | 'ditto' | 'eevee' | 'porygon' | 'snorlax'
  | 'articuno' | 'zapdos' | 'moltres' | 'mewtwo' | 'mew';

/**
 * 스프라이트 그리드. 각 항목은 16행, 각 행 16문자.
 * (id 는 DB 저장값이라 유지 — 표시 이름은 avatars 카탈로그가 담당)
 */
export const AVATAR_SPRITES: Record<AvatarSpriteId, readonly string[]> = {
  // 새싹이 — 풀: 머리에 새싹 두 잎
  bulbasaur: [
    '................',
    '....kk....kk....',
    '...kGgk..kGgk...',
    '...kGGgkkgGGk...',
    '....kkksskkk....',
    '......kssk......',
    '....kkkGGkkk....',
    '..kkGGGGGGGGkk..',
    '.kGGGGGGGGGGGGk.',
    '.kGGwkGGGGwkGGk.',
    '.kGGkkGGGGkkGGk.',
    '.kGpGGGGGGGGpGk.',
    '.kGGGGkkkkGGGGk.',
    '..kGGGGGGGGGGk..',
    '...kkGGkkGGkk...',
    '.....kk..kk.....',
  ],
  // 불꽃이 — 불: 머리 전체가 불꽃, 속은 노란 심지
  charmander: [
    '.......k........',
    '......kOk.......',
    '.....kOYOk......',
    '....kOYYYOk.....',
    '....kOYiYOk.....',
    '...kOOYYYOOk....',
    '...kOOOOOOOk....',
    '..kOOOOOOOOOk...',
    '.kOOwkOOOOwkOOk.',
    '.kOOkkOOOOkkOOk.',
    '.kOOOOOOOOOOOOk.',
    '.kOOOOkkkkOOOOk.',
    '.kOOOOOOOOOOOOk.',
    '..kOOOOOOOOOOk..',
    '...kkOOkkOOkk...',
    '.....kk..kk.....',
  ],
  // 물방울이 — 물: 물방울 실루엣, 아래로 갈수록 진한 파랑
  squirtle: [
    '.......k........',
    '......kBk.......',
    '......kBk.......',
    '.....kBBBk......',
    '.....kBBBk......',
    '....kBBBBBk.....',
    '...kBBBBBBBk....',
    '..kBBiBBBBBBk...',
    '.kBBwkBBBBwkBBk.',
    '.kBBkkBBBBkkBBk.',
    '.kBBBBBBBBBBBBk.',
    '.kBBBBkkkkBBBbk.',
    '.kBBBBBBBBBBbbk.',
    '..kBBBBBBBBbbk..',
    '...kkbbbbbbkk...',
    '.....kkkkkk.....',
  ],
  // 들쥐 — 노말: 둥근 귀, 수염, 꼬리
  rattata: [
    '................',
    '..kkk......kkk..',
    '.kTTTk....kTTTk.',
    '.kTqTk....kTqTk.',
    '.kTTTkkkkkkTTTk.',
    '..kTTTTTTTTTTk..',
    '..kTTTTTTTTTTk..',
    '.kTTwkTTTTwkTTk.',
    '.kTTkkTTTTkkTTk.',
    '.kTTTTTTTTTTTTk.',
    '.kTTTTTkqkTTTTk.',
    'kkkTTTTTTTTTTkkk',
    '..kTTTTTTTTTTk..',
    '...kTTTTTTTTk.kk',
    '....kkkkkkkkkkk.',
    '................',
  ],
  // 번개꼬리 — 전기: 머리 번개, 빨간 볼, 번개 모양 꼬리
  pikachu: [
    '........kk......',
    '.......kYk......',
    '......kYYk......',
    '.......kYk......',
    '....kkkkYkkkk...',
    '..kkYYYYYYYYkk..',
    '.kYYYYYYYYYYYYk.',
    '.kYYwkYYYYwkYYk.',
    '.kYYkkYYYYkkYYk.',
    '.kYRYYYYYYYYRYk.',
    '.kYYYYYkkkkYYYk.',
    '.kYYYYYYYYYYYYk.',
    '..kYYYYYYYYYYk.k',
    '...kYYYYYYYYkkYk',
    '....kkkkkkkkkYYk',
    '.............kk.',
  ],
  // 두더지 — 땅: 흙더미에서 고개 내민 두더지
  diglett: [
    '................',
    '................',
    '.....kkkkkk.....',
    '....kNNNNNNk....',
    '...kNNNNNNNNk...',
    '...kNwkNNNNwkNk.',
    '...kNkkNNNNkkNk.',
    '...kNNNNqqNNNNk.',
    '...kNNNNNNNNNNk.',
    '...kNNNNNNNNNNk.',
    '...kNNNNNNNNNNk.',
    '.kkkNNNNNNNNNNkk',
    'kmmmmmmmmmmmmmmk',
    'kmmNmmmNmmmmNmmk',
    '.kmmmmmmmmmmmmk.',
    '..kkkkkkkkkkkk..',
  ],
  // 나비 — 벌레: 좌우 대칭 날개, 더듬이
  butterfree: [
    '.....k....k.....',
    '..kkk.k..k.kkk..',
    '.kPPPkkwwkkPPPk.',
    'kPuPPPkddkPPPuPk',
    'kPPPPPkddkPPPPPk',
    'kPPPPPkddkPPPPPk',
    '.kPPPPkddkPPPPk.',
    '..kkkkkddkkkkk..',
    '.kPPPPkddkPPPPk.',
    'kPPuPPkddkPPuPPk',
    'kPPPPPkddkPPPPPk',
    '.kPPPPkddkPPPPk.',
    '..kPPPkddkPPPk..',
    '...kkkkddkkkk...',
    '.......kk.......',
    '................',
  ],
  // 매 — 비행: 펼친 날개, 노란 부리, 밝은 배
  pidgeotto: [
    '................',
    '......kkkk......',
    '.....kNNNNk.....',
    '.....kwkkwk.....',
    '.....kNNNNk.....',
    '......kYYk......',
    'kk...kNNNNk...kk',
    'kNkk.kNNNNk.kkNk',
    'kNNNkkNNNNkkNNNk',
    '.kNNNNNNNNNNNNk.',
    '..kNNNNNNNNNNk..',
    '...kNNiiiiNNk...',
    '....kNiiiiNk....',
    '.....kkkkkk.....',
    '....kNNkkNNk....',
    '....kkk..kkk....',
  ],
  // 레드볼 — 에너지 구슬: 광택, 노란 에너지 띠
  voltorb: [
    '................',
    '.....kkkkkk.....',
    '...kkRRiRRRkk...',
    '..kRRiiRRRRRRk..',
    '.kRRiRRRRRRRRRk.',
    '.kRRRRRRRRRRRRk.',
    'kRRwkRRRRRRwkRRk',
    'kRRkkRRRRRRkkRRk',
    'kRRRRRRRRRRRRRRk',
    'kRRRRYYYYYYRRRRk',
    'kRRRRRRkkRRRRRRk',
    '.krrrrrrrrrrrrk.',
    '.krrrrrrrrrrrrk.',
    '..krrrrrrrrrrk..',
    '...kkrrrrrrkk...',
    '.....kkkkkk.....',
  ],
  // 젤리 — 보라 젤리: 흘러내리는 밑단
  ditto: [
    '................',
    '................',
    '......kkkk......',
    '....kkPPPPkk....',
    '...kPPPPPPPPk...',
    '..kPPiPPPPPPPk..',
    '.kPPPPPPPPPPPPk.',
    '.kPPkPPPPPPkPPk.',
    '.kPPPPPPPPPPPPk.',
    '.kPPPkPPPPkPPPk.',
    '.kPPPPkkkkPPPPk.',
    '.kPPPPPPPPPPPPk.',
    'kPPPPPPPPPPPPPPk',
    'kPPPPPPPPPPPPPPk',
    '.kkPkkkPkkkPkkk.',
    '...k...k...k....',
  ],
  // 여우 — 뾰족 귀, 밝은 주둥이, 풍성한 꼬리
  eevee: [
    '.k..........k...',
    '.kk........kk...',
    '.kNk......kNk...',
    '.kNNk....kNNk...',
    '.kNNNkkkkNNNk...',
    '.kNNNNNNNNNNk...',
    'kNNNNNNNNNNNNk..',
    'kNNwkNNNNwkNNk..',
    'kNNkkNNNNkkNNk..',
    'kNNNNiiiiNNNNk..',
    '.kNNNikkiNNNk...',
    '.kNNNiiiiNNNk.kk',
    '..kNNNNNNNNk.kNk',
    '...kNNNNNNNkkNNk',
    '....kkNNkkNNNNk.',
    '......kk..kkkk..',
  ],
  // 광대 — 파란 머리, 빨간 코, 나비넥타이
  'mr-mime': [
    '................',
    '..kkk......kkk..',
    '.kbbbkkkkkkbbbk.',
    'kbbbkwwwwwwkbbbk',
    'kbbkwwwwwwwwkbbk',
    '.kkwwkwwwwkwwkk.',
    '..kwwwwwwwwwwk..',
    '..kwwwkRRkwwwk..',
    '..kwwwwRRwwwwk..',
    '..kwkwwwwwwkwk..',
    '..kwwkkkkkkwwk..',
    '...kwwwwwwwwk...',
    '....kkkkkkkk....',
    '...kRRRkkRRRk...',
    '....kkkRRkkk....',
    '................',
  ],
  // 디바 — 보라 단발, 빨간 입술, 마이크
  jynx: [
    '....kkkkkkkk....',
    '..kkuuuuuuuukk..',
    '.kuuuuuuuuuuuuk.',
    'kuuuuuuuuuuuuuuk',
    'kuukkkkkkkkkkuuk',
    'kuukMMMMMMMMkuuk',
    'kuukMwkMMwkMkuuk',
    'kuukMkkMMkkMkuuk',
    'kuukMMMMMMMMkuuk',
    'kuukMMMRRMMMkuuk',
    '.kukMMMMMMMMkuk.',
    '..kkMMMMMMMMkk..',
    '....kkkkkkkk....',
    '.....kPPPPk..kk.',
    '....kPPPPPPk.kTk',
    '....kkkkkkkk..k.',
  ],
  // 프리즘 — 육각 보석: 위 시안, 아래 핑크
  porygon: [
    '......kkkk......',
    '.....kcccck.....',
    '....kcccccck....',
    '...kciccccccck..',
    '..kcccccccccck..',
    '.kcccccccccccck.',
    'kccwkccccccwkcck',
    'kcckkcccccckkcck',
    'kkkkkkkkkkkkkkkk',
    'kqqqqqqqqqqqqqqk',
    '.kqqqqqqqqqqqqk.',
    '..kqqqqqqqqqqk..',
    '...kqqqqqqqqk...',
    '....kqqqqqqk....',
    '.....kqqqqk.....',
    '......kkkk......',
  ],
  // 곰돌이 — 둥근 귀, 밝은 주둥이·배
  snorlax: [
    '................',
    '.kkk........kkk.',
    'kNNNk......kNNNk',
    'kNmNkkkkkkkkNmNk',
    'kNNNNNNNNNNNNNNk',
    '.kNNNNNNNNNNNNk.',
    '.kNNwkNNNNwkNNk.',
    '.kNNkkNNNNkkNNk.',
    '.kNNNNiiiiNNNNk.',
    '.kNNNiikkiiNNNk.',
    '.kNNNiiiiiiNNNk.',
    '..kNNNiiiiNNNk..',
    '...kNNNNNNNNk...',
    '..kNNNiiiiNNNk..',
    '..kNNkiiiikNNk..',
    '...kkkkkkkkkk...',
  ],
  // 해룡 — 긴 목의 바다 용, 파도 위
  lapras: [
    '....kkk.........',
    '...kBBBk........',
    '..kBwkBBk.......',
    '..kBBBBBBk......',
    '...kkkkBBk......',
    '......kBBk......',
    '......kBBk......',
    '.....kBBBk......',
    '...kkkBBBBkkk...',
    '..kBBBBBBBBBBk..',
    '.kBBBBBBBBBBBBk.',
    '.kBBBBBBBBBBBBk.',
    '..kkkkkkkkkkkk..',
    'bBbbbBbbbBbbbBbb',
    'bbBbbbBbbbBbbbBb',
    'bbbbbbbbbbbbbbbb',
  ],
  // 드래곤 — 뿔 둘, 붉은 눈, 송곳니
  gyarados: [
    '.kk..........kk.',
    '.kbk........kbk.',
    '..kbk......kbk..',
    '..kkbkkkkkkbkk..',
    '.kbbbbbbbbbbbbk.',
    'kbbbbbbbbbbbbbbk',
    'kbbRkbbbbbbRkbbk',
    'kbbkkbbbbbbkkbbk',
    'kbbbbbbbbbbbbbbk',
    '.kbbbbbbbbbbbbk.',
    '.kbbkkkkkkkkbbk.',
    '.kbkwddddddwkbk.',
    '..kbkkkkkkkkbk..',
    '...kbbbbbbbbk...',
    '....kkkkkkkk....',
    '................',
  ],
  // 서리새 — 얼음 결정 볏, 흰 배
  articuno: [
    '.....k..k..k....',
    '....kBkkBkkBk...',
    '....kBBBBBBBk...',
    '....kBwkBkwBk...',
    '....kBBBBBBBk...',
    '.....kBBYYBBk...',
    'kk.kBBBBBBBBk.kk',
    'kBkkBBBBBBBBkkBk',
    'kBBBBBBBBBBBBBBk',
    '.kBBBBwwwwBBBBk.',
    '..kBBBwwwwBBBk..',
    '...kBBwwwwBBk...',
    '....kBBBBBBk....',
    '.....kBBBBk.....',
    '....kBBkkBBk....',
    '....kkk..kkk....',
  ],
  // 천둥새 — 번개 볏, 주황 부리
  zapdos: [
    '.......kYYk.....',
    '......kYYk......',
    '....kYYYYYYYk...',
    '....kYwkYkwYk...',
    '....kYYYYYYYk...',
    '.....kYYOOYYk...',
    'kk.kYYYYYYYYk.kk',
    'kYkkYYYYYYYYkkYk',
    'kYYYYYYYYYYYYYYk',
    '.kYYYYiiiiYYYYk.',
    '..kYYYiiiiYYYk..',
    '...kYYiiiiYYk...',
    '....kYYYYYYk....',
    '.....kYYYYk.....',
    '....kYYkkYYk....',
    '....kkk..kkk....',
  ],
  // 불새 — 불꽃 볏, 붉은 날개끝·꼬리
  moltres: [
    '.....k.kk.k.....',
    '....kRkYYkRk....',
    '....kOOOOOOOk...',
    '....kOwkOkwOk...',
    '....kOOOOOOOk...',
    '.....kOOYYOOk...',
    'kk.kOOOOOOOOk.kk',
    'kRkkOOOOOOOOkkRk',
    'kRROOOOOOOOOORRk',
    '.kOOOOYYYYOOOOk.',
    '..kOOOYYYYOOOk..',
    '...kOOYYYYOOk...',
    '....kOOOOOOk....',
    '.....kOOOOk.....',
    '....kRRkkRRk....',
    '....kkk..kkk....',
  ],
  // 유전자 — 캡슐 몸통 속 이중나선
  mewtwo: [
    '................',
    '.....kkkkkk.....',
    '....kPPPPPPk....',
    '...kPPPPPPPPk...',
    '...kPwkPPwkPk...',
    '...kPkkPPkkPk...',
    '...kPPPPPPPPk...',
    '...kPcPPPPqPk...',
    '...kPPckkqPPk...',
    '...kPPPcqPPPk...',
    '...kPPqkkcPPk...',
    '...kPqPPPPcPk...',
    '...kPPqkkcPPk...',
    '...kPPPqcPPPk...',
    '....kPPPPPPk....',
    '.....kkkkkk.....',
  ],
  // 별빛 — 별 모양 몸, 반짝이
  mew: [
    '.......kk.......',
    '......kYYk...i..',
    '......kYYk..i.i.',
    '.....kYYYYk..i..',
    'kkkkkkYYYYkkkkkk',
    'kYYYYYYYYYYYYYYk',
    '.kYYYYYYYYYYYYk.',
    '..kYYwkYYwkYYk..',
    '..kYYkkYYkkYYk..',
    '...kYYYYYYYYk...',
    '...kYYpkkpYYk...',
    '..kYYYYYYYYYYk..',
    '..kYYYYkkYYYYk..',
    '.kYYYYk..kYYYYk.',
    '.kYYYk....kYYYk.',
    '.kkkk......kkkk.',
  ],
};

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

const RECT_CACHE = new Map<string, SpriteRect[]>();

/**
 * 그리드를 가로 런렝스로 병합한 rect 목록으로 변환 (캐시됨).
 * 같은 색이 연속되는 구간을 하나의 rect 로 묶어 SVG 노드 수를 줄인다.
 */
export function spriteRects(id: AvatarSpriteId | string): SpriteRect[] {
  const cached = RECT_CACHE.get(id);
  if (cached) return cached;
  const rows = AVATAR_SPRITES[id as AvatarSpriteId];
  if (!rows) return [];
  const out: SpriteRect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x += 1; continue; }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      const fill = SPRITE_PALETTE[ch];
      if (fill) out.push({ x, y, w: end - x, h: 1, fill });
      x = end;
    }
  });
  RECT_CACHE.set(id, out);
  return out;
}

export function isAvatarSpriteId(v: unknown): v is AvatarSpriteId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(AVATAR_SPRITES, v);
}

/* ------------------------------------------------------------------ */
/* 프로필 배경 신 — viewBox 0 0 32 20, preserveAspectRatio none         */
/* ------------------------------------------------------------------ */

export type BgShape =
  | { t: 'r'; x: number; y: number; w: number; h: number; f: string }
  | { t: 'c'; cx: number; cy: number; r: number; f: string }
  | { t: 'p'; pts: string; f: string };

export const BG_VIEW_W = 32;
export const BG_VIEW_H = 20;

const r = (x: number, y: number, w: number, h: number, f: string): BgShape => ({ t: 'r', x, y, w, h, f });
const c = (cx: number, cy: number, rad: number, f: string): BgShape => ({ t: 'c', cx, cy, r: rad, f });
const p = (pts: string, f: string): BgShape => ({ t: 'p', pts, f });

export const BACKGROUND_SCENES: Record<string, BgShape[]> = {
  default: [
    r(0, 0, 32, 20, '#9BC5E5'),
    c(24, 5, 2, '#FFF3A0'),
    c(7, 4, 2, '#FFFFFF'),
    c(12, 5, 1, '#FFFFFF'),
  ],
  grass: [
    r(0, 0, 32, 12, '#9BC5E5'),
    r(0, 12, 32, 8, '#7FCE92'),
    r(0, 11, 32, 1, '#4FA077'),
    ...[2, 7, 12, 18, 24, 29].map((x) => r(x, 13, 1, 2, '#4FA077')),
    c(6, 5, 2, '#FFFFFF'),
    c(22, 4, 2, '#FFFFFF'),
    c(27, 6, 1, '#FFFFFF'),
  ],
  sea: [
    r(0, 0, 32, 10, '#6FC0E5'),
    r(0, 10, 32, 10, '#3A8FC2'),
    ...[0, 6, 12, 18, 24].map((x) => r(x, 12, 3, 1, '#9BC5E5')),
    ...[3, 9, 15, 21, 27].map((x) => r(x, 15, 3, 1, '#9BC5E5')),
    c(24, 4, 2, '#FFF3A0'),
  ],
  mountain: [
    r(0, 0, 32, 14, '#C9D4E0'),
    r(0, 14, 32, 6, '#7FCE92'),
    p('0,14 8,4 16,14', '#6B7490'),
    p('0,14 8,4 10,6 14,10 16,14', '#8A92A8'),
    p('8,4 9,5 10,4 10,6 8,5', '#FFFFFF'),
    p('12,14 22,2 32,14', '#5C6478'),
    p('22,2 20,4 22,5 24,3', '#FFFFFF'),
    c(6, 4, 1, '#FFFFFF'),
  ],
  forest: [
    r(0, 0, 32, 13, '#7FB980'),
    r(0, 13, 32, 7, '#5A8247'),
    ...[1, 5, 9, 13, 17, 21, 25, 29].flatMap((x) => [
      r(x, 9, 2, 4, '#2E5A1B'),
      p(`${x - 1},10 ${x + 1},6 ${x + 3},10`, '#3E7A2B'),
      p(`${x - 1},8 ${x + 1},4 ${x + 3},8`, '#4E9A3B'),
    ]),
  ],
  sunset: [
    r(0, 0, 32, 20, '#FF8A50'),
    r(0, 0, 32, 4, '#6B3FA0'),
    r(0, 4, 32, 3, '#C46EA0'),
    r(0, 7, 32, 3, '#FDB57D'),
    r(0, 16, 32, 4, '#3A2040'),
    c(16, 12, 4, '#FFD23F'),
    c(16, 12, 3, '#FFA020'),
  ],
  city: [
    r(0, 0, 32, 20, '#1B2E89'),
    c(4, 3, 1, '#FFD23F'),
    c(10, 2, 1, '#FFFFFF'),
    c(20, 4, 1, '#FFFFFF'),
    c(27, 3, 1, '#FFD23F'),
    r(0, 13, 4, 7, '#3A2040'),
    r(4, 10, 5, 10, '#2E1834'),
    r(9, 12, 3, 8, '#3A2040'),
    r(12, 8, 6, 12, '#2E1834'),
    r(18, 11, 4, 9, '#3A2040'),
    r(22, 9, 5, 11, '#2E1834'),
    r(27, 13, 5, 7, '#3A2040'),
    ...([
      [5, 12], [6, 15], [7, 14], [13, 11], [14, 13], [15, 16], [17, 14],
      [19, 14], [23, 12], [24, 15], [25, 13], [28, 15], [29, 17],
    ] as const).map(([x, y]) => r(x, y, 1, 1, '#FFD23F')),
  ],
  space: [
    r(0, 0, 32, 20, '#0D1A5A'),
    ...([
      [2, 3], [5, 8], [9, 2], [13, 6], [17, 10], [20, 3], [24, 7], [28, 4],
      [30, 14], [3, 16], [8, 17], [12, 14], [26, 17], [15, 17],
    ] as const).map(([x, y]) => r(x, y, 1, 1, '#FFFFFF')),
    c(24, 13, 3, '#9BC5E5'),
    c(23, 12, 1, '#6FC0E5'),
    c(25, 14, 1, '#6FC0E5'),
  ],
  volcano: [
    r(0, 0, 32, 12, '#6B1A1A'),
    r(0, 12, 32, 8, '#E63946'),
    p('8,12 16,3 24,12', '#3A0E0E'),
    p('13,6 16,3 19,6 18,5 16,6 14,5', '#FF8A50'),
    p('14,6 15,4 16,6 17,4 18,6', '#FFD23F'),
    r(12, 12, 2, 3, '#FFD23F'),
    r(14, 13, 2, 3, '#FF8A50'),
    r(16, 14, 2, 3, '#FFD23F'),
    r(11, 16, 10, 1, '#FF8A50'),
  ],
  cave: [
    r(0, 0, 32, 20, '#2E1834'),
    ...[2, 7, 14, 20, 26, 30].map((x) => p(`${x},0 ${x + 2},0 ${x + 1},3`, '#1A0E20')),
    r(0, 16, 32, 4, '#3A2040'),
    r(0, 17, 6, 1, '#5C3168'),
    r(8, 18, 5, 1, '#5C3168'),
    r(16, 17, 8, 1, '#5C3168'),
    p('12,16 14,12 16,16', '#6FC0E5'),
    p('12,16 14,12 14,16', '#3A8FC2'),
    p('22,16 24,13 26,16', '#EA9EC4'),
  ],
};

export function backgroundScene(id: string | null | undefined): BgShape[] {
  return (id && BACKGROUND_SCENES[id]) || BACKGROUND_SCENES.default;
}

/* ------------------------------------------------------------------ */
/* 테두리 링 — 바깥→안쪽 순 [색, 두께]. 웹 CSS(.frm-*)와 같은 배색.      */
/* 외곽선은 테마 잉크색이 아니라 고정 진한 색(FRAME_INK) — 다크 테마는     */
/* ink 가 거의 흰색이라 흰 배경 프로필 카드 위에서 테두리가 사라졌음(2026-09-07). */
/* ------------------------------------------------------------------ */

export const FRAME_INK = '#1A1A2E';

export type FrameRing = { color: string; width: number };

export const FRAME_RINGS: Record<string, FrameRing[]> = {
  none: [],
  simple: [{ color: FRAME_INK, width: 2 }],
  gold: [{ color: FRAME_INK, width: 2 }, { color: '#FFD23F', width: 2 }, { color: '#8B6B0B', width: 2 }],
  leaf: [{ color: FRAME_INK, width: 2 }, { color: '#7FCE92', width: 2 }, { color: '#2E5A1B', width: 2 }],
  ice: [{ color: FRAME_INK, width: 2 }, { color: '#9BC5E5', width: 2 }, { color: '#1B4B6B', width: 2 }],
  fire: [{ color: FRAME_INK, width: 2 }, { color: '#FB923C', width: 2 }, { color: '#8F1620', width: 2 }],
  rainbow: [{ color: FRAME_INK, width: 2 }, { color: '#FF6470', width: 4 }, { color: FRAME_INK, width: 2 }],
};

/** 무지개 테두리가 순환하는 색 (웹 keyframes 와 동일 순서). */
export const RAINBOW_CYCLE = ['#FF6470', '#FFD23F', '#4ADE80', '#6FC0E5', '#3A5BD9', '#6B3FA0'];

export function frameRings(id: string | null | undefined): FrameRing[] {
  return (id && FRAME_RINGS[id]) || FRAME_RINGS.none;
}

/** 테두리가 차지하는 총 두께(px) — 컨테이너 바깥쪽에 그려질 때 여백 계산용. */
export function frameThickness(id: string | null | undefined): number {
  return frameRings(id).reduce((s, x) => s + x.width, 0);
}
