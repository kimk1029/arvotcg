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
