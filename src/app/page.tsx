import { type SnkrdunkRow, type SnkrdunkCategory } from '@/components/dashboard/DashboardScreen';
import { HomeRouter } from '@/components/dashboard/HomeRouter';
import { getServerUser, serverFetch } from '@/lib/apiServer';
import type { HeroSlideData } from '@/components/HeroSlider';
import { SNKRDUNK_FEATURED_CARDS, type SnkrdunkCardSeed } from '@/lib/snkrdunkCards';
import { translateKnownCardNameToKo } from '@/lib/cardTranslate';
import { classifySnkrdunkName, type SnkrdunkSalesHistory } from '@/lib/snkrdunk';
import { trendChangePct, headlineFromHistory } from '@/lib/snkrdunkPrice';
import { shortenName } from '../../shared/util/shortenName';
import { CARD_PACKS } from '@/lib/cardPacks';
import { fetchMvcAuctionPage, type MvcAuctionItem } from '@/lib/navercafe';

export const dynamic = 'force-dynamic';

interface SnkrdunkSearchResult {
  apparelId: number;
  name: string;
  imageUrl: string | null;
  priceText: string;
}

interface ApparelDetail {
  apparelId: number;
  name: string;
  /** snkrdunk 일본어 원문. (인기카드 카드 아래 작은 글씨 노출에 사용) */
  localizedName?: string;
  /** 상세 분류 — 이름 휴리스틱보다 정확. HOT 카드 박스 제외에 사용. */
  itemKind?: 'single' | 'box';
  imageUrl: string | null;
  minPrice: number;
  listingCountText: string;
}

const FEATURED_BY_ID = new Map(SNKRDUNK_FEATURED_CARDS.map((s) => [s.apparelId, s]));

function inferCategory(name: string): SnkrdunkCategory | null {
  if (/プロモ|PROMO/i.test(name)) return '프로모';
  if (/\bSAR\b/.test(name)) return 'SAR';
  if (/\bSR\b/.test(name)) return 'SR';
  return null;
}


function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface SnkrSeed {
  apparelId: number;
  shortName: string;
  category: SnkrdunkCategory | null;
}

function searchToSeed(r: SnkrdunkSearchResult): SnkrSeed {
  const curated = FEATURED_BY_ID.get(r.apparelId);
  if (curated) {
    return { apparelId: r.apparelId, shortName: curated.shortName, category: curated.category };
  }
  return {
    apparelId: r.apparelId,
    shortName: shortenName(r.name),
    category: inferCategory(r.name),
  };
}

function curatedToSeed(s: SnkrdunkCardSeed): SnkrSeed {
  return { apparelId: s.apparelId, shortName: s.shortName, category: s.category };
}

/** 인기 카드 — 브라우즈(ポケモンカード) 결과에서 박스류를 제외한 싱글카드만. */
async function pickRandomCardSeeds(): Promise<SnkrSeed[]> {
  const r = await serverFetch<{ results: SnkrdunkSearchResult[] }>(
    '/api/snkrdunk/browse?page=1',
    { auth: false },
  );
  // 검색 이름엔 박스 마커가 빠진 박스가 섞일 수 있어 넉넉히 뽑고(상세에서 한 번 더 거름).
  const pool = (r.data?.results ?? []).filter((x) => classifySnkrdunkName(x.name) !== 'box');
  if (pool.length > 0) return shuffle(pool).slice(0, 12).map(searchToSeed);
  return shuffle(SNKRDUNK_FEATURED_CARDS).slice(0, 12).map(curatedToSeed);
}

/**
 * 인기 박스 — 최근 포켓몬 팩의 대표 '박스'(apparelCategoryId=14)로 구성.
 * 검색 이름 추측이 아니라 박스 전용 카테고리 그룹 조회라 싱글카드가 섞이지 않는다.
 * (/cards/packs 가 쓰는 것과 동일한 소스.)
 */
interface ApparelGroupBox {
  id: number;
  localizedName: string;
  imageUrl: string | null;
  minPrice: number;
  listingCountText?: string;
}
async function fetchBoxRows(): Promise<SnkrdunkRow[]> {
  const pool = CARD_PACKS
    .filter((p) => (p.game ?? 'pokemon') === 'pokemon' && p.apparelGroupId > 0)
    .sort((a, b) => (b.releasedAt ?? '').localeCompare(a.releasedAt ?? ''))
    .slice(0, 12);
  const picked = shuffle(pool).slice(0, 8);
  const rows = await Promise.all(
    picked.map(async (pack): Promise<SnkrdunkRow | null> => {
      const r = await serverFetch<{ data: { apparels?: ApparelGroupBox[] } | null }>(
        `/api/snkrdunk/apparel-groups/${pack.apparelGroupId}?apparelCategoryId=14&page=1&perPage=1`,
        { auth: false },
      );
      const box = r.data?.data?.apparels?.[0];
      if (!box || !box.id) return null;
      return {
        apparelId: box.id,
        shortName: pack.shortName,
        localizedName: box.localizedName || undefined,
        category: null,
        imageUrl: box.imageUrl ?? null,
        minPrice: box.minPrice ?? 0,
        listingCountText: box.listingCountText ?? '',
      };
    }),
  );
  return rows.filter((r): r is SnkrdunkRow => r !== null).slice(0, 6);
}

/** seed → 상세 조회로 가격·매물·이미지·등락률 채운 행. (인기 카드용) */
async function seedToRow(seed: SnkrSeed): Promise<SnkrdunkRow> {
  const [ar, chartResp, histResp] = await Promise.all([
    serverFetch<{ data: ApparelDetail }>(`/api/snkrdunk/apparels/${seed.apparelId}`, { auth: false }),
    serverFetch<{ data: { points?: Array<[number, number]> } | null }>(
      `/api/snkrdunk/apparels/${seed.apparelId}/sales-chart`,
      { auth: false },
    ).catch(() => null),
    serverFetch<{ data: SnkrdunkSalesHistory | null }>(
      `/api/snkrdunk/apparels/${seed.apparelId}/sales-history`,
      { auth: false },
    ).catch(() => null),
  ]);
  const apparel = ar.data?.data;
  const chartPoints = chartResp?.data?.data?.points;
  const changePct = chartPoints ? trendChangePct(chartPoints) : undefined;
  // 대표 시세 = 시세상세 헤드라인과 동일(거래 많은 등급의 최근 체결가). 없으면 minPrice 폴백.
  // basis(등급 기준)는 HOT 카드 PSA10 마크 판별용 — 앱 CleanHomeScreen 과 동일.
  const history = histResp?.data?.data?.history ?? [];
  const { price: recentPrice, basis } = headlineFromHistory(history, apparel?.minPrice ?? 0);
  // 큐레이션된 seed.shortName 이 우선, 없으면 일본어 원문을 한국어로 자동 번역.
  const jp = apparel?.localizedName ?? apparel?.name ?? '';
  const ko = FEATURED_BY_ID.has(seed.apparelId)
    ? seed.shortName
    : shortenName(translateKnownCardNameToKo(jp) || seed.shortName);
  return {
    apparelId: seed.apparelId,
    shortName: ko,
    localizedName: jp || undefined,
    itemKind: apparel?.itemKind,
    category: seed.category,
    imageUrl: apparel?.imageUrl ?? null,
    minPrice: apparel?.minPrice ?? 0,
    recentPrice,
    basis,
    listingCountText: apparel?.listingCountText ?? '',
    changePct,
  };
}

export default async function Page() {
  const user = await getServerUser();
  const userId = user?.id ?? null;

  const [cardsResp, bannersResp, cardSeeds, snkrdunkBoxRows, mvcAuctions] = await Promise.all([
    userId
      ? serverFetch<{ data: unknown[] }>('/api/me/cards/with-prices')
      : Promise.resolve({ data: { data: [] as unknown[] } }),
    serverFetch<{ data: HeroSlideData[] }>('/api/banners', { auth: false }),
    pickRandomCardSeeds(),
    fetchBoxRows(),
    // 홈 '실시간 MVC 경매' 미리보기 — 오늘 마감 경매 첫 페이지. 실패해도 홈은 떠야 함.
    fetchMvcAuctionPage(1)
      .then((r) => r.items)
      .catch(() => [] as MvcAuctionItem[]),
  ]);

  const cards = (cardsResp.data?.data ?? []) as never;
  const heroBanners = bannersResp.data?.data ?? [];

  // 상세 itemKind(정확) + 일본어 원문 이름으로 박스를 한 번 더 거른 뒤 6개만. 검색 단계
  // 이름엔 박스 마커가 없던 상품도 상세 분류/원문에서 여기서 확실히 제외된다.
  const snkrdunkRows = (await Promise.all(cardSeeds.map(seedToRow)))
    .filter((row) => row.itemKind !== 'box')
    .filter((row) => classifySnkrdunkName(row.localizedName ?? row.shortName) !== 'box')
    .slice(0, 6);

  return (
    <HomeRouter
      cards={cards}
      heroBanners={heroBanners}
      isLoggedIn={Boolean(userId)}
      snkrdunkRows={snkrdunkRows}
      snkrdunkBoxRows={snkrdunkBoxRows}
      mvcAuctions={mvcAuctions}
    />
  );
}
