/**
 * SNKRDUNK 마스터 카드 카탈로그 — "우리 DB 우선" 적재/조회 헬퍼.
 *
 * 정책:
 *   - 카드의 *변하지 않는* 정보(이름/이미지/세트코드/카드번호/레어도 등)는
 *     SnkrdunkCard 한 행에 누적 upsert. apparelId 가 곧 스니덩 링크
 *     (snkrdunk.com/apparels/{apparelId}).
 *   - 가격은 SnkrdunkPriceSnapshot 에 append-only — 현재가 = 최신 행.
 *   - 조회는 DB 우선: 최신 스냅샷이 TTL 이내면 스니덩을 호출하지 않는다.
 *
 * 모든 DB 쓰기는 응답에 영향 주지 않게 삼키고 로깅만 한다.
 */
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { ensureCardImage } from './cardImageCache.js';
import { translateKnownCardNameToKo } from '../../shared/cardTranslate';
import { shortenName } from '../../shared/util/shortenName';
import {
  fetchSnkrdunkApparel,
  fetchSnkrdunkSalesChart,
  fetchSnkrdunkSalesHistory,
  type SnkrdunkApparel,
} from '@/lib/snkrdunk';
import { computeApparelPrices, type ApparelPrices } from '../../shared/snkrdunkPrice';
import { parseCardStatics } from '../../shared/cardStatics';

export { parseCardStatics } from '../../shared/cardStatics';
export type { ParsedCardStatics, CardGame } from '../../shared/cardStatics';

/** 컬렉션/즐겨찾기 시세 신선 기준 — 이 시간 이내 스냅샷이면 라이브 호출 생략. */
export const CATALOG_PRICE_TTL_MS = 30 * 60 * 1000;


/* ── 적재 (upsert / append) ──────────────────────────────────────── */

/** apparel 상세 1건의 정적 정보를 카탈로그에 upsert. 실패는 로깅만. */
export async function upsertCatalogCard(
  a: SnkrdunkApparel,
  extra: { packCode?: string; apparelGroupId?: number | null } = {},
): Promise<void> {
  try {
    const jp = a.localizedName || a.name || '';
    const statics = parseCardStatics(jp, a.productNumber);
    const base = {
      name: a.name ?? '',
      localizedName: jp,
      koName: translateKnownCardNameToKo(jp),
      itemKind: a.itemKind,
      shortName: shortenName(jp),
      imageUrl: a.imageUrl,
      productNumber: a.productNumber ?? '',
      releasedAt: a.releasedAt ? a.releasedAt.slice(0, 10) : undefined,
      ...(extra.packCode ? { packCode: extra.packCode } : {}),
      ...(extra.apparelGroupId ? { apparelGroupId: extra.apparelGroupId } : {}),
    };
    await prisma.snkrdunkCard.upsert({
      where: { apparelId: a.id },
      create: {
        apparelId: a.id,
        ...base,
        game: statics.game,
        setCode: statics.setCode,
        cardNumber: statics.cardNumber,
        rarity: statics.rarity,
      },
      // 파싱 성공한 필드만 갱신 — 이전에 채워진 세트코드/카드번호를 null 로 덮지 않게.
      update: {
        ...base,
        ...(statics.game !== 'other' ? { game: statics.game } : {}),
        ...(statics.setCode ? { setCode: statics.setCode } : {}),
        ...(statics.cardNumber ? { cardNumber: statics.cardNumber } : {}),
        ...(statics.rarity ? { rarity: statics.rarity } : {}),
      },
    });
    // 원본 이미지를 자체 CDN(webp)으로 1회 캐싱 — 응답 막지 않음.
    void ensureCardImage(a.id, a.imageUrl);
  } catch (err) {
    console.error('[snkrdunkCatalog.upsert]', a.id, err);
  }
}

/**
 * 검색 결과(이름/이미지만 있는 얕은 데이터)를 카탈로그에 적재.
 * 이미 있는 행의 itemKind/품번 등 풍부한 정보는 건드리지 않는다.
 */
export async function upsertSearchResults(
  results: Array<{ apparelId: number; name: string; imageUrl: string | null }>,
): Promise<void> {
  try {
    for (const r of results) {
      const statics = parseCardStatics(r.name);
      await prisma.snkrdunkCard.upsert({
        where: { apparelId: r.apparelId },
        create: {
          apparelId: r.apparelId,
          name: r.name,
          localizedName: r.name,
          koName: translateKnownCardNameToKo(r.name),
          shortName: shortenName(r.name),
          imageUrl: r.imageUrl,
          game: statics.game,
          setCode: statics.setCode,
          cardNumber: statics.cardNumber,
          rarity: statics.rarity,
        },
        // 얕은 데이터로 기존 행을 덮지 않게 — 이미지/이름 + 비어있던 정적정보만 보강.
        update: {
          localizedName: r.name,
          koName: translateKnownCardNameToKo(r.name),
          ...(r.imageUrl ? { imageUrl: r.imageUrl } : {}),
          ...(statics.game !== 'other' ? { game: statics.game } : {}),
          ...(statics.setCode ? { setCode: statics.setCode } : {}),
          ...(statics.cardNumber ? { cardNumber: statics.cardNumber } : {}),
          ...(statics.rarity ? { rarity: statics.rarity } : {}),
        },
      });
      // 검색에 노출된 카드 이미지도 자체 CDN 으로 캐싱(있을 때만).
      if (r.imageUrl) void ensureCardImage(r.apparelId, r.imageUrl);
    }
  } catch (err) {
    console.error('[snkrdunkCatalog.upsertSearch]', err);
  }
}

/** 시세 스냅샷 append. priceSingle/pricePsa10/trend 는 계산된 경우에만. */
export async function recordPriceSnapshot(
  apparelId: number,
  price: {
    minPrice: number;
    listingCount?: number;
    priceSingle?: number;
    pricePsa10?: number;
    pricePsa9?: number;
    pricePsa8?: number;
    trend?: number[];
    /** 시세상세 헤드라인과 동일한 대표 시세 + 기준 등급 (목록·상세 값 일치용). */
    headlinePrice?: number;
    headlineBasis?: string;
  },
): Promise<void> {
  try {
    await prisma.snkrdunkPriceSnapshot.create({
      data: {
        apparelId,
        minPrice: Math.max(0, Math.round(price.minPrice || 0)),
        listingCount: price.listingCount ?? 0,
        priceSingle: Math.max(0, Math.round(price.priceSingle ?? 0)),
        pricePsa10: Math.max(0, Math.round(price.pricePsa10 ?? 0)),
        pricePsa9: Math.max(0, Math.round(price.pricePsa9 ?? 0)),
        pricePsa8: Math.max(0, Math.round(price.pricePsa8 ?? 0)),
        headlinePrice: Math.max(0, Math.round(price.headlinePrice ?? 0)),
        headlineBasis: price.headlineBasis ?? null,
        trend: price.trend && price.trend.length > 0 ? price.trend : Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error('[snkrdunkCatalog.snapshot]', apparelId, err);
  }
}

/**
 * 카탈로그에 없는 apparelId 면 스니덩에서 1회 조회해 적재.
 * 컬렉션 추가 등 "이 카드가 우리 DB 에 꼭 있어야 하는" 시점에 호출.
 */
export async function ensureCatalogCard(apparelId: number): Promise<void> {
  try {
    // 카드 행 + 시세 스냅샷이 **둘 다** 있어야 "우리 DB 에 있다"고 본다.
    // 행만 있고 스냅샷이 없는 카드(검색 결과 적재분이 그렇다)는 컬렉션 조회에서
    // blocking 라이브 조회 대상이 되어 로딩을 잡아먹는다.
    const [row, snap] = await Promise.all([
      prisma.snkrdunkCard.findUnique({ where: { apparelId }, select: { apparelId: true } }),
      prisma.snkrdunkPriceSnapshot.findFirst({
        where: { apparelId },
        select: { id: true },
        orderBy: { fetchedAt: 'desc' },
      }),
    ]);
    if (row && snap) return;
    // 정적 정보 + 풀 시세(싱글/PSA10/추이)를 한 번에 적재 — 라이브 갱신과 같은 경로.
    await refreshApparelPrices(apparelId);
  } catch (err) {
    console.error('[snkrdunkCatalog.ensure]', apparelId, err);
  }
}

/* ── 조회 (DB 우선) ──────────────────────────────────────────────── */

export interface CatalogEntry {
  apparelId: number;
  name: string;
  imageUrl: string | null;
  /** 소속 박스 코드 (CARD_PACKS.code). 시리즈 비중 산출용. 없으면 null. */
  packCode: string | null;
  /** 파싱된 세트 코드 (예: "SV4a"). 시리즈 폴백용. 없으면 null. */
  setCode: string | null;
  /** 카드 게임 종류 ('pokemon'|'onepiece'|'yugioh'|'other'). 미분류면 null. */
  game: string | null;
  /** 최신 스냅샷 — 없으면 null. */
  snapshot: {
    minPrice: number;
    listingCount: number;
    priceSingle: number;
    pricePsa10: number;
    pricePsa9: number;
    pricePsa8: number;
    trend: number[];
    fetchedAt: Date;
  } | null;
}

/** 카탈로그 행 + apparelId 별 최신 시세 스냅샷을 한 번에 로드. */
export async function loadCatalogEntries(ids: number[]): Promise<Map<number, CatalogEntry>> {
  const map = new Map<number, CatalogEntry>();
  if (ids.length === 0) return map;
  try {
    const [cards, snaps] = await Promise.all([
      prisma.snkrdunkCard.findMany({ where: { apparelId: { in: ids } } }),
      prisma.$queryRaw<
        Array<{
          apparelId: number;
          minPrice: number;
          listingCount: number;
          priceSingle: number;
          pricePsa10: number;
          pricePsa9: number;
          pricePsa8: number;
          trend: unknown;
          fetchedAt: Date;
        }>
      >`
        SELECT DISTINCT ON ("apparelId")
          "apparelId", "minPrice", "listingCount", "priceSingle", "pricePsa10", "pricePsa9", "pricePsa8", "trend", "fetchedAt"
        FROM "snkrdunk_price_snapshots"
        WHERE "apparelId" IN (${Prisma.join(ids)})
        ORDER BY "apparelId", "fetchedAt" DESC
      `,
    ]);
    const snapById = new Map<number, (typeof snaps)[number]>(
      snaps.map((s) => [Number(s.apparelId), s]),
    );
    for (const c of cards) {
      const s = snapById.get(c.apparelId);
      map.set(c.apparelId, {
        apparelId: c.apparelId,
        name: c.localizedName || c.name,
        // 캐싱된 자체 CDN webp 우선, 없으면 원본 imageUrl 로 폴백.
        imageUrl: c.cdnImageUrl ?? c.imageUrl,
        packCode: c.packCode ?? null,
        setCode: c.setCode ?? null,
        game: c.game || null,
        snapshot: s
          ? {
              minPrice: Number(s.minPrice),
              listingCount: Number(s.listingCount),
              priceSingle: Number(s.priceSingle),
              pricePsa10: Number(s.pricePsa10),
              pricePsa9: Number(s.pricePsa9 ?? 0),
              pricePsa8: Number(s.pricePsa8 ?? 0),
              trend: Array.isArray(s.trend) ? (s.trend as number[]) : [],
              fetchedAt: s.fetchedAt,
            }
          : null,
      });
    }
  } catch (err) {
    console.error('[snkrdunkCatalog.load]', err);
  }
  return map;
}

/** 스냅샷이 신선하고(시세 TTL 이내) 가격 계산이 있는 엔트리인지. */
export function isFreshEntry(e: CatalogEntry | undefined, ttlMs = CATALOG_PRICE_TTL_MS): boolean {
  if (!e || !e.snapshot) return false;
  if (Date.now() - e.snapshot.fetchedAt.getTime() > ttlMs) return false;
  // priceSingle 까지 계산된 풀 스냅샷만 신선 취급 — 목록 수집 스냅샷(minPrice만)으로
  // 컬렉션 시세를 대체하면 PSA10/차트가 비어버린다.
  return e.snapshot.priceSingle > 0 || e.snapshot.minPrice > 0;
}

/* ── 라이브 갱신 (stale-while-revalidate 공용) ───────────────────── */

export interface RefreshedApparel extends ApparelPrices {
  name: string;
  imageUrl: string | null;
  minPrice: number;
}

/**
 * apparel 1건을 라이브 조회해 시세 계산(computeApparelPrices) 후 카탈로그·스냅샷에
 * 적재하고 결과를 돌려준다. 컬렉션/포트폴리오가 같은 규칙으로 쓰는 단일 갱신 경로 —
 * 응답을 막는 자리(스냅샷 자체가 없는 카드)와 백그라운드 갱신 자리 모두 이걸 쓴다.
 */
export async function refreshApparelPrices(apparelId: number): Promise<RefreshedApparel | null> {
  try {
    const [a, hist, chart] = await Promise.all([
      fetchSnkrdunkApparel(apparelId),
      fetchSnkrdunkSalesHistory(apparelId).catch(() => null),
      fetchSnkrdunkSalesChart(apparelId).catch(() => null),
    ]);
    if (!a) return null;
    const prices = computeApparelPrices(hist?.history ?? [], chart?.points ?? [], a.minPrice ?? 0);
    void upsertCatalogCard(a);
    void recordPriceSnapshot(apparelId, {
      minPrice: a.minPrice ?? 0,
      listingCount: a.listingCount,
      priceSingle: prices.single,
      pricePsa10: prices.psa10,
      pricePsa9: prices.psa9,
      pricePsa8: prices.psa8,
      trend: prices.trendJpy,
    });
    return {
      ...prices,
      name: a.localizedName || a.name || '',
      imageUrl: a.imageUrl,
      minPrice: a.minPrice ?? 0,
    };
  } catch (err) {
    console.warn('[snkrdunkCatalog.refresh]', apparelId, err);
    return null;
  }
}
