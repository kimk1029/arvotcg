/**
 * 팩별 힛카드 해석기.
 *
 * 흐름:
 *   1) 큐레이션된 `pack.hits` apparelId 들로 snkrdunk 아이템을 동시에 조회
 *   2) 결과가 limit 보다 적으면 `pack.searchQuery` 로 snkrdunk 검색 → 부족분 채움
 *   3) 동일 apparelId 중복 제거
 *
 * snkrdunk 응답은 [[fetchSnkrdunkApparel]] 단에서 이미 `next.revalidate` 로
 * 캐싱되므로, 본 함수는 추가 캐싱 없이 직접 호출. 단 동시성은 N (=6) 으로
 * 제한해 단일 요청에서 snkrdunk 서버를 과도하게 두드리지 않게 한다.
 */
import { CARD_PACKS, type CardPackMeta, getCardPack } from '@/lib/cardPacks';
import { translateKnownCardNameToKo } from '../../shared/cardTranslate';
import { shortenName } from '../../shared/util/shortenName';
import {
  fetchAllSnkrdunkApparelGroup,
  fetchSnkrdunkApparel,
  fetchSnkrdunkApparelGroup,
  fetchSnkrdunkSalesHistory,
  fetchSnkrdunkSearch,
} from '@/lib/snkrdunk';
// shared 정본 심볼은 shim 의 `export *` 를 거치면 tsx CJS interop 이 이름을 못 봐
// 부팅이 죽는다(NAS) — 반드시 shared 에서 직접 import (89476c9 와 동일).
import {
  localizeSnkrdunkText,
  type SnkrdunkApparel,
  type SnkrdunkItemKind,
} from '../../shared/snkrdunk';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/** 시세 갱신 주기 — 박스의 마지막 갱신(SnkrdunkCard.updatedAt)이 이 시간 이내면 DB 캐시를 그대로 쓴다. */
const PRICE_STALE_MS = 24 * 60 * 60 * 1000;

export interface PackHitCard {
  apparelId: number;
  name: string;
  koName: string;
  itemKind: SnkrdunkItemKind;
  /** UI에 노출할 짧은 한국어/일본어 라벨. snkrdunk 응답에서 정리. */
  shortName: string;
  imageUrl: string | null;
  /** 일본엔 (JPY) 최저 매물 호가. 0 이면 매물 없음. */
  minPrice: number;
  /** 시세상세 헤드라인과 동일한 대표 시세(JPY). 0 이면 미계산 → minPrice 로 폴백. */
  headlinePrice: number;
  /** 대표 시세의 기준 등급 ('PSA 10' | 'PSA 9' | 'RAW'). 목록 라벨용. */
  headlineBasis: string | null;
  displayPrice: string;
  listingCount: number;
  listingCountText: string;
  productNumber: string;
  lastSalePrice: number;
  lastSaleText: string;
  lastSaleSort: number;
}

export interface PackWithHits {
  code: string;
  name: string;
  shortName: string;
  emoji: string;
  bg: string;
  releasedAt?: string;
  boxImageUrl: string | null;
  boxName: string | null;
  boxKoName: string | null;
  hits: PackHitCard[];
}

const DEFAULT_LIMIT = 12;
const CONCURRENCY = 6;
/** DB 적재 시 가져오는 최대 카드 수 — 호출 limit 과 무관하게 박스 전체를 채우기 위함. */
const FETCH_LIMIT = 600;

/** 일본 이름에서 너무 긴 부분 잘라 짧은 라벨로 변환. DashboardScreen 의 shortenName 과 동일 패턴. */

function toHitCard(a: SnkrdunkApparel, override?: string): PackHitCard {
  return {
    apparelId: a.id,
    name: a.localizedName || a.name,
    koName: translateKnownCardNameToKo(a.localizedName || a.name),
    itemKind: a.itemKind,
    shortName: override ?? shortenName(a.localizedName || a.name),
    imageUrl: a.imageUrl,
    minPrice: a.minPrice,
    // 라이브(검색) 경로는 거래이력을 안 받아 헤드라인 계산 불가 → 목록은 minPrice 로 폴백하고,
    // 상세 조회/일별 배치가 스냅샷에 헤드라인을 채우면 다음 목록부터 상세와 값이 일치한다.
    headlinePrice: 0,
    headlineBasis: null,
    displayPrice: a.displayPrice,
    listingCount: a.listingCount,
    listingCountText: a.listingCountText,
    productNumber: a.productNumber,
    lastSalePrice: 0,
    lastSaleText: '',
    lastSaleSort: 0,
  };
}

function saleRecencyScore(value: string): number {
  const m = value.match(/(\d+)\s*(分前|時間前|日前|週間前|ヶ月前|年前)/);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  const unit = m[2];
  const minutes =
    unit === '分前' ? n :
    unit === '時間前' ? n * 60 :
    unit === '日前' ? n * 60 * 24 :
    unit === '週間前' ? n * 60 * 24 * 7 :
    unit === 'ヶ月前' ? n * 60 * 24 * 30 :
    n * 60 * 24 * 365;
  return Math.max(1, 10_000_000 - minutes);
}

async function withLatestSale(hit: PackHitCard): Promise<PackHitCard> {
  const history = await fetchSnkrdunkSalesHistory(hit.apparelId);
  const latest = history?.history?.[0];
  if (!latest) return hit;
  return {
    ...hit,
    lastSalePrice: latest.price,
    lastSaleText: localizeSnkrdunkText(latest.date),
    lastSaleSort: saleRecencyScore(latest.date),
  };
}

/** 동시 실행 cap 가진 map. */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function resolveCurated(pack: CardPackMeta): Promise<PackHitCard[]> {
  // hits 는 optional — 큐레이션 없는 팩(검색 폴백 전용, groupId 0)도 안전하게.
  if (!pack.hits || pack.hits.length === 0) return [];
  const results = await mapWithLimit(pack.hits, CONCURRENCY, async (h) => {
    const a = await fetchSnkrdunkApparel(h.apparelId);
    if (!a) return null;
    return toHitCard(a, h.label);
  });
  return results.filter((x): x is PackHitCard => x !== null);
}

async function resolveSearchFill(
  pack: CardPackMeta,
  alreadyIds: Set<number>,
  need: number,
): Promise<PackHitCard[]> {
  if (need <= 0) return [];
  // 검색 결과는 그 자체로 minPrice 등을 안 줘서, 각 apparelId 마다 다시 fetch.
  // need * 검색페이지 결과 수만큼 호출되니, 페이지 1만 가져와서 상위에서 채운다.
  const results = await fetchSnkrdunkSearch(pack.searchQuery, 1);
  const pool = results.filter((r) => !alreadyIds.has(r.apparelId)).slice(0, need * 2);
  const hydrated = await mapWithLimit(pool, CONCURRENCY, async (r) => {
    const a = await fetchSnkrdunkApparel(r.apparelId);
    return a ? toHitCard(a) : null;
  });
  return hydrated.filter((x): x is PackHitCard => x !== null).slice(0, need);
}

async function resolveGroupSingles(pack: CardPackMeta, limit: number): Promise<PackHitCard[]> {
  if (!pack.apparelGroupId) return [];
  const items = await fetchAllSnkrdunkApparelGroup(pack.apparelGroupId, {
    apparelCategoryId: 25,
    maxItems: Math.max(limit, 100),
  });
  // 우선 매물 있는 카드만. 신규팩처럼 매물 0 인 경우엔 전부 노출 (UI 가 '시세 없음' 표시).
  const priced = items.filter((a) => a.minPrice > 0);
  const pool = priced.length > 0 ? priced : items;
  return pool.map((a) => toHitCard(a)).slice(0, limit);
}

async function resolveGroupBoxes(pack: CardPackMeta): Promise<PackHitCard[]> {
  if (!pack.apparelGroupId) return [];
  const page = await fetchSnkrdunkApparelGroup(pack.apparelGroupId, {
    apparelCategoryId: 14,
    page: 1,
    perPage: 10,
  });
  return (page?.apparels ?? [])
    .filter((a) => a.minPrice > 0)
    .map((a) => toHitCard(a));
}

/** 정적 카드 행(SnkrdunkCard) + 최신 시세 → PackHitCard. lastSale 은 DB 캐시 대상이 아님. */
type SnkrdunkCardRow = Awaited<ReturnType<typeof prisma.snkrdunkCard.findMany>>[number];
interface LatestPrice { minPrice: number; listingCount: number; headlinePrice: number; headlineBasis: string | null; }

function toHitCardFromDb(row: SnkrdunkCardRow, price?: LatestPrice): PackHitCard {
  const minPrice = price?.minPrice ?? 0;
  const listingCount = price?.listingCount ?? 0;
  return {
    apparelId: row.apparelId,
    name: row.name,
    koName: row.koName,
    itemKind: row.itemKind === 'box' ? 'box' : 'single',
    shortName: row.shortName,
    imageUrl: row.imageUrl,
    minPrice,
    headlinePrice: price?.headlinePrice ?? 0,
    headlineBasis: price?.headlineBasis ?? null,
    displayPrice: '', // UI 는 시세를 자체 포맷 → 캐시엔 불필요
    listingCount,
    listingCountText: listingCount > 0 ? String(listingCount) : '',
    productNumber: row.productNumber,
    lastSalePrice: 0,
    lastSaleText: '',
    lastSaleSort: 0,
  };
}

/** apparelId 별 '최신' 시세 스냅샷 = 현재가. (Postgres DISTINCT ON) DB 오류 시 빈 맵. */
async function latestPrices(ids: number[]): Promise<Map<number, LatestPrice>> {
  const map = new Map<number, LatestPrice>();
  if (ids.length === 0) return map;
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        apparelId: number; minPrice: number; listingCount: number;
        headlinePrice: number; headlineBasis: string | null;
      }>
    >`
      SELECT DISTINCT ON ("apparelId")
        "apparelId", "minPrice", "listingCount", "headlinePrice", "headlineBasis"
      FROM "snkrdunk_price_snapshots"
      WHERE "apparelId" IN (${Prisma.join(ids)})
      ORDER BY "apparelId", "fetchedAt" DESC
    `;
    for (const r of rows) {
      map.set(Number(r.apparelId), {
        minPrice: Number(r.minPrice),
        listingCount: Number(r.listingCount),
        headlinePrice: Number(r.headlinePrice ?? 0),
        headlineBasis: r.headlineBasis ?? null,
      });
    }
  } catch (err) {
    console.error('[cardPackHits.latestPrices]', err);
  }
  return map;
}

/** 서빙용 선별·정렬: 싱글(시세 desc, limit 적용) → 매물 있는 박스(시세 desc, 뒤에 붙임). */
function selectHits(hits: PackHitCard[], limit: number): PackHitCard[] {
  const singles = hits
    .filter((h) => h.itemKind !== 'box')
    .sort((a, b) => b.minPrice - a.minPrice)
    .slice(0, limit);
  const boxes = hits
    .filter((h) => h.itemKind === 'box' && h.minPrice > 0)
    .sort((a, b) => b.minPrice - a.minPrice);
  return [...singles, ...boxes];
}

/**
 * 박스의 DB 카드가 신선하면(마지막 갱신 < 24h) PackHitCard[] 로 반환, 아니면 null.
 * 신선도 기준 = 박스 카드들의 updatedAt 최댓값(= 마지막 전체 갱신 시각).
 *   → 시세 없는 카드만 있는 신규 박스도 정상 판정(스냅샷 유무에 의존 안 함).
 * 현재가는 apparelId 별 최신 스냅샷에서 가져온다. DB 오류 시 null(=라이브 폴백).
 */
async function loadFreshPackHits(packCode: string, limit: number): Promise<PackHitCard[] | null> {
  try {
    const cards = await prisma.snkrdunkCard.findMany({ where: { packCode } });
    if (cards.length === 0) return null;
    let maxTs = 0;
    for (const c of cards) {
      const t = c.updatedAt.getTime();
      if (t > maxTs) maxTs = t;
    }
    if (Date.now() - maxTs >= PRICE_STALE_MS) return null;
    const prices = await latestPrices(cards.map((c) => c.apparelId));
    const hits = cards.map((c) => toHitCardFromDb(c, prices.get(c.apparelId)));
    return selectHits(hits, limit);
  } catch (err) {
    console.error('[cardPackHits.loadFresh]', err);
    return null;
  }
}

/**
 * 적재 — 정적 카드 정보는 SnkrdunkCard 에 upsert(누적·갱신, updatedAt=now),
 * 시세는 매물 있는 카드만 SnkrdunkPriceSnapshot 에 한 줄씩 append(현재가 = 최신 스냅샷).
 * DB 실패는 응답에 영향 주지 않도록 삼켜 로깅만 한다.
 */
async function persistPackCards(pack: CardPackMeta, hits: PackHitCard[]): Promise<void> {
  if (hits.length === 0) return;
  try {
    await mapWithLimit(hits, CONCURRENCY, async (h) => {
      const data = {
        name: h.name,
        localizedName: h.name,
        koName: h.koName,
        itemKind: h.itemKind,
        shortName: h.shortName,
        imageUrl: h.imageUrl,
        productNumber: h.productNumber,
        releasedAt: pack.releasedAt ?? null,
        packCode: pack.code,
        apparelGroupId: pack.apparelGroupId ?? null,
      };
      await prisma.snkrdunkCard.upsert({
        where: { apparelId: h.apparelId },
        create: { apparelId: h.apparelId, ...data },
        update: data,
      });
    });
    const snaps = hits
      .filter((h) => h.minPrice > 0)
      .map((h) => ({ apparelId: h.apparelId, minPrice: h.minPrice, listingCount: h.listingCount }));
    if (snaps.length > 0) {
      await prisma.snkrdunkPriceSnapshot.createMany({ data: snaps });
    }
  } catch (err) {
    console.error('[cardPackHits.persist]', err);
  }
}

function buildPack(pack: CardPackMeta, hits: PackHitCard[]): PackWithHits {
  const box = hits.find((h) => h.itemKind === 'box') ?? null;
  return {
    code: pack.code,
    name: pack.name,
    shortName: pack.shortName,
    emoji: pack.emoji,
    bg: pack.bg,
    releasedAt: pack.releasedAt,
    boxImageUrl: box?.imageUrl ?? null,
    boxName: box?.name ?? null,
    boxKoName: box?.koName ?? null,
    hits,
  };
}

export async function getPackWithHits(
  code: string,
  limit: number = DEFAULT_LIMIT,
  opts: { includeSales?: boolean } = {},
): Promise<PackWithHits | null> {
  const pack = getCardPack(code);
  if (!pack) return null;

  // 1) DB 우선 — 박스 시세가 24h 이내면 스니덩 호출 없이 즉시 응답.
  //    (sales 포함 요청은 라이브 데이터가 필요하므로 캐시를 건너뛴다.)
  if (!opts.includeSales) {
    const cached = await loadFreshPackHits(pack.code, limit);
    if (cached) return buildPack(pack, cached);
  }

  // 2) 라이브 fetch — 적재는 항상 넓게(FETCH_LIMIT) 가져와, 호출 limit 과 무관하게 박스
  //    전체를 DB 에 채운다. (작은 limit 호출이 먼저 DB 를 얇게 채워 박스 상세를 굶기지 않도록.)
  const groupedSingles = await resolveGroupSingles(pack, FETCH_LIMIT);
  const groupedBoxes = await resolveGroupBoxes(pack);
  const grouped = [...groupedSingles, ...groupedBoxes];
  const allHits = grouped.length > 0
    ? grouped
    : await (async () => {
      const curated = await resolveCurated(pack);
      const seen = new Set<number>(curated.map((c) => c.apparelId));
      const need = Math.max(0, FETCH_LIMIT - curated.length);
      const filled = need > 0 ? await resolveSearchFill(pack, seen, need) : [];
      return [...curated, ...filled];
    })();

  // includeSales 는 캐시 대상이 아니므로 limit 만큼만 추려 sales 를 붙인다(불필요한 호출 방지).
  if (opts.includeSales) {
    const enriched = await mapWithLimit(selectHits(allHits, limit), CONCURRENCY, withLatestSale);
    return buildPack(pack, enriched);
  }

  // 3) DB 적재(전체) 후 limit 만큼 서빙. 적재 실패는 응답에 영향 없음.
  await persistPackCards(pack, allHits);
  return buildPack(pack, selectHits(allHits, limit));
}

export async function getAllPacksWithHits(
  limit: number = DEFAULT_LIMIT,
): Promise<PackWithHits[]> {
  // 팩끼리는 직렬로 처리 — 각 팩 내부는 이미 동시성 cap 적용됨.
  // (전부 병렬화하면 한 요청에서 snkrdunk 에 ~100 동시 요청이 발생할 수 있음.)
  const out: PackWithHits[] = [];
  for (const p of CARD_PACKS) {
    const r = await getPackWithHits(p.code, limit);
    if (r) out.push(r);
  }
  return out;
}
