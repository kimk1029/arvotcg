/** 오프라인 카드샵 입력 검증 — server/routes/shops.ts(공개 조회)와 짝. */

export const PRICE_LEVELS = ['저렴', '보통', '높음'] as const;

/** 리스트 타일 색 프리셋 — 웹 그라디언트(from/to) + 앱 단색(tile) 한 벌. */
export const COLOR_PRESETS = [
  { key: 'orange', label: '오렌지', gradFrom: '#ffb347', gradTo: '#ff7a1f', tileColor: '#ff9a33' },
  { key: 'blue', label: '블루', gradFrom: '#6fb1e0', gradTo: '#3a6ea5', tileColor: '#5595c8' },
  { key: 'purple', label: '퍼플', gradFrom: '#9d6bd6', gradTo: '#4568dc', tileColor: '#7169d9' },
  { key: 'green', label: '그린', gradFrom: '#11998e', gradTo: '#38ef7d', tileColor: '#25c486' },
  { key: 'red', label: '레드', gradFrom: '#ff8a80', gradTo: '#e0453a', tileColor: '#ef6a5e' },
  { key: 'gold', label: '골드', gradFrom: '#f7d774', gradTo: '#e0a500', tileColor: '#ecbe3a' },
] as const;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export interface ShopInput {
  name?: string;
  official?: boolean;
  addr?: string;
  lat?: number | null;
  lng?: number | null;
  emoji?: string;
  gradFrom?: string;
  gradTo?: string;
  tileColor?: string;
  oripaPct?: number;
  singleText?: string;
  priceLevel?: string;
  rating?: number;
  reviewCount?: number;
  dist?: string;
  phone?: string;
  instagram?: string;
  imageUrl?: string;
  hours?: string;
  closedDays?: string;
  intro?: string;
  tags?: string;
  sortOrder?: number;
  active?: boolean;
}

export function parseShopInput(
  input: Record<string, unknown>,
  partial: boolean,
): { ok: true; data: ShopInput } | { ok: false; error: string } {
  const out: ShopInput = {};

  for (const key of ['name', 'addr'] as const) {
    if (input[key] !== undefined) {
      const v = String(input[key]).trim();
      if (!v) return { ok: false, error: `${key} 은 비울 수 없습니다` };
      if (v.length > 120) return { ok: false, error: `${key} 이 너무 깁니다 (≤120자)` };
      out[key] = v;
    } else if (!partial) return { ok: false, error: `${key} 은 필수입니다` };
  }

  for (const key of ['lat', 'lng'] as const) {
    if (input[key] !== undefined) {
      if (input[key] === null || input[key] === '') out[key] = null;
      else {
        const n = Number(input[key]);
        if (!Number.isFinite(n)) return { ok: false, error: `${key} 이 숫자가 아닙니다` };
        out[key] = n;
      }
    }
  }

  if (input.emoji !== undefined) {
    const v = String(input.emoji).trim();
    if (!v || v.length > 8) return { ok: false, error: '이모지는 1~8자' };
    out.emoji = v;
  }

  for (const key of ['gradFrom', 'gradTo', 'tileColor'] as const) {
    if (input[key] !== undefined) {
      const v = String(input[key]).trim();
      if (!HEX_RE.test(v)) return { ok: false, error: `${key} 은 #rrggbb 형식이어야 합니다` };
      out[key] = v;
    }
  }

  if (input.oripaPct !== undefined) {
    const n = Number(input.oripaPct);
    if (!Number.isInteger(n) || n < 0 || n > 100) return { ok: false, error: '오리파 비중은 0~100 정수' };
    out.oripaPct = n;
  }

  if (input.singleText !== undefined) out.singleText = String(input.singleText).trim().slice(0, 40);
  if (input.dist !== undefined) out.dist = String(input.dist).trim().slice(0, 20);
  // 상세 페이지 정보 — 전부 선택, 길이만 제한
  if (input.phone !== undefined) out.phone = String(input.phone).trim().slice(0, 30);
  if (input.instagram !== undefined) out.instagram = String(input.instagram).trim().slice(0, 120);
  if (input.imageUrl !== undefined) {
    const v = String(input.imageUrl).trim();
    if (v && !/^https?:\/\/\S+$/i.test(v)) return { ok: false, error: 'imageUrl 은 http(s) 로 시작하는 링크여야 합니다' };
    if (v.length > 500) return { ok: false, error: 'imageUrl 이 너무 깁니다 (≤500자)' };
    out.imageUrl = v;
  }
  if (input.hours !== undefined) out.hours = String(input.hours).trim().slice(0, 60);
  if (input.closedDays !== undefined) out.closedDays = String(input.closedDays).trim().slice(0, 40);
  if (input.intro !== undefined) out.intro = String(input.intro).trim().slice(0, 2000);
  if (input.tags !== undefined) out.tags = String(input.tags).trim().slice(0, 200);

  if (input.priceLevel !== undefined) {
    const v = String(input.priceLevel);
    if (!(PRICE_LEVELS as readonly string[]).includes(v)) {
      return { ok: false, error: `가격대는 ${PRICE_LEVELS.join('/')} 중 하나` };
    }
    out.priceLevel = v;
  }

  if (input.rating !== undefined) {
    const n = Number(input.rating);
    if (!Number.isFinite(n) || n < 0 || n > 5) return { ok: false, error: '평점은 0~5' };
    out.rating = Math.round(n * 10) / 10;
  }

  if (input.reviewCount !== undefined) {
    const n = Number(input.reviewCount);
    if (!Number.isInteger(n) || n < 0) return { ok: false, error: '후기 수는 0 이상 정수' };
    out.reviewCount = n;
  }

  if (input.sortOrder !== undefined) {
    const n = Number(input.sortOrder);
    if (!Number.isInteger(n)) return { ok: false, error: 'sortOrder 는 정수' };
    out.sortOrder = n;
  }

  if (input.active !== undefined) out.active = Boolean(input.active);
  if (input.official !== undefined) out.official = Boolean(input.official);

  return { ok: true, data: out };
}

/**
 * 검증 결과 → CardShop 생성 행. 단건 POST 와 일괄 import 가 같이 쓴다.
 * parseShopInput 이 받아준 상세 필드(전화·인스타·영업시간·휴무·소개·태그)까지 전부
 * 담는다 — 한쪽에서 빠지면 "등록은 됐는데 상세가 비어 있는" 샵이 생긴다.
 */
export function shopCreateData(d: ShopInput) {
  return {
    name: d.name!,
    addr: d.addr!,
    official: d.official ?? false,
    lat: d.lat ?? null,
    lng: d.lng ?? null,
    emoji: d.emoji ?? '\u{1F3EA}',
    gradFrom: d.gradFrom ?? '#ffb347',
    gradTo: d.gradTo ?? '#ff7a1f',
    tileColor: d.tileColor ?? '#ff9a33',
    oripaPct: d.oripaPct ?? 0,
    singleText: d.singleText ?? '',
    priceLevel: d.priceLevel ?? '보통',
    rating: d.rating ?? 0,
    reviewCount: d.reviewCount ?? 0,
    dist: d.dist ?? '',
    phone: d.phone ?? '',
    instagram: d.instagram ?? '',
    imageUrl: d.imageUrl ?? '',
    hours: d.hours ?? '',
    closedDays: d.closedDays ?? '',
    intro: d.intro ?? '',
    tags: d.tags ?? '',
    sortOrder: d.sortOrder ?? 50,
    active: d.active ?? true,
  };
}

/* ------------------------------------------------------------------ */
/* JSON 일괄 등록 양식 — 어드민 '기본 양식 다운로드' + 필드 설명           */
/* ------------------------------------------------------------------ */

export interface ShopTemplateField {
  key: keyof ShopInput;
  required?: boolean;
  desc: string;
}

/** 양식 필드 설명 — parseShopInput 의 검증 규칙과 같은 내용을 사람 말로. */
export const SHOP_TEMPLATE_FIELDS: ShopTemplateField[] = [
  { key: 'name', required: true, desc: '샵 이름 (1~120자)' },
  { key: 'addr', required: true, desc: '도로명 주소 (1~120자). 지역 분류(서울 > ○○구)와 지도 핀이 이 주소에서 나옵니다' },
  { key: 'lat', desc: '위도. 비우거나 null 이면 지도가 주소를 지오코딩해 자동으로 찍습니다' },
  { key: 'lng', desc: '경도 (lat 과 같은 규칙)' },
  { key: 'official', desc: '공식 인증 뱃지 (true/false, 기본 false)' },
  { key: 'emoji', desc: '리스트 타일 이모지 (기본 🏪)' },
  { key: 'gradFrom', desc: '웹 타일 그라디언트 시작색 #rrggbb (기본 #ffb347)' },
  { key: 'gradTo', desc: '웹 타일 그라디언트 끝색 #rrggbb (기본 #ff7a1f)' },
  { key: 'tileColor', desc: '앱 타일 단색 #rrggbb (기본 #ff9a33)' },
  { key: 'oripaPct', desc: '오리파 비중 0~100 정수 (기본 0)' },
  { key: 'phone', desc: '전화번호 (상세 페이지 전화 버튼, 비우면 버튼 숨김)' },
  { key: 'imageUrl', desc: '대표 이미지 링크 (http/https). 리스트 타일·상세 페이지 상단에 표시, 비우면 이모지 타일' },
  { key: 'instagram', desc: '인스타그램 — @핸들 / 핸들 / 프로필 URL 아무거나 (상세 페이지 버튼 + 최근 소식 임베드)' },
  { key: 'hours', desc: '영업시간 텍스트 (예: "10:00 - 21:00" — HH:MM 두 개가 있으면 영업 중/종료 표시)' },
  { key: 'closedDays', desc: '휴무 (예: "매주 월요일", "연중무휴")' },
  { key: 'intro', desc: '매장 소개 (≤2000자)' },
  { key: 'tags', desc: '태그, 쉼표 구분 (예: "오리파, 싱글, 매입")' },
  { key: 'singleText', desc: '싱글 종수 표시 텍스트 (예: "1,240종"). 비우면 숨김' },
  { key: 'priceLevel', desc: `가격대 — ${PRICE_LEVELS.join(' / ')} 중 하나 (기본 보통)` },
  { key: 'rating', desc: '평점 0~5 (기본 0)' },
  { key: 'reviewCount', desc: '후기 수, 0 이상 정수 (기본 0)' },
  { key: 'dist', desc: '거리 표시 텍스트 (예: "320m"). 비우면 숨김' },
  { key: 'sortOrder', desc: '정렬 — 작을수록 먼저 (기본 50)' },
  { key: 'active', desc: '웹/앱 노출 여부 (true/false, 기본 true)' },
];

/** 다운로드용 기본 양식 — 필수만 채운 행 + 전부 채운 행 두 개(복붙 기준). */
export const SHOP_TEMPLATE_JSON = JSON.stringify(
  {
    _설명: 'ARVOTCG 카드샵 일괄 등록 양식 — shops 배열만 채워서 어드민 › 카드샵 관리에서 업로드하세요. name·addr 만 필수입니다.',
    shops: [
      { name: '포켓랩 성수점', addr: '서울 성동구 연무장길 21' },
      {
        name: '카드킹덤 홍대',
        addr: '서울 마포구 와우산로 105',
        lat: 37.5535,
        lng: 126.9256,
        official: true,
        imageUrl: 'https://example.com/cardkingdom.jpg',
        emoji: '👑',
        gradFrom: '#6fb1e0',
        gradTo: '#3a6ea5',
        tileColor: '#5595c8',
        oripaPct: 40,
        singleText: '2,860종',
        priceLevel: '보통',
        rating: 4.6,
        reviewCount: 158,
        dist: '1.2km',
        sortOrder: 20,
        active: true,
      },
    ],
  },
  null,
  2,
);
