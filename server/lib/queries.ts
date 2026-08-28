import {
  DEFAULT_AVATAR,
  DEFAULT_OWNED,
  isAvatarId,
  type AvatarId,
} from '@/lib/avatars';
import { prisma } from './prisma.js';
import {
  DEFAULT_BG,
  DEFAULT_FRAME,
  isBackgroundId,
  isFrameId,
  type BackgroundId,
  type FrameId,
} from '@/lib/shop';
import type {
  FeedPost,
  Place,
  Trade,
  TradeDetail,
  TradeStatus,
  TradeType,
} from '@/lib/types';
import { fetchSnkrdunkApparel } from '@/lib/snkrdunk';
import { registerBasisJpy } from '../../shared/snkrdunkPrice';
import { translateKnownCardNameToKo } from '../../shared/cardTranslate';
import { getCardPackMeta } from '@/lib/cardPacks';
import { getCachedJpyKrw } from './fxRate.js';
import {
  isFreshEntry,
  loadCatalogEntries,
  recordPriceSnapshot,
  refreshApparelPrices,
  upsertCatalogCard,
  type CatalogEntry,
} from './snkrdunkCatalog.js';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * 등록가(JPY) 결정 — 컬렉션 리스트 "등록가 → 현재가 등락률" 기준값.
 *  · buyPrice 가 있으면 그 값을 JPY 로 환산해 사용
 *    (직접뽑기=등록 시점 현재시세가 buyPrice 로 들어옴 / 구매=사용자 입력가).
 *  · buyPrice 가 없으면 현재 싱글시세(JPY)로 보조 백필. 둘 다 없으면 null.
 * jpyKrwRate 는 JPY→KRW 배율(예: 9.5). KRW buyPrice 는 buyPrice/rate 로 환산.
 */
export function deriveRegisterPriceJpy(
  buyPrice: number | null,
  buyCurrency: string | null,
  currentSingleJpy: number,
  jpyKrwRate: number,
): number | null {
  if (buyPrice != null && buyPrice > 0) {
    if (buyCurrency === 'JPY') return Math.round(buyPrice);
    const rate = jpyKrwRate > 0 ? jpyKrwRate : 9.5;
    return Math.round(buyPrice / rate);
  }
  return currentSingleJpy > 0 ? Math.round(currentSingleJpy) : null;
}

function relTime(iso: Date | string): string {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60_000));
  if (mins <= 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

function asTradeStatus(s: string): TradeStatus {
  return (['open', 'reserved', 'done', 'cancelled'] as const).includes(s as TradeStatus)
    ? (s as TradeStatus)
    : 'open';
}

type FeedRow = {
  id: number;
  text: string;
  authorId?: string | null;
  authorEmoji: string;
  authorBgId?: string;
  authorFrameId?: string;
  category?: string | null;
  images?: unknown;
  createdAt: Date;
  author?: { name: string | null } | null;
  _count?: { comments: number; bookmarks: number } | null;
};

function toFeedPost(r: FeedRow): FeedPost {
  return {
    id: r.id,
    text: r.text,
    time: relTime(r.createdAt),
    createdAt: r.createdAt.toISOString(),
    user: r.authorEmoji ?? '🐣',
    authorName: r.author?.name ?? null,
    authorId: r.authorId ?? null,
    authorBgId: r.authorBgId,
    authorFrameId: r.authorFrameId,
    category: r.category ?? null,
    images: asImages(r.images),
    commentCount: r._count?.comments ?? 0,
    likeCount: r._count?.bookmarks ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* places — 거래 만남 장소 (페스타 혼잡도 필드는 제거됨)                  */
/* ------------------------------------------------------------------ */

/** 첫 배포 / 빈 Supabase 를 위한 장소 기본 시드. 거래 시 만남 장소로 사용. */
const DEFAULT_PLACES = [
  { id: 'seongsu',  name: '성수역 부근',   emoji: '🚇', bg: '#E63946' },
  { id: 'seoulsup', name: '서울숲역 부근', emoji: '🌳', bg: '#4ADE80' },
];

export async function getPlaces(): Promise<Place[]> {
  try {
    let rows = await prisma.place.findMany({ orderBy: { id: 'asc' } });
    if (rows.length === 0) {
      await prisma.place.createMany({ data: DEFAULT_PLACES, skipDuplicates: true });
      rows = await prisma.place.findMany({ orderBy: { id: 'asc' } });
    }
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      bg: r.bg,
    }));
  } catch (err) {
    console.error('[getPlaces]', err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* feeds                                                               */
/* ------------------------------------------------------------------ */

/**
 * 통합 피드 조회 — cursor 기반 페이지네이션.
 * 일반 커뮤니티 글만 다룸 (페스타 제보는 제거됨).
 */
export interface FeedPage {
  items: FeedPost[];
  nextCursor: string | null;
}

/** 뷰어가 차단한 사용자 id 목록 — 피드/거래 목록에서 해당 작성자 글 숨김용. */
export async function getBlockedIds(viewerId: string | null | undefined): Promise<string[]> {
  if (!viewerId) return [];
  try {
    const rows = await prisma.userBlock.findMany({
      where: { blockerId: viewerId },
      select: { blockedId: true },
    });
    return rows.map((r) => r.blockedId);
  } catch {
    return [];
  }
}

export async function getFeedPage(opts: {
  cursor?: string | null;
  limit?: number;
  authorId?: string;
  /** 로그인 뷰어 id — 차단한 작성자 글 제외 (App Store 1.2). */
  viewerId?: string | null;
} = {}): Promise<FeedPage> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  try {
    const blocked = await getBlockedIds(opts.viewerId);
    const rows = await prisma.feed.findMany({
      where: {
        ...(opts.authorId ? { authorId: opts.authorId } : {}),
        ...(opts.cursor ? { createdAt: { lt: new Date(opts.cursor) } } : {}),
        // NOT-in 필터는 authorId=null(탈퇴/익명) 글을 유지한다.
        ...(blocked.length ? { NOT: { authorId: { in: blocked } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        author: { select: { name: true } },
        _count: { select: { comments: true, bookmarks: true } },
      },
    });
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const items = slice.map((r) =>
      toFeedPost({
        ...r,
        // 레거시 row 에 컬럼이 없을 경우 안전한 기본값
        authorBgId: (r as unknown as { authorBgId?: string }).authorBgId ?? 'default',
        authorFrameId: (r as unknown as { authorFrameId?: string }).authorFrameId ?? 'none',
      }),
    );
    const nextCursor = hasMore ? slice[slice.length - 1].createdAt.toISOString() : null;
    return { items, nextCursor };
  } catch (err) {
    console.error('[getFeedPage] query failed:', err);
    return { items: [], nextCursor: null };
  }
}

/** 편의 — 첫 페이지만 받고 싶을 때. */
export async function getFeedPosts(limit = 30): Promise<FeedPost[]> {
  const { items } = await getFeedPage({ limit });
  return items;
}

function asImages(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((u): u is string => typeof u === 'string' && u.length > 0);
  return [];
}

/* ------------------------------------------------------------------ */
/* trades                                                              */
/* ------------------------------------------------------------------ */

export async function getTrades(
  filter: 'all' | TradeType = 'all',
  limit = 60,
  viewerId?: string | null,
): Promise<Trade[]> {
  try {
    const blocked = await getBlockedIds(viewerId);
    const rows = await prisma.trade.findMany({
      where: {
        ...(filter === 'all' ? {} : { type: filter }),
        ...(blocked.length ? { NOT: { authorId: { in: blocked } } } : {}),
      },
      orderBy: [{ bumpedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        place: { select: { name: true } },
        author: { select: { name: true } },
      },
    });

    // 거래글별 "1:1 채팅 중인 사용자 수" 집계 (메시지 개수 아님).
    // 작성자에게 메시지를 한 번이라도 보낸 unique senderId 의 개수.
    const ids = rows.map((r) => r.id);
    let chatCounts: Record<number, number> = {};
    if (ids.length > 0) {
      const ownerById = new Map(rows.map((r) => [r.id, r.authorId]));
      const pairs = await prisma.message.groupBy({
        by: ['tradeId', 'senderId'],
        where: { tradeId: { in: ids } },
      });
      const setMap = new Map<number, Set<string>>();
      for (const m of pairs) {
        if (m.tradeId == null) continue;
        const owner = ownerById.get(m.tradeId) ?? null;
        if (owner && m.senderId === owner) continue; // 작성자 본인 제외
        const s = setMap.get(m.tradeId) ?? new Set<string>();
        s.add(m.senderId);
        setMap.set(m.tradeId, s);
      }
      chatCounts = Object.fromEntries(
        Array.from(setMap.entries()).map(([tid, s]) => [tid, s.size]),
      );
    }

    return rows.map((r) => ({
      id: r.id,
      type: r.type as TradeType,
      status: asTradeStatus(r.status),
      title: r.title,
      place: r.place?.name ?? '',
      time: relTime(r.bumpedAt ?? r.createdAt),
      price: r.price ?? '제안',
      kakaoId: r.kakaoId ?? null,
      bumpCount: r.bumpCount,
      chatCount: chatCounts[r.id] ?? 0,
      authorName: r.author?.name ?? '탈퇴',
      authorEmoji: r.authorEmoji,
      authorBgId: r.authorBgId,
      authorFrameId: r.authorFrameId,
      images: asImages((r as { images?: unknown }).images),
    }));
  } catch (err) {
    console.error('[getTrades]', err);
    return [];
  }
}

export async function getTradeById(id: number): Promise<TradeDetail | null> {
  try {
    const r = await prisma.trade.findUnique({
      where: { id },
      include: {
        place: { select: { name: true } },
        author: { select: { name: true } },
      },
    });
    if (!r) return null;
    return {
      id: r.id,
      type: r.type as TradeType,
      title: r.title,
      body: r.body,
      price: r.price ?? '제안',
      place: r.place?.name ?? '',
      time: relTime(r.bumpedAt ?? r.createdAt),
      status: asTradeStatus(r.status),
      authorName: r.author?.name ?? '탈퇴',
      authorEmoji: r.authorEmoji,
      authorBgId: r.authorBgId,
      authorFrameId: r.authorFrameId,
      authorId: r.authorId ?? null,
      kakaoId: r.kakaoId ?? null,
      bumpCount: r.bumpCount,
      images: asImages((r as { images?: unknown }).images),
    };
  } catch (err) {
    console.error('[getTradeById]', err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* my cards (UserCard 테이블)                                          */
/* ------------------------------------------------------------------ */

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
  buyPrice: number | null;
  buyCurrency: string | null;
  qty: number;
  buyDate: string | null;
  /** 발매 지역(에디션) — 'jp' | 'kr' | 'en'. 자산 구성 비중용. 미입력이면 null. */
  region: string | null;
  /** 등록 시점 싱글 시세(JPY) 기준값 — 등락률용. 최초 조회 시 현재가로 백필. */
  registerPriceJpy: number | null;
  selfPulled: boolean;
  graded: boolean;
  gradeCompany: string | null;
  gradeValue: string | null;
  createdAt: string;
}

export async function getMyCards(userId: string, limit = 100): Promise<MyCardRow[]> {
  try {
    const rows = await prisma.userCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => ({
      id: r.id,
      cardId: r.cardId,
      ocrSetCode: r.ocrSetCode,
      ocrCardNumber: r.ocrCardNumber,
      snkrdunkApparelId: r.snkrdunkApparelId,
      nickname: r.nickname,
      memo: r.memo,
      gradeEstimate: r.gradeEstimate,
      centeringScore: r.centeringScore,
      photoUrl: r.photoUrl,
      buyPrice: r.buyPrice,
      buyCurrency: r.buyCurrency,
      qty: r.qty,
      buyDate: r.buyDate,
      region: r.region ?? null,
      registerPriceJpy: r.registerPriceJpy,
      selfPulled: r.selfPulled,
      graded: r.graded,
      gradeCompany: r.gradeCompany,
      gradeValue: r.gradeValue,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error('[getMyCards]', err);
    return [];
  }
}

/**
 * 내 카드 + 각 카드의 최근 시세 스냅샷 (있으면) 결합.
 * 대시보드 포트폴리오 가치 계산용. 없는 카드는 price=0 으로 채워서 반환.
 * snkrdunkApparelId 가 있는 카드는 스니덩 시세 (JPY) / 이미지 / 이름까지 함께 채운다.
 */
export interface MyCardWithPrice extends MyCardRow {
  latestPrice: number;
  /** 최근 7개 스냅샷 평균값들 (오래된 → 최신). 데이터 부족 시 빈 배열. */
  trend: number[];
  /** snkrdunkApparelId 가 있는 카드만 채워짐. */
  snkrdunkName: string | null;
  snkrdunkImageUrl: string | null;
  /**
   * 호환용 — priceSingleJpy 와 동일 (raw/싱글카드 중앙값).
   * 기존 호출처가 이 필드를 쓰므로 유지.
   */
  snkrdunkMinPriceJpy: number;
  /** 싱글카드 (raw, non-PSA10) 최근 7건 매출 중앙값. */
  priceSingleJpy: number;
  /** PSA10 라벨이 붙은 최근 7건 매출 중앙값. 데이터 없으면 0. */
  pricePsa10Jpy: number;
  /** PSA9 최근 체결 중앙값. 데이터 없으면 0. */
  pricePsa9Jpy: number;
  /** PSA8 최근 체결 중앙값. 데이터 없으면 0. */
  pricePsa8Jpy: number;
  /**
   * 이 카드의 등급 기준 "현재시세"(JPY) — 등록가(registerPriceJpy)와 같은 규칙으로
   * 산정해 등락률 비교가 성립한다. PSA10/9/8→해당 등급가, 타사→PSA10, 싱글→raw.
   * 데이터 없으면 0.
   */
  currentPriceJpy: number;
  /**
   * currentPriceJpy 가 어느 등급 시세를 쓴 값인지 — 'RAW' | 'PSA 10' | 'PSA 9' | 'PSA 8'.
   * 목록에서 시세상세로 넘길 때(?grade=) 이 값을 그대로 실어 보내면 상세 첫 화면
   * 가격이 목록과 같아진다. 등급 데이터가 없어 폴백된 경우까지 정확히 반영한다.
   */
  priceBasis: string;
  /** 소속 시리즈(박스) 한국어명 — 카탈로그 packCode→CARD_PACKS, 폴백 setCode. 없으면 null. */
  series: string | null;
  /** 카드 게임 종류 ('pokemon'|'onepiece'|'yugioh'|'other') — 카탈로그 game. 없으면 null. */
  game: string | null;
}

export async function getMyCardsWithPrices(
  userId: string,
  limit = 100,
): Promise<MyCardWithPrice[]> {
  const cards = await getMyCards(userId, limit);
  if (cards.length === 0) return [];

  // 스니덩 시세 enrich 준비 — apparelId 중복 제거.
  const apparelIds = Array.from(
    new Set(
      cards
        .map((c) => c.snkrdunkApparelId)
        .filter((v): v is number => typeof v === 'number'),
    ),
  );
  // apparel meta + 시세. 계산은 [[snkrdunkPrice]] computeApparelPrices 로 통일 —
  // 스캔 매칭 후보와 같은 함수를 써서 같은 카드에 같은 가격을 보인다(불일치 방지).
  const apparelInfo = new Map<
    number,
    {
      name: string;
      imageUrl: string | null;
      priceSingleJpy: number;
      pricePsa10Jpy: number;
      pricePsa9Jpy: number;
      pricePsa8Jpy: number;
      /** sales-chart 일별 시세 시리즈(오래된→최신). 차트/등락 통일용. */
      trendJpy: number[];
    }
  >();
  // apparelId → 시리즈(박스) 한국어명. 카탈로그 packCode→CARD_PACKS, 폴백 setCode.
  const seriesById = new Map<number, string | null>();
  // apparelId → 카드 게임 종류. 테마순 정렬용.
  const gameById = new Map<number, string | null>();
  if (apparelIds.length > 0) {
    // 1) 우리 DB(마스터 카탈로그 + 최신 시세 스냅샷) 우선 — 신선하면 스니덩 호출 생략.
    const catalog = await loadCatalogEntries(apparelIds);
    for (const [id, e] of catalog) {
      // 박스 코드 → 친화명, 폴백: 세트코드를 팩코드로 매칭(소문자) → 그래도 없으면 세트코드 원문.
      const fromPack = e.packCode ? getCardPackMeta(e.packCode)?.shortName ?? null : null;
      const fromSet = e.setCode ? getCardPackMeta(e.setCode.toLowerCase())?.shortName ?? e.setCode : null;
      seriesById.set(id, fromPack ?? fromSet ?? null);
      gameById.set(id, e.game ?? null);
    }
    const staleIds = apparelIds.filter((id) => !isFreshEntry(catalog.get(id)));
    // stale-while-revalidate — 스냅샷이 하나라도 있는 카드(오래됐어도)는 그 값으로
    // 즉시 응답하고 갱신은 백그라운드로 넘긴다. 라이브 조회를 기다리는(=응답을 막는)
    // 카드는 스냅샷이 아예 없는 신규뿐이라 컬렉션 로딩이 스크레이프 N건에 안 묶인다.
    const blockingIds = staleIds.filter((id) => !catalog.get(id)?.snapshot);
    const backgroundIds = staleIds.filter((id) => catalog.get(id)?.snapshot);
    if (backgroundIds.length > 0) {
      void Promise.allSettled(backgroundIds.map((id) => refreshApparelPrices(id)));
    }

    // 2) 스냅샷이 전혀 없는 카드만 라이브 조회 → 결과는 카탈로그/스냅샷에 재적재.
    await Promise.all(
      blockingIds.map(async (id) => {
        const r = await refreshApparelPrices(id);
        if (!r) return;
        apparelInfo.set(id, {
          name: r.name,
          imageUrl: r.imageUrl,
          priceSingleJpy: r.single,
          pricePsa10Jpy: r.psa10,
          pricePsa9Jpy: r.psa9,
          pricePsa8Jpy: r.psa8,
          trendJpy: r.trendJpy,
        });
      }),
    );

    // 3) 라이브로 안 채운 나머지는 DB 값으로.
    for (const id of apparelIds) {
      if (apparelInfo.has(id)) continue;
      const e = catalog.get(id);
      if (!e?.snapshot) continue;
      apparelInfo.set(id, {
        name: e.name,
        imageUrl: e.imageUrl,
        priceSingleJpy: e.snapshot.priceSingle || e.snapshot.minPrice,
        pricePsa10Jpy: e.snapshot.pricePsa10,
        pricePsa9Jpy: e.snapshot.pricePsa9,
        pricePsa8Jpy: e.snapshot.pricePsa8,
        trendJpy: e.snapshot.trend,
      });
    }
  }

  const enrichSnk = (c: MyCardRow) => {
    if (!c.snkrdunkApparelId) {
      return {
        snkrdunkName: null,
        snkrdunkImageUrl: null,
        snkrdunkMinPriceJpy: 0,
        priceSingleJpy: 0,
        pricePsa10Jpy: 0,
        pricePsa9Jpy: 0,
        pricePsa8Jpy: 0,
        currentPriceJpy: 0,
        priceBasis: 'RAW',
        series: null,
        game: null,
      };
    }
    const info = apparelInfo.get(c.snkrdunkApparelId);
    // 등급 기준 현재시세 — 등록가와 같은 규칙(registerBasisJpy)으로 산정해 등락률 비교 성립.
    // basis 도 같이 받아 목록→시세상세 이동 시 같은 등급 탭으로 열도록 넘긴다.
    const basis = info
      ? registerBasisJpy(
          {
            single: info.priceSingleJpy,
            psa10: info.pricePsa10Jpy,
            psa9: info.pricePsa9Jpy,
            psa8: info.pricePsa8Jpy,
            trendJpy: [],
          },
          { graded: c.graded, gradeCompany: c.gradeCompany, gradeValue: c.gradeValue },
        )
      : { price: 0, basis: 'RAW' };
    const current = basis.price;
    return {
      // 컬렉션/포트폴리오의 메인 타이틀 — 일본어 원문을 한국어(사전+음역)로.
      snkrdunkName: info?.name ? translateKnownCardNameToKo(info.name) : null,
      snkrdunkImageUrl: info?.imageUrl ?? null,
      snkrdunkMinPriceJpy: info?.priceSingleJpy ?? 0, // 호환용 별칭
      priceSingleJpy: info?.priceSingleJpy ?? 0,
      pricePsa10Jpy: info?.pricePsa10Jpy ?? 0,
      pricePsa9Jpy: info?.pricePsa9Jpy ?? 0,
      pricePsa8Jpy: info?.pricePsa8Jpy ?? 0,
      currentPriceJpy: current,
      priceBasis: basis.basis,
      series: seriesById.get(c.snkrdunkApparelId) ?? null,
      game: gameById.get(c.snkrdunkApparelId) ?? null,
    };
  };

  const snkTrend = (c: MyCardRow): number[] =>
    c.snkrdunkApparelId ? (apparelInfo.get(c.snkrdunkApparelId)?.trendJpy ?? []) : [];

  const cardIds = Array.from(
    new Set(cards.map((c) => c.cardId).filter((id): id is string => Boolean(id))),
  );
  if (cardIds.length === 0) {
    return cards.map((c) => ({ ...c, latestPrice: 0, trend: snkTrend(c), ...enrichSnk(c) }));
  }

  // 카드별 최근 7건 시세 스냅샷 (USD)
  let snapshots: Array<{ cardId: string; avg: number; fetchedAt: Date }> = [];
  try {
    snapshots = await prisma.cardPriceSnapshot.findMany({
      where: { cardId: { in: cardIds } },
      orderBy: { fetchedAt: 'desc' },
      take: cardIds.length * 7,
      select: { cardId: true, avg: true, fetchedAt: true },
    });
  } catch (err) {
    console.error('[getMyCardsWithPrices] snapshot 조회 실패', err);
  }

  const byCard = new Map<string, Array<{ avg: number; fetchedAt: Date }>>();
  for (const s of snapshots) {
    const arr = byCard.get(s.cardId) ?? [];
    arr.push({ avg: s.avg, fetchedAt: s.fetchedAt });
    byCard.set(s.cardId, arr);
  }

  const result = cards.map((c) => {
    const snk = enrichSnk(c);
    // 스니덩 카드: sales-chart 일별 시리즈를 trend 로 노출(리스트 차트·등락 통일).
    if (!c.cardId) return { ...c, latestPrice: 0, trend: snkTrend(c), ...snk };
    const list = byCard.get(c.cardId) ?? [];
    if (list.length === 0) return { ...c, latestPrice: 0, trend: snkTrend(c), ...snk };
    // findMany 가 desc 정렬이라 첫 번째가 최신
    const latest = list[0].avg;
    const trend = list.slice(0, 7).map((s) => s.avg).reverse();
    return { ...c, latestPrice: latest, trend, ...snk };
  });

  // 등록가(registerPriceJpy) 백필 — 등록 단계에서 못 채운 기존/예외 카드 보조.
  // buyPrice 가 있으면 그 값(JPY 환산)을, 없으면 등급 기준 현재시세(currentPriceJpy,
  // 없으면 싱글가)를 한 번만 저장. 응답에도 즉시 반영하고, 쓰기는 fire-and-forget.
  const jpyKrw = getCachedJpyKrw();
  const toBackfill = result
    .filter((r) => r.registerPriceJpy == null)
    .map((r) => ({
      r,
      desired: deriveRegisterPriceJpy(
        r.buyPrice,
        r.buyCurrency,
        r.currentPriceJpy > 0 ? r.currentPriceJpy : r.priceSingleJpy,
        jpyKrw,
      ),
    }))
    .filter((x): x is { r: (typeof result)[number]; desired: number } => x.desired != null);
  if (toBackfill.length > 0) {
    for (const { r, desired } of toBackfill) r.registerPriceJpy = desired;
    void Promise.all(
      toBackfill.map(({ r }) =>
        prisma.userCard
          .updateMany({
            where: { id: r.id, registerPriceJpy: null },
            data: { registerPriceJpy: r.registerPriceJpy },
          })
          .catch(() => undefined),
      ),
    ).catch(() => undefined);
  }

  return result;
}

/**
 * 내 카드 "가격만" — 클라이언트가 카드 정적 데이터(이름·이미지·시리즈…)를 캐시해 두고
 * 재진입 시 오늘의 금액만 갱신하는 델타 응답. 카탈로그 스냅샷만 읽어 즉시 응답하고
 * (라이브 대기 0), stale 스냅샷은 백그라운드로 갱신한다. 계산 규칙은
 * getMyCardsWithPrices 의 DB 폴백 경로와 동일 — 같은 카드에 같은 가격.
 */
export interface MyCardPriceRow {
  id: number;
  priceSingleJpy: number;
  pricePsa10Jpy: number;
  pricePsa9Jpy: number;
  pricePsa8Jpy: number;
  currentPriceJpy: number;
  /** currentPriceJpy 의 등급 기준 — MyCardWithPrice.priceBasis 와 같은 값. */
  priceBasis: string;
  trend: number[];
}

export async function getMyCardPrices(userId: string, limit = 200): Promise<MyCardPriceRow[]> {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
    select: {
      id: true,
      snkrdunkApparelId: true,
      graded: true,
      gradeCompany: true,
      gradeValue: true,
    },
  });
  if (cards.length === 0) return [];
  const apparelIds: number[] = Array.from(
    new Set<number>(
      cards.map((c) => c.snkrdunkApparelId).filter((v): v is number => typeof v === 'number'),
    ),
  );
  const catalog = await loadCatalogEntries(apparelIds);
  const staleIds = apparelIds.filter((id) => !isFreshEntry(catalog.get(id)));
  if (staleIds.length > 0) {
    void Promise.allSettled(staleIds.map((id) => refreshApparelPrices(id)));
  }
  return cards.map((c) => {
    const s = c.snkrdunkApparelId != null ? catalog.get(c.snkrdunkApparelId)?.snapshot : null;
    if (!s) {
      return {
        id: c.id,
        priceSingleJpy: 0,
        pricePsa10Jpy: 0,
        pricePsa9Jpy: 0,
        pricePsa8Jpy: 0,
        currentPriceJpy: 0,
        priceBasis: 'RAW',
        trend: [],
      };
    }
    const single = s.priceSingle || s.minPrice;
    const basis = registerBasisJpy(
      { single, psa10: s.pricePsa10, psa9: s.pricePsa9, psa8: s.pricePsa8, trendJpy: [] },
      { graded: c.graded, gradeCompany: c.gradeCompany, gradeValue: c.gradeValue },
    );
    const current = basis.price;
    return {
      id: c.id,
      priceSingleJpy: single,
      pricePsa10Jpy: s.pricePsa10,
      pricePsa9Jpy: s.pricePsa9,
      pricePsa8Jpy: s.pricePsa8,
      currentPriceJpy: current,
      priceBasis: basis.basis,
      trend: s.trend,
    };
  });
}

export async function countMyCards(userId: string): Promise<number> {
  try {
    return await prisma.userCard.count({ where: { userId } });
  } catch (err) {
    console.error('[countMyCards]', err);
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/* my favorites (FavoriteCard 테이블 — 자산 합계 제외)                  */
/* ------------------------------------------------------------------ */

export interface MyFavoriteRow {
  id: number;
  snkrdunkApparelId: number;
  createdAt: string;
  name: string | null;
  imageUrl: string | null;
  /**
   * 대표 시세 — 시세상세 헤드라인(headlinePrice)과 같은 값. 없으면 raw 중앙값 → 최저매물 순 폴백.
   * (이름은 호환용으로 유지. 과거엔 최저매물 호가였음 — 목록/상세 불일치 원인.)
   */
  minPriceJpy: number;
  /** minPriceJpy 의 기준 — 'RAW' | 'PSA 10' … | '최저매물'. 상세 링크 ?grade= 에 전달. */
  priceBasis: string | null;
}

/** 어제(직전 체결일) 대비 등락률 — 일별 시세 추이의 마지막 두 점. 데이터 부족 시 null. */
function dayChangePct(trend: number[]): number | null {
  if (trend.length < 2) return null;
  const prev = trend[trend.length - 2];
  const last = trend[trend.length - 1];
  if (!(prev > 0) || !(last > 0)) return null;
  return ((last - prev) / prev) * 100;
}

export async function getMyFavoritesWithPrices(
  userId: string,
  limit = 200,
): Promise<MyFavoriteRow[]> {
  let rows: Array<{ id: number; snkrdunkApparelId: number; createdAt: Date }> = [];
  try {
    rows = await prisma.favoriteCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      select: { id: true, snkrdunkApparelId: true, createdAt: true },
    });
  } catch (err) {
    console.error('[getMyFavoritesWithPrices] db', err);
    return [];
  }
  if (rows.length === 0) return [];

  const uniqueIds = Array.from(new Set(rows.map((r) => r.snkrdunkApparelId)));
  const info = new Map<
    number,
    { name: string; imageUrl: string | null; minPriceJpy: number; priceBasis: string | null; trend: number[] }
  >();
  /** 스냅샷 → 대표 시세: 헤드라인 > raw 중앙값 > 최저매물 (시세상세와 같은 우선순위). */
  const pickPrice = (sn: NonNullable<CatalogEntry['snapshot']>) =>
    sn.headlinePrice > 0
      ? { minPriceJpy: sn.headlinePrice, priceBasis: sn.headlineBasis }
      : sn.priceSingle > 0
        ? { minPriceJpy: sn.priceSingle, priceBasis: 'RAW' }
        : { minPriceJpy: sn.minPrice, priceBasis: sn.minPrice > 0 ? '최저매물' : null };
  // 우리 DB(카탈로그+최신 스냅샷) 우선 — 신선하면 스니덩 호출 생략.
  const catalog = await loadCatalogEntries(uniqueIds);
  for (const id of uniqueIds) {
    const e = catalog.get(id);
    if (isFreshEntry(e) && e?.snapshot) {
      info.set(id, {
        name: translateKnownCardNameToKo(e.name),
        imageUrl: e.imageUrl,
        ...pickPrice(e.snapshot),
        trend: e.snapshot.trend ?? [],
      });
    }
  }
  // stale-while-revalidate — 스냅샷이 있는 카드(오래됐어도)는 즉시 그 값으로 응답하고
  // 갱신은 백그라운드로. 라이브 조회를 기다리는 건 스냅샷이 아예 없는 카드뿐.
  const staleFavIds = uniqueIds.filter((id) => !info.has(id));
  const favBlocking: number[] = [];
  for (const id of staleFavIds) {
    const e = catalog.get(id);
    if (e?.snapshot) {
      info.set(id, {
        name: translateKnownCardNameToKo(e.name),
        imageUrl: e.imageUrl,
        ...pickPrice(e.snapshot),
        trend: e.snapshot.trend ?? [],
      });
      void refreshApparelPrices(id);
    } else {
      favBlocking.push(id);
    }
  }
  await Promise.all(
    favBlocking.map(async (id) => {
      try {
        // 풀 스냅샷 경로(refreshApparelPrices) — 예전처럼 minPrice 만 기록하면 그 반쪽
        // 스냅샷이 30분간 '신선'으로 취급돼 컬렉션·팩 그리드까지 최저매물로 오염됐다.
        const r = await refreshApparelPrices(id);
        if (r) {
          info.set(id, {
            name: translateKnownCardNameToKo(r.name),
            imageUrl: r.imageUrl,
            minPriceJpy: r.headlinePrice > 0 ? r.headlinePrice : r.single > 0 ? r.single : r.minPrice,
            priceBasis: r.headlinePrice > 0 ? r.headlineBasis : r.single > 0 ? 'RAW' : r.minPrice > 0 ? '최저매물' : null,
            trend: r.trendJpy ?? [],
          });
        }
      } catch (err) {
        console.warn('[getMyFavoritesWithPrices] apparel fetch failed', id, err);
      }
    }),
  );

  return rows.map((r) => {
    const i = info.get(r.snkrdunkApparelId);
    return {
      id: r.id,
      snkrdunkApparelId: r.snkrdunkApparelId,
      createdAt: r.createdAt.toISOString(),
      name: i?.name ?? null,
      imageUrl: i?.imageUrl ?? null,
      minPriceJpy: i?.minPriceJpy ?? 0,
      priceBasis: i?.priceBasis ?? null,
      trend: i?.trend ?? [],
      // 어제(직전 체결일) 대비 등락 — 컬렉션 리스트와 같은 정의(추이 마지막 두 점).
      changePct: dayChangePct(i?.trend ?? []),
    };
  });
}

export async function getMyFeeds(userId: string, limit = 30): Promise<FeedPost[]> {
  const { items } = await getFeedPage({ authorId: userId, limit });
  return items;
}

export async function getMyTrades(userId: string, limit = 30): Promise<Trade[]> {
  try {
    const rows = await prisma.trade.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { place: { select: { name: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type as TradeType,
      title: r.title,
      place: r.place?.name ?? '',
      time: relTime(r.createdAt),
      price: r.price ?? '제안',
      kakaoId: r.kakaoId ?? null,
    }));
  } catch (err) {
    console.error('[getMyTrades]', err);
    return [];
  }
}

export async function getMyBookmarks(
  userId: string,
  limit = 30,
): Promise<{ trades: Trade[]; feeds: FeedPost[] }> {
  try {
    const rows = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        trade: { include: { place: { select: { name: true } } } },
        feed: true,
      },
    });
    const trades: Trade[] = [];
    const feeds: FeedPost[] = [];
    for (const b of rows) {
      if (b.trade) {
        trades.push({
          id: b.trade.id,
          type: b.trade.type as TradeType,
          title: b.trade.title,
          place: b.trade.place?.name ?? '',
          time: relTime(b.trade.createdAt),
          price: b.trade.price ?? '제안',
        });
      }
      if (b.feed) {
        feeds.push(toFeedPost(b.feed));
      }
    }
    return { trades, feeds };
  } catch (err) {
    console.error('[getMyBookmarks]', err);
    return { trades: [], feeds: [] };
  }
}

/* ------------------------------------------------------------------ */
/* inventory (프로필/포인트/보유 아이템)                                  */
/* ------------------------------------------------------------------ */

export interface InventorySnapshot {
  avatar: AvatarId;
  avatarOwned: AvatarId[];
  bg: BackgroundId;
  bgOwned: BackgroundId[];
  frame: FrameId;
  frameOwned: FrameId[];
  points: number;
}

const DEFAULT_INVENTORY: InventorySnapshot = {
  avatar: DEFAULT_AVATAR,
  avatarOwned: DEFAULT_OWNED,
  bg: DEFAULT_BG,
  bgOwned: [DEFAULT_BG],
  frame: DEFAULT_FRAME,
  frameOwned: [DEFAULT_FRAME],
  points: 0,
};

export async function getMyInventory(userId: string): Promise<InventorySnapshot> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u) return DEFAULT_INVENTORY;
    return {
      avatar: isAvatarId(u.avatarId) ? (u.avatarId as AvatarId) : DEFAULT_AVATAR,
      avatarOwned: u.ownedAvatars.filter(isAvatarId) as AvatarId[],
      bg: isBackgroundId(u.backgroundId) ? (u.backgroundId as BackgroundId) : DEFAULT_BG,
      bgOwned: u.ownedBackgrounds.filter(isBackgroundId) as BackgroundId[],
      frame: isFrameId(u.frameId) ? (u.frameId as FrameId) : DEFAULT_FRAME,
      frameOwned: u.ownedFrames.filter(isFrameId) as FrameId[],
      points: u.points,
    };
  } catch (err) {
    console.error('[getMyInventory]', err);
    return DEFAULT_INVENTORY;
  }
}

/* ------------------------------------------------------------------ */
/* hero banners                                                        */
/* ------------------------------------------------------------------ */

export interface HeroSlideRow {
  cls: 'slide-a' | 'slide-b' | 'slide-c' | 'slide-d';
  badge: string;
  title: string;
  sub: string;
  visualType: 'emoji' | 'image';
  visualValue: string;
  onClick: 'stamp-rally' | 'oripa' | null;
  /** 클릭 시 이동할 링크(내부 경로 또는 외부 URL). onClick 이 없을 때만 사용. */
  linkUrl: string | null;
  ctaHint: string | null;
}

const SLIDE_CLASS_SET = new Set(['slide-a', 'slide-b', 'slide-c', 'slide-d']);
const VISUAL_TYPE_SET = new Set(['emoji', 'image']);
const ON_CLICK_SET = new Set(['stamp-rally', 'oripa']);

export async function getActiveHeroBanners(): Promise<HeroSlideRow[]> {
  try {
    const rows = await prisma.heroBanner.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({
      cls: (SLIDE_CLASS_SET.has(r.slideClass) ? r.slideClass : 'slide-a') as HeroSlideRow['cls'],
      badge: r.badge,
      title: r.title,
      sub: r.sub,
      visualType: (VISUAL_TYPE_SET.has(r.visualType) ? r.visualType : 'emoji') as HeroSlideRow['visualType'],
      visualValue: r.visualValue,
      onClick: (r.onClick && ON_CLICK_SET.has(r.onClick) ? r.onClick : null) as HeroSlideRow['onClick'],
      linkUrl: r.linkUrl ?? null,
      ctaHint: r.ctaHint,
    }));
  } catch (err) {
    console.error('[getActiveHeroBanners]', err);
    return [];
  }
}
