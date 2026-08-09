import { DEFAULT_JPY_KRW } from '@/lib/currency';

export type Rarity = 'C' | 'U' | 'R' | 'SR' | 'HR' | 'S';
export type Game = '포켓몬' | '유희왕' | '원피스' | 'MTG' | '스포츠' | '기타';

export type PriceCurrency = 'KRW' | 'JPY';
export type PriceMode = 'single' | 'psa10';

export interface CardItem {
  id: number;
  name: string;
  set: string;
  num: string;
  game: Game;
  rar: Rarity;
  grade: number | null;
  /** Backwards-compat displayed price. Mirrors `priceSingle` for snkrdunk-
   *  matched cards so legacy views keep working. */
  price: number;
  /** Median of recent un-graded transactions on snkrdunk (raw card price). */
  priceSingle?: number;
  /** Median of recent PSA-10 transactions on snkrdunk. */
  pricePsa10?: number;
  /** Currency of `price` / `priceSingle` / `pricePsa10`. Default 'KRW' for
   *  legacy entries. Snkrdunk-matched cards are JPY. */
  priceCurrency?: PriceCurrency;
  trend: number[];
  emoji: string;
  owned: boolean;
  /** Card art URL — TCGdex high-res when available, else the user's own
   *  scan capture. Optional so existing seed cards still work emoji-only. */
  imageUrl?: string;
  /** When set, the card was matched against snkrdunk during scan — used to
   *  fetch live price + sales history on the detail screen. */
  snkrdunkApparelId?: number;
  /** 관심 카드 플래그. true 면 포트폴리오 합계에서 제외하고 /my/favorites 에 표시. */
  favorite?: boolean;
  /** 구매 단가. 사용자가 등록 시 입력한 한 장당 매입가. */
  buyPrice?: number;
  /** `buyPrice` 통화. 기본 'KRW'. */
  buyCurrency?: PriceCurrency;
  /** 보유 수량. 기본 1. */
  qty?: number;
  /** 구매 시기 (YYYY-MM). 표시용 자유 문자열. */
  buyDate?: string;
  /** 직접뽑기 여부 — true 면 구매가 없이 등록 시점 현재시세를 기준가로 사용. */
  selfPulled?: boolean;
  /** 등급(그레이딩) 카드 여부. */
  graded?: boolean;
  /** 등급사 — 'PSA' | 'BGS' | 'CGC' | 'SGC' 등. */
  gradeCompany?: string;
  /** 사용자가 입력한 실제 등급 값 — "10", "9.5" 등. */
  gradeValue?: string;
  /** 스캔 센터링 자동 추정 등급 라벨 (예: "PSA 9 (Mint)") — 웹 RegisterCardInput 동일. */
  gradeEstimate?: string;
  /** 센터링 점수(가까운 변 %, 50 = 완벽 중앙). */
  centeringScore?: number;
  /** 일본어 원문 이름 — 검색결과 상세표시용 (웹 RegisterCardInput.nameJa 동일). */
  nameJa?: string;
  /** 레어도 토큰 (SAR/SR 등) — 이름 파싱(parseCardStatics) 결과. `rar` 와 별개. */
  rarityToken?: string;
}

export interface MarketItem {
  id: number;
  cardId: number;
  type: 'sell' | 'buy' | 'trade';
  price: number | null;
  condition: string;
  seller: string;
  time: string;
}

export interface PostItem {
  id: number;
  user: string;
  avatar: string;
  time: string;
  text: string;
  hasCard: boolean;
  card: CardItem | null;
  likes: number;
  comments: number;
  type: 'showcase' | 'grade-req' | 'chat';
}

export const CARDS: CardItem[] = [
  { id: 1, name: '리자몽 EX', set: '스칼렛&바이올렛 ex', num: '006/165', game: '포켓몬', rar: 'SR', grade: 9, price: 128000, trend: [80, 90, 100, 110, 115, 120, 128], emoji: '🔥', owned: true },
  { id: 2, name: '피카츄 VMAX', set: '비비드볼트', num: '044/185', game: '포켓몬', rar: 'HR', grade: null, price: 85000, trend: [60, 65, 70, 75, 80, 82, 85], emoji: '⚡', owned: true },
  { id: 3, name: '블랙 로터스 재판', set: '언리미티드', num: '-', game: 'MTG', rar: 'S', grade: 8, price: 450000, trend: [400, 410, 420, 435, 440, 448, 450], emoji: '🌹', owned: true },
  { id: 4, name: '우루스 (오리엔트)', set: '옵션:오리엔트', num: 'SP24', game: '원피스', rar: 'SR', grade: null, price: 32000, trend: [25, 26, 28, 30, 31, 31, 32], emoji: '🌊', owned: true },
  { id: 5, name: '카이바 슈라이', set: '레거시 오브 더 발률', num: 'LOB-003', game: '유희왕', rar: 'R', grade: 10, price: 220000, trend: [180, 190, 200, 205, 210, 215, 220], emoji: '🐉', owned: true },
  { id: 6, name: '손오공 UR', set: '도천통행 제2탄', num: 'OP04-001', game: '원피스', rar: 'HR', grade: null, price: 18000, trend: [12, 13, 15, 16, 17, 17, 18], emoji: '🥊', owned: false },
  { id: 7, name: '류세이드래곤', set: '더 로스트 밀레니엄', num: 'TLM-KR040', game: '유희왕', rar: 'SR', grade: null, price: 41000, trend: [35, 36, 38, 39, 40, 40, 41], emoji: '💫', owned: true },
  { id: 8, name: '사이클론 (LOB)', set: '레거시 오브 더 발률', num: 'LOB-048', game: '유희왕', rar: 'SR', grade: 9, price: 76000, trend: [60, 62, 65, 70, 73, 75, 76], emoji: '🌪', owned: true },
];

export const MARKET: MarketItem[] = [
  { id: 101, cardId: 1, type: 'sell', price: 128000, condition: 'PSA 9', seller: 'CardMaster_KR', time: '10분 전' },
  { id: 102, cardId: 2, type: 'sell', price: 82000, condition: 'NM', seller: '피카매니아', time: '25분 전' },
  { id: 103, cardId: 5, type: 'buy', price: 200000, condition: 'PSA 9+', seller: '용사컬렉터', time: '1시간 전' },
  { id: 104, cardId: 3, type: 'sell', price: 445000, condition: 'PSA 8', seller: 'BlackLotus', time: '3시간 전' },
  { id: 105, cardId: 4, type: 'trade', price: null, condition: 'NM', seller: '원피스매니아', time: '5시간 전' },
  { id: 106, cardId: 7, type: 'sell', price: 39000, condition: 'LP', seller: '결투사', time: '1일 전' },
];

export const POSTS: PostItem[] = [
  { id: 201, user: 'CardMaster_KR', avatar: '🐉', time: '방금 전', text: '드디어 리자몽 EX PSA 9 받았다!! 3개월 기다린 보람이 있네', hasCard: true, card: CARDS[0], likes: 24, comments: 8, type: 'showcase' },
  { id: 202, user: '피카매니아', avatar: '⚡', time: '15분 전', text: '이 피카츄 VMAX 상태 어떻게 보시나요? 제출 전에 감정 부탁드립니다', hasCard: true, card: CARDS[1], likes: 12, comments: 15, type: 'grade-req' },
  { id: 203, user: 'BlackLotus', avatar: '🌹', time: '2시간 전', text: 'MTG 블랙로터스 수집하시는 분들 연락 주세요! 같이 정보 공유해요', hasCard: false, card: null, likes: 7, comments: 3, type: 'chat' },
  { id: 204, user: '용사컬렉터', avatar: '🌟', time: '5시간 전', text: 'PSA 10 카이바 슈라이! 전 세계 팝 6개 중 1개 입니다', hasCard: true, card: CARDS[4], likes: 56, comments: 22, type: 'showcase' },
];

export const GAMES = ['전체', '포켓몬', '유희왕', '원피스', 'MTG', '스포츠', '기타'] as const;
export const RARS: Rarity[] = ['C', 'U', 'R', 'SR', 'HR', 'S'];

export const gameColors: Record<Game, string> = {
  포켓몬: '#E63946',
  유희왕: '#7C3AED',
  원피스: '#F97316',
  MTG: '#22C55E',
  스포츠: '#3A5BD9',
  기타: '#94A3B8',
};

export const rarityBg: Record<Rarity, string> = {
  C: '#475569',
  U: '#22C55E',
  R: '#3A5BD9',
  SR: '#7C3AED',
  HR: '#EC4899',
  S: '#FFD23F',
};

export const rarityFg: Record<Rarity, string> = {
  C: '#FFFFFF',
  U: '#0F172A',
  R: '#FFFFFF',
  SR: '#FFFFFF',
  HR: '#FFFFFF',
  S: '#0F172A',
};

export function fmt(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  return n.toLocaleString();
}

/** Display-formatted price. Cards that couldn't be priced (TCGdex miss +
 *  no local DB row) end up with price=0 — show that as "시세 미확인" rather
 *  than "₩0" / "¥0" which reads as "free" / dummy data.
 *
 *  Snkrdunk-matched cards persist JPY values; legacy cards remain KRW. The
 *  optional currency arg respects that so we don't render "₩3,000" for a
 *  card that's actually ¥3,000. */
export function priceLabel(price: number, currency: PriceCurrency = 'KRW'): string {
  if (!price || price <= 0) return '시세 미확인';
  if (currency === 'JPY') return `¥${price.toLocaleString('ja-JP')}`;
  return `₩${fmt(price)}`;
}

/** Strip snkrdunk-style suffixes ("[M-P 020](プロモカードパック…)") and other
 *  bracketed/parenthetical noise so the card title shows only the actual
 *  name. Also drops the trailing single-letter PROMO tag ("ピカチュウ P"
 *  → "ピカチュウ") while leaving multi-letter rarity words like SR/SAR/ex
 *  alone. Safe to run on any string — returns the original when nothing
 *  to strip. */
export function displayCardName(name: string | null | undefined): string {
  if (!name) return '';
  let head = String(name).split(/[\[(（【]/)[0].trim();
  // Strip a trailing single uppercase letter ("P" PROMO tag etc) preceded
  // by whitespace. Multi-letter tags (SR/SAR/AR/EX) are left intact.
  head = head.replace(/\s+[A-Z]$/, '').trim();
  return head || String(name).trim();
}

/** Infer the price currency for legacy cards saved before `priceCurrency`
 *  existed. Falls back to KRW only when there's no snkrdunk signal at all. */
export function inferCardCurrency(card: CardItem): PriceCurrency {
  if (card.priceCurrency) return card.priceCurrency;
  if (card.snkrdunkApparelId) return 'JPY';
  if (card.imageUrl && /snkrdunk\.com/i.test(card.imageUrl)) return 'JPY';
  // Names like "ピカチュウ P [M-P 020]" / "(プロモカードパック…)" are JP-sourced.
  if (typeof card.name === 'string' && /\[[A-Za-z]+-P\b|プロモ|プロモカード/i.test(card.name)) {
    return 'JPY';
  }
  return 'KRW';
}

/** JPY → KRW 환율 폴백. 라이브 환율(useCurrency().rate)을 못 받을 때만 사용.
 *  앱 전역 표시 환산(currency.ts)과 동일한 9.5 상수로 통일. */
export const JPY_TO_KRW = DEFAULT_JPY_KRW;

/** Convert any price+currency pair to KRW for aggregation. KRW values are
 *  passed through unchanged. `rate` = 1 JPY = rate KRW (라이브 환율, 기본 폴백). */
export function toKrw(price: number, currency: PriceCurrency = 'KRW', rate: number = JPY_TO_KRW): number {
  if (!price || price <= 0) return 0;
  if (currency === 'JPY') return Math.round(price * (rate > 0 ? rate : JPY_TO_KRW));
  return price;
}

/** Pick the displayed price for a card under the given mode. Legacy cards
 *  without per-mode prices fall back to `card.price`. PSA10 with no data
 *  shows the single price (we don't have a graded sample to show). */
export function cardPrice(card: CardItem, mode: PriceMode = 'single'): number {
  if (mode === 'psa10') {
    if (typeof card.pricePsa10 === 'number' && card.pricePsa10 > 0) return card.pricePsa10;
  }
  if (typeof card.priceSingle === 'number' && card.priceSingle > 0) return card.priceSingle;
  return card.price ?? 0;
}

/** Card-aware wrapper — uses inferred currency for legacy entries. */
export function cardKrw(card: CardItem, mode: PriceMode = 'single', rate: number = JPY_TO_KRW): number {
  return toKrw(cardPrice(card, mode), inferCardCurrency(card), rate);
}

/** Convert any price+currency pair to JPY. KRW values are divided back by the
 *  same `rate` used for aggregation. Used to feed the currency-aware
 *  `format()` (which takes JPY) so home metrics respect the 엔/원 setting. */
export function toJpy(price: number, currency: PriceCurrency = 'KRW', rate: number = JPY_TO_KRW): number {
  if (!price || price <= 0) return 0;
  if (currency === 'KRW') return Math.round(price / (rate > 0 ? rate : JPY_TO_KRW));
  return price;
}

/** Card-aware JPY value — feed to CurrencyProvider `format()`. */
export function cardJpy(card: CardItem, mode: PriceMode = 'single', rate: number = JPY_TO_KRW): number {
  return toJpy(cardPrice(card, mode), inferCardCurrency(card), rate);
}

export interface CardProfit {
  /** 보유 수량 (기본 1). */
  qty: number;
  /** 총 매입가 (KRW 환산, 수량 반영). 구매가 미입력이면 0. */
  investedKrw: number;
  /** 현재 시세 합계 (KRW 환산, 수량 반영). */
  currentKrw: number;
  /** 손익 (currentKrw - investedKrw). */
  profitKrw: number;
  /** 수익률 % (구매가 없으면 null). */
  ratePct: number | null;
  /** 구매가가 입력돼 수익률을 계산할 수 있는지. */
  hasBuy: boolean;
}

/** 카드 한 장(또는 수량 묶음)의 수익률. 현재 시세는 가격모드(single/psa10)를
 *  따르며 모두 KRW 로 환산해 비교한다. 구매가가 없으면 hasBuy=false.
 *  `rate` = 라이브 JPY→KRW 환율(기본 폴백). */
export function cardProfit(card: CardItem, mode: PriceMode = 'single', rate: number = JPY_TO_KRW): CardProfit {
  const qty = Math.max(1, card.qty ?? 1);
  const currentKrw = cardKrw(card, mode, rate) * qty;
  const hasBuy = typeof card.buyPrice === 'number' && card.buyPrice > 0;
  const investedKrw = hasBuy ? toKrw(card.buyPrice as number, card.buyCurrency ?? 'KRW', rate) * qty : 0;
  const profitKrw = currentKrw - investedKrw;
  const ratePct = hasBuy && investedKrw > 0 ? (profitKrw / investedKrw) * 100 : null;
  return { qty, investedKrw, currentKrw, profitKrw, ratePct, hasBuy };
}
