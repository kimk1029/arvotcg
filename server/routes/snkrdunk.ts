import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { DAILY_SNAPSHOT_STATE } from '../lib/dailyPriceSnapshot.js';
import { kstDateKey, kstDayStart } from '../../shared/kst';
import {
  fetchSnkrdunkBrowse,
  fetchSnkrdunkSearch,
  fetchSnkrdunkApparel,
  fetchSnkrdunkSalesHistory,
  fetchSnkrdunkSalesChart,
  fetchSnkrdunkApparelGroup,
} from '@/lib/snkrdunk';
import {
  CATALOG_PRICE_TTL_MS,
  loadCatalogEntries,
  recordPriceSnapshot,
  refreshApparelPrices,
  upsertCatalogCard,
  upsertSearchResults,
} from '../lib/snkrdunkCatalog.js';
import { getCachedCardImageUrl } from '../lib/cardImageCache.js';
import { computeApparelPrices } from '../../shared/snkrdunkPrice';
import { parseCardStatics } from '../../shared/cardStatics';

const router = Router();

router.get('/browse', async (req: Request, res: Response) => {
  const pageRaw = Number(req.query.page ?? 1);
  const page = Math.max(1, Math.min(50, Number.isFinite(pageRaw) ? pageRaw : 1));
  const results = await fetchSnkrdunkBrowse(page);
  res.json({ page, results });
  // 목록에 노출된 카드의 정적 정보도 카탈로그에 적재 (검색과 동일, 응답 후 실패 무시).
  void upsertSearchResults(results);
});

router.get('/search', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const pageRaw = Number(req.query.page ?? 1);
  const page = Math.max(1, Math.min(50, Number.isFinite(pageRaw) ? pageRaw : 1));
  if (!q) return res.json({ page, results: [], hasMore: false });
  const results = await fetchSnkrdunkSearch(q, page);
  // 스니덩 SSR은 페이지당 결과 수가 일정치 않다(보통 <40). 결과가 하나라도 있으면
  // 다음 페이지를 시도하게 두고, 클라이언트가 "새 항목 0개"면 멈춘다.
  res.json({ page, results, hasMore: results.length > 0 });
  // 검색에 노출된 카드의 정적 정보를 카탈로그에 적재 (응답 후, 실패 무시).
  void upsertSearchResults(results);
});

// 검색 결과 배치 메타 — apparelId 별 카탈로그 스냅샷(출품수=거래 활성도 proxy)·세트코드.
// 직접입력 검색의 "거래량많은순" 정렬용. 카탈로그에 없는 카드는 응답에서 빠진다.
router.get('/catalog-entries', async (req: Request, res: Response) => {
  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 300);
  if (ids.length === 0) return res.json({ entries: {} });
  const map = await loadCatalogEntries(ids);
  const entries: Record<number, { listingCount: number | null; setCode: string | null }> = {};
  for (const [id, e] of map) {
    entries[id] = { listingCount: e.snapshot?.listingCount ?? null, setCode: e.setCode };
  }
  res.json({ entries });
});

function parseApparelId(raw: unknown, res: Response): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid apparel id' });
    return null;
  }
  return id;
}

/* ── 코드 조회 (카메라 스캔 fast path) ──────────────────────────────
 * 앱이 카드 좌하단에서 읽은 "세트코드 + 카드번호"만으로 카드를 찾는다.
 * 우리 DB(SnkrdunkCard) 우선 — 적재돼 있으면 스크레이핑 없이 즉시 응답.
 * DB 에 없을 때만 스니덩 검색("SV10 125")으로 채우고 카탈로그에 적재한다.
 * 가격은 최신 스냅샷을 그대로 주고, 오래됐으면 응답 후 백그라운드 갱신(SWR).
 */

/**
 * 번호 표기 후보.
 *   '007'   → ['007','7']       저장 표기가 padded/unpadded 둘 다라 양쪽으로 찾는다.
 *   'JP027' → ['JP027','027','27']  유희왕은 지역코드가 번호에 붙어 저장된다.
 */
function numberVariants(raw: string): string[] {
  const trimmed = raw.trim().toUpperCase();
  const out: string[] = [];
  if (trimmed) out.push(trimmed);
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits) {
    const bare = digits.replace(/^0+(?=\d)/, '');
    const padded = bare.padStart(3, '0');
    for (const v of [padded, bare]) if (!out.includes(v)) out.push(v);
  }
  return out;
}

interface CodeCard {
  apparelId: number;
  name: string;
  koName: string;
  shortName: string;
  imageUrl: string | null;
  /** 자체 CDN webp (없으면 null → imageUrl 폴백). */
  cdnImageUrl: string | null;
  setCode: string | null;
  cardNumber: string | null;
  rarity: string | null;
  game: string | null;
  minPrice: number;
  priceSingle: number;
  pricePsa10: number;
  listingCount: number;
  priceFetchedAt: string | null;
}

/** DB 에서 setCode+cardNumber 로 싱글카드를 찾아 최신 시세를 붙인다. */
async function findByCodeInDb(setCode: string, number: string, game: string): Promise<CodeCard[]> {
  const nums = numberVariants(number);
  if (nums.length === 0) return [];
  const rows = await prisma.snkrdunkCard.findMany({
    where: {
      itemKind: 'single',
      setCode: { equals: setCode, mode: 'insensitive' },
      OR: [
        ...nums.map((n) => ({ cardNumber: n })),
        // '125/098' 처럼 총매수까지 붙여 저장된 표기.
        ...nums.map((n) => ({ cardNumber: { startsWith: `${n}/` } })),
      ],
      ...(game ? { game } : {}),
    },
    take: 30,
  });
  if (rows.length === 0) return [];
  const entries = await loadCatalogEntries(rows.map((r) => r.apparelId));
  return rows.map((r) => {
    const snap = entries.get(r.apparelId)?.snapshot ?? null;
    return {
      apparelId: r.apparelId,
      name: r.localizedName || r.name,
      koName: r.koName,
      shortName: r.shortName,
      imageUrl: r.imageUrl,
      cdnImageUrl: r.cdnImageUrl,
      setCode: r.setCode,
      cardNumber: r.cardNumber,
      rarity: r.rarity,
      game: r.game || null,
      minPrice: snap?.minPrice ?? 0,
      priceSingle: snap?.priceSingle ?? 0,
      pricePsa10: snap?.pricePsa10 ?? 0,
      listingCount: snap?.listingCount ?? 0,
      priceFetchedAt: snap ? snap.fetchedAt.toISOString() : null,
    };
  });
}

router.get('/by-code', async (req: Request, res: Response) => {
  const setCode = String(req.query.setCode ?? '').trim().slice(0, 12);
  const number = String(req.query.number ?? '').trim().slice(0, 12);
  const game = String(req.query.game ?? '').trim().slice(0, 12);
  if (!setCode || !number) {
    return res.status(400).json({ cards: [], source: 'none', message: 'setCode 와 number 가 필요합니다.' });
  }

  // 1) DB 우선 — 적재돼 있으면 스크레이핑 0회.
  let cards = await findByCodeInDb(setCode, number, game);
  let source: 'db' | 'live' | 'none' = 'db';

  // 2) 없으면 스니덩 코드 검색으로 채우고 다시 DB 조회 (직접입력 검색과 같은 질의).
  if (cards.length === 0) {
    try {
      const results = await fetchSnkrdunkSearch(`${setCode} ${number}`, 1);
      if (results.length > 0) {
        await upsertSearchResults(results);
        cards = await findByCodeInDb(setCode, number, game);
        // DB 매칭이 비면 검색 결과를 그대로 쓰되, **코드가 실제로 일치하는 것만**.
        // 스니덩 검색은 'SV8A 345' 에 다른 세트의 345번(SV4a)을 섞어 주는데,
        // 스캔 결과는 그대로 컬렉션 등록으로 이어지므로 틀린 카드를 노출하면 안 된다.
        if (cards.length === 0) {
          const wanted = new Set(numberVariants(number));
          const matched = results.filter((r) => {
            const st = parseCardStatics(r.name);
            if (!st.setCode || st.setCode.toUpperCase() !== setCode.toUpperCase()) return false;
            const num = (st.cardNumber ?? '').split('/')[0].toUpperCase();
            return wanted.has(num);
          });
          const entries = await loadCatalogEntries(matched.map((r) => r.apparelId));
          cards = matched.slice(0, 30).map((r) => {
            const e = entries.get(r.apparelId);
            const snap = e?.snapshot ?? null;
            return {
              apparelId: r.apparelId,
              name: r.name,
              koName: '',
              shortName: r.name,
              imageUrl: r.imageUrl,
              cdnImageUrl: null,
              setCode: e?.setCode ?? null,
              cardNumber: null,
              rarity: null,
              game: e?.game ?? null,
              minPrice: snap?.minPrice ?? 0,
              priceSingle: snap?.priceSingle ?? 0,
              pricePsa10: snap?.pricePsa10 ?? 0,
              listingCount: snap?.listingCount ?? 0,
              priceFetchedAt: snap ? snap.fetchedAt.toISOString() : null,
            };
          });
        }
        source = cards.length > 0 ? 'live' : 'none';
      }
    } catch (err) {
      console.warn('[snkrdunk.by-code] 라이브 검색 실패', setCode, number, err);
    }
  }

  res.json({ cards, source });

  // 3) 시세가 없거나 오래된 카드는 응답 후 갱신 — "볼 때 가격이 갱신된다".
  const stale = cards
    .filter((c) => !c.priceFetchedAt || Date.now() - Date.parse(c.priceFetchedAt) > CATALOG_PRICE_TTL_MS)
    .slice(0, 8)
    .map((c) => c.apparelId);
  if (stale.length > 0) void Promise.allSettled(stale.map((id) => refreshApparelPrices(id)));
});

router.get('/apparels/:id', async (req: Request, res: Response) => {
  const apparelId = parseApparelId(req.params.id, res);
  if (apparelId === null) return;
  const data = await fetchSnkrdunkApparel(apparelId);
  if (!data) {
    return res
      .status(502)
      .json({ data: null, reason: 'SNKRDUNK 상품 정보를 가져오지 못했습니다.' });
  }
  // 이미 캐싱된 자체 CDN 이미지가 있으면 응답에 실어 보낸다(없으면 null → 원본 폴백).
  const cdnImageUrl = await getCachedCardImageUrl(apparelId);
  res.json({ data: { ...data, cdnImageUrl } });
  // 조회된 카드의 정적 정보를 우리 DB 에 적재 (응답 후, 실패 무시).
  // upsertCatalogCard 내부에서 첫 조회 시 원본→webp 캐싱도 트리거된다.
  void upsertCatalogCard(data);
  // 최신가 수집 — 싱글(raw 중앙값)/PSA10/추이까지 계산해 풀 스냅샷으로 기록.
  // (응답 후 백그라운드. 거래이력·차트 추가 조회는 사용자 응답 지연 없음.)
  void (async () => {
    try {
      const [hist, chart] = await Promise.all([
        fetchSnkrdunkSalesHistory(apparelId).catch(() => null),
        fetchSnkrdunkSalesChart(apparelId).catch(() => null),
      ]);
      const prices = computeApparelPrices(
        hist?.history ?? [],
        chart?.points ?? [],
        data.minPrice ?? 0,
      );
      if (data.minPrice > 0 || prices.single > 0 || prices.psa10 > 0) {
        await recordPriceSnapshot(apparelId, {
          minPrice: data.minPrice,
          listingCount: data.listingCount,
          priceSingle: prices.single,
          pricePsa10: prices.psa10,
          pricePsa9: prices.psa9,
          pricePsa8: prices.psa8,
          trend: prices.trendJpy,
        });
      }
    } catch (err) {
      console.error('[snkrdunk.fullsnapshot]', apparelId, err);
    }
  })();
});

router.get('/apparels/:id/sales-history', async (req: Request, res: Response) => {
  const apparelId = parseApparelId(req.params.id, res);
  if (apparelId === null) return;
  const data = await fetchSnkrdunkSalesHistory(apparelId);
  if (!data) {
    return res
      .status(502)
      .json({ data: null, reason: 'SNKRDUNK 거래 이력을 가져오지 못했습니다.' });
  }
  res.json({ data });
});

router.get('/apparel-groups/:groupId', async (req: Request, res: Response) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return res.status(400).json({ error: 'invalid groupId' });
  }
  const catRaw = Number(req.query.apparelCategoryId);
  // snkrdunk lib is typed as 25 | 14. Only honor those values.
  const apparelCategoryId: 14 | 25 | undefined =
    catRaw === 14 ? 14 : catRaw === 25 ? 25 : undefined;
  const pageRaw = Number(req.query.page ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const perPageRaw = Number(req.query.perPage ?? 24);
  const perPage = Math.max(1, Math.min(50, Number.isFinite(perPageRaw) ? perPageRaw : 24));
  try {
    const data = await fetchSnkrdunkApparelGroup(groupId, {
      apparelCategoryId,
      page,
      perPage,
    });
    if (!data) return res.json({ data: null });
    res.json({ data });
    // 그룹(팩/박스) 목록에 노출된 카드도 카탈로그에 적재 — 원피스 등 비포켓몬 게임 포함.
    // 카탈로그에 들어가면 일일 스냅샷 배치가 매일 가격을 쌓는다. (응답 후, 실패 무시)
    void (async () => {
      for (const a of data.apparels) {
        await upsertCatalogCard(a, { apparelGroupId: groupId });
      }
    })();
  } catch (err) {
    console.error('[snkrdunk.apparel-group]', err);
    res.status(500).json({ data: null, error: 'internal' });
  }
});

/** 일일 스냅샷 배치 진행 상태 — 배포 후 스모크/모니터링용 (읽기 전용). */
router.get('/daily-snapshot-status', (_req: Request, res: Response) => {
  res.json({ ...DAILY_SNAPSHOT_STATE });
});

/**
 * 가격 통계 — 스냅샷을 KST 일 단위로 집계한 일별 시리즈 + 1일/7일/30일 평균.
 * 일별 값 = 그날 스냅샷들의 평균(0 = 미계산 스냅샷은 제외). 기간 평균 = 일별 값의 평균
 * (스냅샷 개수 가중이 아니라 "하루 1표" — 조회 많은 날에 통계가 쏠리지 않게).
 * GET /api/snkrdunk/apparels/:id/price-stats?days=30 (기본 30, 최대 90)
 */
router.get('/apparels/:id/price-stats', async (req: Request, res: Response) => {
  const apparelId = parseApparelId(req.params.id, res);
  if (apparelId === null) return;
  const daysRaw = Number(req.query.days ?? 30);
  const days = Math.max(1, Math.min(90, Number.isFinite(daysRaw) ? Math.round(daysRaw) : 30));
  try {
    const since = new Date(kstDayStart().getTime() - (days - 1) * 86_400_000);
    const rows = await prisma.$queryRaw<
      Array<{
        day: string;
        single: number | null;
        minPrice: number | null;
        psa10: number | null;
        samples: number;
      }>
    >`
      SELECT
        to_char("fetchedAt" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day,
        AVG(NULLIF("priceSingle", 0))::float  AS single,
        AVG(NULLIF("minPrice", 0))::float     AS "minPrice",
        AVG(NULLIF("pricePsa10", 0))::float   AS psa10,
        COUNT(*)::int                          AS samples
      FROM "snkrdunk_price_snapshots"
      WHERE "apparelId" = ${apparelId} AND "fetchedAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;
    const daily = rows.map((r) => ({
      date: r.day,
      single: r.single ? Math.round(r.single) : 0,
      minPrice: r.minPrice ? Math.round(r.minPrice) : 0,
      psa10: r.psa10 ? Math.round(r.psa10) : 0,
      samples: Number(r.samples),
    }));
    // 기간 평균: 최근 N일(달력 기준, KST) 중 값이 있는 날들의 평균. 값이 하루도 없으면 0.
    const avgOver = (n: number, pick: (d: (typeof daily)[number]) => number): number => {
      const cutoff = kstDateKey(kstDayStart().getTime() - (n - 1) * 86_400_000);
      const vals = daily.filter((d) => d.date >= cutoff).map(pick).filter((v) => v > 0);
      return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    };
    const statsFor = (pick: (d: (typeof daily)[number]) => number) => ({
      today: avgOver(1, pick),
      avg7d: avgOver(7, pick),
      avg30d: avgOver(30, pick),
    });
    res.json({
      apparelId,
      days,
      daily,
      stats: {
        single: statsFor((d) => d.single),
        minPrice: statsFor((d) => d.minPrice),
        psa10: statsFor((d) => d.psa10),
      },
    });
  } catch (err) {
    console.error('[snkrdunk.price-stats]', apparelId, err);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/apparels/:id/sales-chart', async (req: Request, res: Response) => {
  const apparelId = parseApparelId(req.params.id, res);
  if (apparelId === null) return;
  const data = await fetchSnkrdunkSalesChart(apparelId);
  if (!data) {
    return res
      .status(502)
      .json({ data: null, reason: 'SNKRDUNK 시세 차트를 가져오지 못했습니다.' });
  }
  res.json({ data });
});

export default router;
