/**
 * 스토어 스크린샷 모드 — App Store 가이드라인 4.1(a) Copycats 대응.
 *
 * 스토어 메타데이터(스크린샷 포함)에는 제3자 IP(브랜드·작품명·캐릭터명·카드 아트)가
 * 하나도 노출되면 안 된다. 이 모듈은 `EXPO_PUBLIC_SHOT_MODE=1` 로 빌드했을 때만
 * 활성화되어, 화면에 그려지는 카드 아트를 자체 제작 플레이스홀더로, 카드·팩 이름과
 * 세트코드를 가상 데이터로 치환한다. 시세·차트·레이아웃은 실제 그대로 유지된다.
 *
 * 플래그가 없으면 모든 함수가 항등(identity)이라 프로덕션 빌드에는 영향이 없다.
 * (EAS/스토어 제출 빌드에서는 이 변수를 절대 설정하지 말 것.)
 *
 * 촬영: `EXPO_PUBLIC_SHOT_MODE=1 npx expo run:android --variant release`
 */
import type { ImageSourcePropType } from 'react-native';

export const SHOT = process.env.EXPO_PUBLIC_SHOT_MODE === '1';

/* --- 플레이스홀더 아트 (자체 제작, mobile/assets/shot) -------------- */

const CARD_ART: ImageSourcePropType[] = [
  require('../../assets/shot/card-1.png'),
  require('../../assets/shot/card-2.png'),
  require('../../assets/shot/card-3.png'),
  require('../../assets/shot/card-4.png'),
  require('../../assets/shot/card-5.png'),
  require('../../assets/shot/card-6.png'),
];
const BOX_ART: ImageSourcePropType[] = [
  require('../../assets/shot/box-1.png'),
  require('../../assets/shot/box-2.png'),
  require('../../assets/shot/box-3.png'),
  require('../../assets/shot/box-4.png'),
];

/** 같은 원본 문자열은 항상 같은 대체값이 되도록 하는 안정 해시. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/* --- 가상 명칭 풀 --------------------------------------------------- */

// 실존 TCG 의 등급/레어도 약칭(ex·V·VMAX·SAR·AR 등)은 특정 제품군을 가리키므로 쓰지 않는다.
const ADJ = ['Aurora', 'Ember', 'Tidal', 'Verdant', 'Lunar', 'Crimson', 'Solar', 'Frost', 'Storm', 'Prism'];
const NOUN = ['Fox', 'Drake', 'Serpent', 'Sprite', 'Warden', 'Golem', 'Falcon', 'Wyrm', 'Lynx', 'Titan'];
const SUFFIX = ['', '', ' Holo', ' Foil', ' Alt Art', ' Full Art'];
const KO_ADJ = ['오로라', '엠버', '타이달', '버던트', '루나', '크림슨', '솔라', '프로스트', '스톰', '프리즘'];
const KO_NOUN = ['폭스', '드레이크', '서펜트', '스프라이트', '워든', '골렘', '팔콘', '웜', '링스', '타이탄'];
const SET_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** 카드 이름 → 가상 카드명 (원본과 1:1 대응, 화면 간 일관). */
export function shotCardName(s: string | null | undefined): string {
  if (!SHOT || !s) return s ?? '';
  const h = hash(s);
  const num = String((h % 180) + 1).padStart(3, '0');
  return `${ADJ[h % ADJ.length]} ${NOUN[(h >> 5) % NOUN.length]}${SUFFIX[(h >> 9) % SUFFIX.length]} ${num}`;
}

/** 팩·박스·세트 이름 → 가상 확장팩명 (한글 표기). */
export function shotPackName(s: string | null | undefined): string {
  if (!SHOT || !s) return s ?? '';
  const h = hash(s);
  return `${KO_ADJ[h % KO_ADJ.length]} ${KO_NOUN[(h >> 5) % KO_NOUN.length]}`;
}

/** 세트코드(sv11b·m2a 등 실존 제품 코드) → 가상 코드. */
export function shotSetCode(s: string | null | undefined): string {
  if (!SHOT || !s) return s ?? '';
  const h = hash(s);
  return `SET-${SET_LETTERS[h % SET_LETTERS.length]}${(h % 9) + 1}`;
}

/* --- 브랜드 토큰 스크럽 --------------------------------------------- */

// 자유 텍스트(게시글 제목·설명문 등)에 섞여 있는 제3자 명칭 제거용.
const BRAND: Array<[RegExp, string]> = [
  [/포켓몬\s*카드\s*게임|포켓몬스터|포켓몬카드|포켓몬\s*카드|포켓몬/g, 'TCG A'],
  [/ポケモンカードゲーム|ポケモンカード|ポケモン/g, 'TCG A'],
  [/pok[eé]mon/gi, 'TCG A'],
  [/원피스|ワンピース/g, 'TCG B'],
  [/one\s?piece/gi, 'TCG B'],
  [/유희왕|遊戯王/g, 'TCG C'],
  [/yu-?gi-?oh!?/gi, 'TCG C'],
  // 대표 캐릭터명 — 자유 텍스트에 자주 등장.
  [/리자몽|リザードン|charizard/gi, 'Ember Drake'],
  [/피카츄|ピカチュウ|pikachu/gi, 'Aurora Fox'],
  [/뮤츠|ミュウツー|mewtwo/gi, 'Lunar Warden'],
  [/이브이|イーブイ|eevee/gi, 'Verdant Sprite'],
  [/루피|ルフィ|luffy/gi, 'Storm Falcon'],
  [/잉어킹|갸라도스|로켓단|블래키|샤로다/g, 'Prism Lynx'],
  // 그레이딩·중개 서비스 상표도 메타데이터에서는 노출하지 않는다.
  [/\bPSA\s?(\d{1,2})\b/g, 'GRADE $1'],
  [/\bPSA\b/g, 'GRADE'],
  [/스니커덩크|スニーカーダンク|snkrdunk/gi, 'Market J'],
  [/크림|KREAM/gi, 'Market K'],
  [/번개장터|번장|bunjang/gi, 'Market B'],
];

/** 자유 텍스트에서 제3자 명칭만 치환. SHOT 아니면 원문 그대로. */
export function shotText(s: string): string;
export function shotText(s: string | null | undefined): string | null | undefined;
export function shotText(s: string | null | undefined): string | null | undefined {
  if (!SHOT || !s) return s;
  let out = s;
  for (const [re, to] of BRAND) out = out.replace(re, to);
  return out;
}

/* --- 이미지 ---------------------------------------------------------- */

/**
 * 원격 카드/박스 이미지를 자체 플레이스홀더로 교체.
 * SHOT 아니면 `{ uri }` 를 그대로 돌려주므로 콜사이트를 그냥 감싸면 된다.
 */
export function shotSource(
  uri: string | null | undefined,
  kind: 'card' | 'box' = 'card',
): ImageSourcePropType {
  if (!SHOT) return { uri: uri as string };
  const pool = kind === 'box' ? BOX_ART : CARD_ART;
  return pool[hash(uri || 'x') % pool.length];
}

/** 스캔/업로드 사진처럼 URI 가 없을 수도 있는 슬롯용 — null 이면 null 유지. */
export function shotSourceOrNull(
  uri: string | null | undefined,
  kind: 'card' | 'box' = 'card',
): ImageSourcePropType | null {
  if (!uri) return null;
  return shotSource(uri, kind);
}

/* --- API 응답 살균 ---------------------------------------------------- */

const NAME_KEYS = new Set([
  'name', 'shortName', 'nameKo', 'nameJa', 'nameEn', 'cardName', 'snkrdunkName',
  'nickname', 'apparelName', 'productName', 'localizedName', 'displayName',
]);
const PACK_NAME_KEYS = new Set([
  'boxName', 'boxKoName', 'setName', 'set', 'series', 'seriesName', 'packName', 'groupName',
]);
// 주의: `code`/`searchQuery` 는 후속 API 호출의 식별자로 쓰이므로 응답에서 바꾸지 않는다.
// (팩 상세·히트카드 조회가 깨진다.) 화면에 보이는 세트코드 라벨만 shotSetCode 로 감싼다.
const CODE_KEYS = new Set(['setCode', 'ocrSetCode']);

/**
 * 서버 응답 JSON 을 재귀 순회하며 이름·코드·자유 텍스트를 가상 데이터로 치환.
 * 숫자(시세·등락률·수량)와 구조는 손대지 않는다 — 스크린샷의 설득력은 유지.
 */
export function shotSanitize<T>(v: T): T {
  if (!SHOT) return v;
  return walk(v, '') as T;
}

function walk(v: unknown, key: string): unknown {
  if (typeof v === 'string') {
    // 식별자 필드는 치환 금지 — 'pokemon'/'onepiece' 같은 key 값이 브랜드 치환에 걸려
    // 'TCG A' 로 바뀌면 클라이언트 필터(설정 게임 매칭)가 전부 탈락한다(시장 지표 미표시).
    if (key === 'key' || key === 'game') return v;
    if (NAME_KEYS.has(key)) return shotCardName(v);
    if (PACK_NAME_KEYS.has(key)) return shotPackName(v);
    if (CODE_KEYS.has(key)) return shotSetCode(v);
    // URL 은 렌더 단계에서 플레이스홀더로 바뀌므로 문자열은 그대로 둔다.
    if (/^https?:\/\//.test(v) || v.startsWith('/api/')) return v;
    return shotText(v);
  }
  if (Array.isArray(v)) return v.map((x) => walk(x, key));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val, k);
    return out;
  }
  return v;
}
