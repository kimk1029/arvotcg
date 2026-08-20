/**
 * /api/me/* 응답 타입 + 호출 함수.
 *
 * 응답 타입은 웹 [[src/lib/queries.ts]] / [[src/lib/messages.ts]] 의 반환 모양과 1:1.
 * 모바일이 자체 mock 으로 폴백할 수 있도록 [[ApiError]] 를 그대로 던진다.
 */
import { api, ApiError, getApiBaseUrl } from './apiClient';
import { subscribeSession } from './session';
import { SHOT } from './shotMode';
import {
  SHOT_MY_CARDS, SHOT_PORTFOLIO, SHOT_PRICE_ALERTS, SHOT_SUMMARY, SHOT_UNREAD,
} from './shotFixtures';
import { CARD_PACKS } from '@/data/cardPacks';

export type TradeType = 'buy' | 'sell';
export type TradeStatus = 'open' | 'reserved' | 'done' | 'cancelled';
export type OripaTier = 'normal' | 'rare' | 'legend';

export interface MyTrade {
  id: number;
  type: TradeType;
  status?: TradeStatus;
  title: string;
  place: string;
  time: string;
  price: string;
  kakaoId?: string | null;
}

export interface MyFeedPost {
  id: number;
  text: string;
  time: string;
  createdAt: string;
  user: string;
  authorName?: string | null;
  authorBgId?: string;
  authorFrameId?: string;
  images?: string[];
}

export interface MyBookmarks {
  trades: MyTrade[];
  feeds: MyFeedPost[];
}

export interface MyCardRow {
  id: number;
  cardId: string | null;
  ocrSetCode: string | null;
  ocrCardNumber: string | null;
  snkrdunkApparelId: number | null;
  nickname: string | null;
  memo: string | null;
  gradeEstimate: string | null;
  centeringScore: number | null;
  photoUrl: string | null;
  createdAt: string;
  latestPrice?: number;
  trend?: number[];
  snkrdunkName?: string | null;
  snkrdunkImageUrl?: string | null;
  snkrdunkMinPriceJpy?: number;
  /** raw 싱글카드 중앙값 시세. */
  priceSingleJpy?: number;
  /** PSA10 중앙값 시세 (있으면). */
  pricePsa10Jpy?: number;
  /** PSA9/PSA8 중앙값 시세 (있으면). */
  pricePsa9Jpy?: number;
  pricePsa8Jpy?: number;
  /**
   * 등급 기준 현재시세(JPY) — 서버가 등록가와 같은 규칙(PSA10/9/8→등급가,
   * 타사→PSA10, 싱글→raw)으로 산정. 등락률은 registerPriceJpy 와 이 값을 비교.
   */
  currentPriceJpy?: number;
  /** 등록 시점 시세(JPY) 기준값 — "등록가격". 등급카드는 등급 시세로 스냅. */
  registerPriceJpy?: number | null;
  /** 구매 정보 / 등급 정보. */
  buyPrice?: number | null;
  buyCurrency?: string | null;
  qty?: number;
  buyDate?: string | null;
  selfPulled?: boolean;
  graded?: boolean;
  gradeCompany?: string | null;
  gradeValue?: string | null;
  /** 에디션(지역) — 'jp' | 'kr' | 'en' | null. 자산 구성 비중에 사용. */
  region?: string | null;
  /** 카탈로그 시리즈명 — 시리즈별 비중 TOP5 에 사용. */
  series?: string | null;
  /** 카드 게임 종류 ('pokemon'|'onepiece'|'yugioh'|'other') — 테마순 정렬용. */
  game?: string | null;
}

export interface MyFavoriteRow {
  id: number;
  snkrdunkApparelId: number;
  createdAt: string;
  name: string | null;
  imageUrl: string | null;
  minPriceJpy: number;
}

export interface PortfolioSummary {
  totalJpy: number;
  totalPsa10Jpy?: number;
  pricedCount: number;
  pricedPsa10Count?: number;
  totalCount: number;
  yesterdayJpy: number | null;
  changeAbsJpy: number | null;
  changePct: number | null;
  history: Array<{ date: string; totalJpy: number }>;
  asOfDate: string;
}

export interface MessageThread {
  peerId: string;
  peerName: string;
  peerAvatar: string;
  peerBgId: string;
  peerFrameId: string;
  lastText: string;
  lastAt: string;
  lastFromMe: boolean;
  unread: number;
}

export interface OripaBox {
  id: string;
  tier: OripaTier;
  emoji: string;
  name: string;
  desc: string;
  price: number;
  odds: string;
  /** 미리보기용 상품 리스트 (가중치 → % 변환은 UI 측). DB 팩이면 채워짐 — 웹 OripaBox 동일. */
  prizes?: Array<{
    grade: 'S' | 'A' | 'B' | 'C';
    name: string;
    emoji: string;
    weight: number;
    bg?: string;
    imageUrl?: string;
  }>;
  stats?: {
    total: number;
    remaining: number;
    drawn: { S: number; A: number; B: number; C: number };
  };
}

export interface InventorySnapshot {
  avatar: string;
  avatarOwned: string[];
  bg: string;
  bgOwned: string[];
  frame: string;
  frameOwned: string[];
  points: number;
}

/** 웹 src/lib/level.ts LevelInfo 와 동일 — /api/me/summary 응답의 level. */
export interface LevelInfo {
  level: number;
  /** 현재 레벨 구간 내에서 누적된 포인트 (0 ~ xpNeeded) */
  xp: number;
  /** 다음 레벨까지 필요한 포인트 */
  xpNeeded: number;
  title: string;
  maxLevel: number;
}

/** 미읽음 쪽지 수 — 웹 UnreadProvider 와 동일 엔드포인트. */
export function fetchUnreadCount(): Promise<number> {
  if (SHOT) return Promise.resolve(SHOT_UNREAD);
  return api<{ count: number }>('/api/messages/unread')
    .then((r) => (Number.isFinite(r.count) ? r.count : 0))
    .catch(() => 0);
}

/* --- 신고/차단 (App Store 심사 지침 1.2) — 웹과 동일 엔드포인트 --- */

export type ReportTargetType = 'trade' | 'feed' | 'feedComment' | 'eventPost' | 'eventPostComment';

/** 신고 사유 선택지 — 서버 REPORT_REASONS 와 동일 목록. */
export const REPORT_REASONS = [
  '스팸/광고',
  '욕설/비하',
  '사기 의심',
  '음란/부적절한 콘텐츠',
  '개인정보 노출',
  '기타',
] as const;

/** 콘텐츠 신고 — POST /api/reports. 중복 신고는 서버가 사유만 갱신. */
export function reportContent(
  targetType: ReportTargetType,
  targetId: number,
  reason: string,
  detail?: string,
): Promise<{ ok?: boolean; error?: string }> {
  return api<{ ok?: boolean; error?: string }>('/api/reports', {
    method: 'POST',
    body: { targetType, targetId, reason, detail },
  });
}

export interface BlockedUser {
  userId: string;
  name: string;
  avatarId: string | null;
  createdAt: string;
}

/** 내가 차단한 사용자 목록 — GET /api/me/blocks. */
export function fetchMyBlocks(): Promise<BlockedUser[]> {
  return api<{ data: BlockedUser[] }>('/api/me/blocks').then((r) => r.data ?? []);
}

/** 사용자 차단 — POST /api/me/blocks. 이후 목록 API 에서 해당 작성자 글이 숨겨진다. */
export function blockUser(userId: string): Promise<{ ok?: boolean; error?: string }> {
  return api<{ ok?: boolean; error?: string }>('/api/me/blocks', {
    method: 'POST',
    body: { userId },
  });
}

/** 차단 해제 — DELETE /api/me/blocks/:userId. */
export function unblockUser(userId: string): Promise<{ ok?: boolean; error?: string }> {
  return api<{ ok?: boolean; error?: string }>(`/api/me/blocks/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

/** 회원 탈퇴 — 웹 MyScreen 과 동일 DELETE /api/me. 성공 후 클라이언트가 세션을 비운다. */
export function deleteMyAccount(): Promise<{ ok?: boolean; error?: string }> {
  return api<{ ok?: boolean; error?: string }>('/api/me', { method: 'DELETE' });
}

/** 닉네임 변경 — 웹 EditableName 과 동일 PATCH /api/me/name. */
export function updateMyName(name: string): Promise<{ ok?: boolean; error?: string }> {
  return api<{ ok?: boolean; error?: string }>('/api/me/name', { method: 'PATCH', body: { name } });
}

export interface MySummary {
  user: { id: string; name: string | null; email: string | null };
  inventory: InventorySnapshot;
  level: LevelInfo;
  counts: { tradeCount: number; savedCount: number; cardCount: number };
}

/* --- endpoints ---------------------------------------------------- */

export function fetchMySummary(): Promise<MySummary> {
  if (SHOT) return Promise.resolve(SHOT_SUMMARY);
  return api<MySummary>('/api/me/summary');
}

export function fetchMyTrades(): Promise<MyTrade[]> {
  return api<{ data: MyTrade[] }>('/api/me/trades').then((r) => r.data);
}

export function fetchMyFeeds(): Promise<MyFeedPost[]> {
  return api<{ data: MyFeedPost[] }>('/api/me/feeds').then((r) => r.data);
}

export function fetchMyBookmarks(): Promise<MyBookmarks> {
  return api<{ data: MyBookmarks }>('/api/me/bookmarks').then((r) => r.data);
}

/**
 * 서버가 주는 상대경로 이미지(/api/cdn/cards/*.webp — 자체 CDN 캐시)를 RN Image 가
 * 로드할 수 있는 절대 URL 로. 웹은 same-origin 이라 상대경로가 그대로 동작하지만
 * 앱은 베이스 URL 프리픽스가 필요하다.
 */
export function absApiUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.startsWith('/') ? `${getApiBaseUrl()}${u}` : u;
}

/* 컬렉션 세션 캐시 — 화면 재진입 시 마지막 결과를 즉시 그리고(스피너 없이)
 * 백그라운드 재조회가 끝나면 갱신한다 (홈 hotCache·웹 세션캐시 페어).
 * 로그아웃/계정 전환 시 이전 계정 데이터가 비치지 않게 세션 변경에서 비운다. */
let myCardsCache: MyCardRow[] | null = null;
let portfolioCache: PortfolioSummary | null = null;
subscribeSession(() => {
  myCardsCache = null;
  portfolioCache = null;
});

/** 마지막으로 받아온 내 카드 목록 — 즉시 페인트 시드용 (없으면 null). */
export function peekMyCards(): MyCardRow[] | null {
  return myCardsCache;
}

/** 마지막으로 받아온 포트폴리오 요약 — 즉시 페인트 시드용 (없으면 null). */
export function peekPortfolio(): PortfolioSummary | null {
  return portfolioCache;
}

export function fetchMyCards(): Promise<MyCardRow[]> {
  if (SHOT) return Promise.resolve(SHOT_MY_CARDS);
  return api<{ data: MyCardRow[] }>('/api/me/cards/with-prices').then((r) => {
    const rows = r.data.map((c) => ({
      ...c,
      photoUrl: absApiUrl(c.photoUrl),
      snkrdunkImageUrl: absApiUrl(c.snkrdunkImageUrl),
    }));
    myCardsCache = rows;
    return rows;
  });
}

export function fetchMyFavorites(): Promise<MyFavoriteRow[]> {
  return api<{ data: MyFavoriteRow[] }>('/api/me/favorites/with-prices').then((r) =>
    r.data.map((f) => ({ ...f, imageUrl: absApiUrl((f as { imageUrl?: string | null }).imageUrl) }) as MyFavoriteRow),
  );
}

/** 카드 등록 페이로드 — 서버 POST /api/me/cards 와 동일 형태. */
export interface CreateMyCardInput {
  snkrdunkApparelId?: number | null;
  cardId?: string | null;
  ocrSetCode?: string | null;
  ocrCardNumber?: string | null;
  nickname?: string | null;
  photoUrl?: string | null;
  buyPrice?: number | null;
  buyCurrency?: string;
  qty?: number;
  buyDate?: string | null;
  /** 발매 지역 — 웹 CardRegisterSheet 동일 ('jp' | 'kr' | 'en'). */
  region?: string;
  memo?: string | null;
  selfPulled?: boolean;
  graded?: boolean;
  gradeCompany?: string | null;
  gradeValue?: string | null;
  /** 스캔 센터링 자동 추정 (웹 CardRegisterSheet 페이로드 동일). */
  gradeEstimate?: string | null;
  centeringScore?: number | null;
}

export function createMyCard(input: CreateMyCardInput): Promise<{ data: MyCardRow }> {
  return api<{ data: MyCardRow }>('/api/me/cards', { method: 'POST', body: input });
}

export function fetchPortfolio(): Promise<PortfolioSummary> {
  if (SHOT) return Promise.resolve(SHOT_PORTFOLIO);
  return api<{ data: PortfolioSummary }>('/api/me/portfolio').then((r) => {
    portfolioCache = r.data;
    return r.data;
  });
}

/* ── 가격 알림 — 시세가 목표가(JPY) 이하로 내려오면 서버 주기 체커가 메시지 발송. ── */

export interface PriceAlertRow {
  id: string;
  snkrdunkApparelId: number;
  targetPriceJpy: number;
  cardName: string | null;
  /** 도달해 발송된 시각. null 이면 활성(설정 중). */
  triggeredAt: string | null;
  createdAt: string;
}

/** 내 가격 알림 목록. 미설정/실패 시 빈 배열. */
export function fetchPriceAlerts(): Promise<PriceAlertRow[]> {
  if (SHOT) return Promise.resolve(SHOT_PRICE_ALERTS);
  return api<{ data: PriceAlertRow[] }>('/api/me/price-alerts')
    .then((r) => r.data ?? [])
    .catch(() => []);
}

/** 목표가 설정/변경 — 같은 카드는 upsert(재활성화). */
export function createPriceAlert(input: {
  snkrdunkApparelId: number;
  targetPriceJpy: number;
  cardName?: string | null;
}): Promise<{ data: PriceAlertRow }> {
  return api<{ data: PriceAlertRow }>('/api/me/price-alerts', { method: 'POST', body: input });
}

export function deletePriceAlert(apparelId: number): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/me/price-alerts/${apparelId}`, { method: 'DELETE' });
}

export function removeFavorite(apparelId: number): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/me/favorites/${apparelId}`, { method: 'DELETE' });
}

export function deleteMyCard(id: number): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/me/cards/${id}`, { method: 'DELETE' });
}

export function fetchMessageThreads(): Promise<MessageThread[]> {
  return api<{ data: MessageThread[] }>('/api/messages').then((r) => r.data);
}

export function fetchOripaBoxes(): Promise<OripaBox[]> {
  return api<{ data: OripaBox[] }>('/api/oripa', { auth: false }).then((r) => r.data);
}

export type ShopKind = 'avatar' | 'bg' | 'frame';
export type ShopAction = 'buy' | 'pick';

export interface BuyResult {
  ok: boolean;
  inv?: InventorySnapshot;
  error?: string;
}

export function buyOrPick(action: ShopAction, kind: ShopKind, id: string, price = 0): Promise<BuyResult> {
  return api<BuyResult>('/api/me/inventory/buy', {
    method: 'POST',
    body: { action, kind, id, price },
  });
}

export function fetchInventory(): Promise<{ inventory: InventorySnapshot }> {
  return api<{ inventory: InventorySnapshot }>('/api/me/inventory');
}

/* --- card packs (snkrdunk hit cards per pack) -------------------- */
// 팩 목록·상세 데이터는 웹 packs/[code]/page.tsx 와 동일하게 NAS `/api/card-packs`
// (서버 getPackWithHits — DB 캐시·검색 폴백·selectHits 정렬·번역) 를 호출한다.
// 로직 정본은 서버 한 곳: 기기에서 스니덩을 직접 조회하던 resolvePack 재구현은 제거됨.

export interface PackHitCard {
  apparelId: number;
  name: string;
  koName?: string;
  shortName: string;
  itemKind?: 'single' | 'box' | 'other';
  imageUrl: string | null;
  minPrice: number;
  displayPrice: string;
  listingCount: number;
  listingCountText: string;
  productNumber: string;
  lastSalePrice?: number;
  lastSaleText?: string;
  lastSaleSort?: number;
}

export interface PackWithHits {
  code: string;
  name: string;
  shortName: string;
  emoji: string;
  bg: string;
  releasedAt?: string;
  boxImageUrl?: string | null;
  boxName?: string | null;
  boxKoName?: string | null;
  hits: PackHitCard[];
}

export async function fetchAllPacksWithHits(limit = 12): Promise<PackWithHits[]> {
  const r = await api<{ data: PackWithHits[] }>(`/api/card-packs?withHits=1&limit=${limit}`, {
    auth: false,
  });
  // 이 화면(구 /cards 시세확인)은 포켓몬 박스만 다룸 — 서버는 전체 팩을 주므로 코드로 필터.
  const pokemonCodes = new Set(
    CARD_PACKS.filter((p) => !p.game || p.game === 'pokemon').map((p) => p.code),
  );
  return (r.data ?? []).filter((p) => pokemonCodes.has(p.code));
}

// 팩 상세 캐시 — 웹 packs/[code]/page.tsx 의 ISR revalidate=900 과 동일 주기.
const PACK_HITS_TTL_MS = 900 * 1000;
const packHitsCache = new Map<string, { data: PackWithHits; at: number }>();

export async function fetchPackHits(code: string, limit = 30): Promise<PackWithHits | null> {
  const key = `${code}:${limit}`;
  const cached = packHitsCache.get(key);
  if (cached && Date.now() - cached.at < PACK_HITS_TTL_MS) return cached.data;
  try {
    const r = await api<{ data: PackWithHits }>(
      `/api/card-packs/${encodeURIComponent(code)}?limit=${limit}`,
      { auth: false },
    );
    const data = r.data ?? null;
    if (data) packHitsCache.set(key, { data, at: Date.now() });
    return data;
  } catch (err) {
    // 웹 loadPack 과 동일 — 없는 팩 코드는 null (화면이 '팩을 찾지 못했어요' 표시).
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

