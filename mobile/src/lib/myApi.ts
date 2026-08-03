/**
 * /api/me/* 응답 타입 + 호출 함수.
 *
 * 응답 타입은 웹 [[src/lib/queries.ts]] / [[src/lib/messages.ts]] 의 반환 모양과 1:1.
 * 모바일이 자체 mock 으로 폴백할 수 있도록 [[ApiError]] 를 그대로 던진다.
 */
import { api, getApiBaseUrl } from './apiClient';
import { CARD_PACKS, getCardPack, type CardPackMeta } from '@/data/cardPacks';
import { localizeCardName } from './cardNameKo';
import { shortenName } from '../../../shared/util/shortenName';
import {
  fetchAllSnkrdunkApparelGroup,
  fetchSnkrdunkApparel,
  fetchSnkrdunkApparelGroup,
  searchSnkrdunkByQuery,
  type SnkrdunkApparel,
  type SnkrdunkApparelGroupPage,
} from '@/services/snkrdunk';

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
  return api<{ count: number }>('/api/messages/unread')
    .then((r) => (Number.isFinite(r.count) ? r.count : 0))
    .catch(() => 0);
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

export function fetchMyCards(): Promise<MyCardRow[]> {
  return api<{ data: MyCardRow[] }>('/api/me/cards/with-prices').then((r) =>
    r.data.map((c) => ({
      ...c,
      photoUrl: absApiUrl(c.photoUrl),
      snkrdunkImageUrl: absApiUrl(c.snkrdunkImageUrl),
    })),
  );
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
  return api<{ data: PortfolioSummary }>('/api/me/portfolio').then((r) => r.data);
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
  // 비포켓몬 팩(웹 시세확인 테마 탭 전용)은 모바일 미노출.
  const pokemonPacks = CARD_PACKS.filter((p) => !p.game || p.game === 'pokemon');
  return runWithConcurrency(pokemonPacks, 8, (pack) => resolvePack(pack, limit));
}

export async function fetchPackHits(code: string, limit = 30): Promise<PackWithHits | null> {
  const pack = getCardPack(code);
  if (!pack) return null;
  return resolvePack(pack, limit);
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await task(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function resolvePack(pack: CardPackMeta, limit: number): Promise<PackWithHits> {
  const singlesPerPage = Math.min(Math.max(limit * 4, 20), 100);
  let groupSingles: SnkrdunkApparel[] = [];
  let boxesPage: SnkrdunkApparelGroupPage | null = null;
  if (pack.apparelGroupId) {
    [groupSingles, boxesPage] = await Promise.all([
      limit <= 12
        ? fetchSnkrdunkApparelGroup(pack.apparelGroupId, {
            apparelCategoryId: 25,
            page: 1,
            perPage: singlesPerPage,
          }).then((p) => p?.apparels ?? [])
        : fetchAllSnkrdunkApparelGroup(pack.apparelGroupId, {
            apparelCategoryId: 25,
            maxItems: Math.max(limit, 100),
          }),
      fetchSnkrdunkApparelGroup(pack.apparelGroupId, {
        apparelCategoryId: 14,
        page: 1,
        perPage: 5,
      }),
    ]);
  }
  // 신규팩처럼 매물 0 이면 전부 노출 — 서버 resolveGroupSingles 와 동일 규칙.
  const priced = groupSingles.filter((a) => a.minPrice > 0);
  let hits = (priced.length > 0 ? priced : groupSingles).slice(0, limit).map(toHitCard);
  let box = (boxesPage?.apparels ?? []).find((a) => a.minPrice > 0) ?? boxesPage?.apparels?.[0] ?? null;
  // 그룹 미확인(groupId 0)·빈 그룹 팩(원피스 일부 등) — 서버 resolveSearchFill 처럼 검색 폴백.
  if (hits.length === 0 && !box) {
    ({ hits, box } = await resolvePackBySearch(pack, limit));
  }
  return {
    code: pack.code,
    name: pack.name,
    shortName: pack.shortName,
    emoji: pack.emoji,
    bg: pack.bg,
    releasedAt: pack.releasedAt,
    boxImageUrl: box?.imageUrl ?? null,
    boxName: box?.localizedName ?? null,
    boxKoName: box ? localizeCardName(box.localizedName) : null,
    hits,
  };
}

async function resolvePackBySearch(
  pack: CardPackMeta,
  limit: number,
): Promise<{ hits: PackHitCard[]; box: SnkrdunkApparel | null }> {
  const results = await searchSnkrdunkByQuery(pack.searchQuery, 1);
  // 검색 타일엔 시세·itemKind 가 없어 apparelId 별로 다시 fetch (동시성 cap 6).
  const pool = results.slice(0, Math.min(Math.max(limit, 12), 40));
  const hydrated = await runWithConcurrency(pool, 6, (r) => fetchSnkrdunkApparel(r.apparelId));
  const apparels = hydrated.filter((a): a is SnkrdunkApparel => a != null);
  const boxes = apparels.filter((a) => a.itemKind === 'box');
  const singles = apparels.filter((a) => a.itemKind !== 'box');
  const priced = singles.filter((a) => a.minPrice > 0);
  const hits = [
    ...(priced.length > 0 ? priced : singles).slice(0, limit),
    // 웹 selectHits 와 동일 — 매물 있는 박스는 목록 끝에 붙는다.
    ...boxes.filter((b) => b.minPrice > 0),
  ].map(toHitCard);
  const box = boxes.find((a) => a.minPrice > 0) ?? boxes[0] ?? null;
  return { hits, box };
}

function toHitCard(a: SnkrdunkApparel): PackHitCard {
  const jp = a.localizedName || a.name;
  const ko = localizeCardName(jp);
  return {
    apparelId: a.id,
    name: jp,
    koName: ko,
    shortName: shortenName(ko),
    itemKind: a.itemKind,
    imageUrl: a.imageUrl,
    minPrice: a.minPrice,
    displayPrice: a.displayPrice,
    listingCount: a.listingCount,
    listingCountText: a.listingCountText,
    productNumber: a.productNumber,
  };
}

