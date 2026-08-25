/**
 * SNKRDUNK 데이터 fetcher (모바일) — 웹과 동일하게 NAS `/api/snkrdunk/*` 를 호출.
 *
 * 타입·파서·변환·로컬라이즈·다운샘플 등 순수 로직의 정본은 [[/shared/snkrdunk.ts]] —
 * 이 파일은 re-export + NAS 프록시 fetcher + 모바일 전용 시세탭 헬퍼(PriceMode 등)만
 * 보유. 웹과 규칙이 어긋나지 않게 재구현 금지.
 *
 * 2026-08: 기기→스니덩 직접 호출을 전부 NAS 경유로 통일 (웹·앱 같은 서버 로직 —
 * DB 캐시·카탈로그 적재·스냅샷 부수효과까지 동일). 응답은 서버가 이미
 * toSnkrdunkApparel 로 매핑한 형태라 여기서 재매핑하지 않는다.
 */
import {
  SNKRDUNK_BROWSE_KEYWORD,
  isSingleUnitSale,
  type SnkrdunkApparel,
  type SnkrdunkApparelGroupPage,
  type SnkrdunkSalesChart,
  type SnkrdunkSalesHistory,
  type SnkrdunkSearchResult,
} from '../../../shared/snkrdunk';
import {
  headlinePriceFromHistory as sharedHeadlinePrice,
  headlineFromHistory as sharedHeadline,
  type Headline,
} from '../../../shared/snkrdunkPrice';
import { api } from '@/lib/apiClient';

export * from '../../../shared/snkrdunk';

function abortAfter(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/**
 * GET 응답 메모리 캐시 — 화면 재진입/공유 조회를 즉시 응답해 페이지 전환을 빠르게 한다.
 * 서버가 같은 데이터를 10분 캐시하므로 5분 TTL 은 신선도를 해치지 않는다.
 * 실패(null)는 캐시하지 않고, 과다 증식 방지로 오래된 것부터 정리.
 */
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 300;
const proxyCache = new Map<string, { t: number; v: unknown }>();
// 같은 경로 동시요청 병합 — 홈이 목록을 먼저 그리고 상세를 채우는 동안
// 같은 카드의 차트/이력을 중복 호출하지 않게 한다.
const proxyInflight = new Map<string, Promise<unknown>>();

/** NAS 프록시 GET — 실패(네트워크·5xx)는 null. 웹 serverFetch 의 관대한 폴백과 동일. */
async function getProxy<T>(path: string, timeoutMs = 8000): Promise<T | null> {
  const hit = proxyCache.get(path);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v as T;
  const running = proxyInflight.get(path);
  if (running) return running as Promise<T | null>;
  const p = (async () => {
    try {
      const v = await api<T>(path, { auth: false, signal: abortAfter(timeoutMs) });
      if (v !== null && v !== undefined) {
        if (proxyCache.size >= CACHE_MAX) {
          const firstKey = proxyCache.keys().next().value;
          if (firstKey !== undefined) proxyCache.delete(firstKey);
        }
        proxyCache.set(path, { t: Date.now(), v });
      }
      return v;
    } catch {
      return null;
    } finally {
      proxyInflight.delete(path);
    }
  })();
  proxyInflight.set(path, p);
  return p as Promise<T | null>;
}

export async function fetchSnkrdunkApparel(apparelId: number): Promise<SnkrdunkApparel | null> {
  if (!Number.isInteger(apparelId) || apparelId <= 0) return null;
  const r = await getProxy<{ data: SnkrdunkApparel | null }>(`/api/snkrdunk/apparels/${apparelId}`);
  return r?.data ?? null;
}

export async function fetchSnkrdunkApparelGroup(
  groupId: number,
  opts: { apparelCategoryId: 25 | 14; page?: number; perPage?: number },
): Promise<SnkrdunkApparelGroupPage | null> {
  if (!Number.isInteger(groupId) || groupId <= 0) return null;
  const page = Number.isInteger(opts.page) && opts.page && opts.page > 0 ? opts.page : 1;
  // 서버 라우트가 perPage 를 50 으로 캡 — 페이지네이션 계산이 어긋나지 않게 동일 캡.
  const perPage = Number.isInteger(opts.perPage) && opts.perPage ? Math.min(Math.max(opts.perPage, 1), 50) : 50;
  const r = await getProxy<{ data: SnkrdunkApparelGroupPage | null }>(
    `/api/snkrdunk/apparel-groups/${groupId}?page=${page}&perPage=${perPage}&apparelCategoryId=${opts.apparelCategoryId}`,
  );
  return r?.data ?? null;
}

export async function fetchAllSnkrdunkApparelGroup(
  groupId: number,
  opts: { apparelCategoryId: 25 | 14; maxItems?: number },
): Promise<SnkrdunkApparel[]> {
  const perPage = 50;
  const first = await fetchSnkrdunkApparelGroup(groupId, {
    apparelCategoryId: opts.apparelCategoryId,
    page: 1,
    perPage,
  });
  if (!first) return [];
  const maxItems = opts.maxItems ?? 600;
  const total = Math.min(first.apparelsCount, maxItems);
  const pages = Math.ceil(total / perPage);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      fetchSnkrdunkApparelGroup(groupId, {
        apparelCategoryId: opts.apparelCategoryId,
        page: i + 2,
        perPage,
      }),
    ),
  );
  return [first, ...rest].flatMap((p) => p?.apparels ?? []).slice(0, total);
}

export async function fetchSnkrdunkSalesHistory(
  apparelId: number,
): Promise<SnkrdunkSalesHistory | null> {
  if (!Number.isInteger(apparelId) || apparelId <= 0) return null;
  const r = await getProxy<{ data: SnkrdunkSalesHistory | null }>(
    `/api/snkrdunk/apparels/${apparelId}/sales-history`,
  );
  if (!r?.data) return null;
  // 서버가 이미 필터하지만 규칙 정본(단일 장 체결만)을 이중으로 보장 — 멱등.
  return { ...r.data, history: r.data.history.filter(isSingleUnitSale) };
}

export async function fetchSnkrdunkSalesChart(
  apparelId: number,
): Promise<SnkrdunkSalesChart | null> {
  if (!Number.isInteger(apparelId) || apparelId <= 0) return null;
  // 메인/중고 차트 폴백은 서버 fetchSnkrdunkSalesChart 가 처리.
  const r = await getProxy<{ data: SnkrdunkSalesChart | null }>(
    `/api/snkrdunk/apparels/${apparelId}/sales-chart`,
  );
  return r?.data ?? null;
}

export async function fetchSnkrdunkBrowse(page = 1): Promise<SnkrdunkSearchResult[]> {
  return searchSnkrdunkByQuery(SNKRDUNK_BROWSE_KEYWORD, page);
}

/** Free-text search. `page` 로 스니덩 검색 페이지네이션(2,3…)을 직접 넘긴다 —
 *  검색 화면 "더 보기"가 다음 페이지를 이어 받는 데 쓰인다. (legacy 컬렉션 카드의
 *  apparelId 복구에도 사용 — 그 경우 page 생략 = 1페이지.) */
export async function searchSnkrdunkByQuery(
  query: string,
  page = 1,
): Promise<SnkrdunkSearchResult[]> {
  if (!query || !query.trim()) return [];
  const p = Number.isInteger(page) && page > 1 ? `&page=${page}` : '';
  const r = await getProxy<{ results?: SnkrdunkSearchResult[] }>(
    `/api/snkrdunk/search?q=${encodeURIComponent(query.trim())}${p}`,
    10000,
  );
  return r?.results ?? [];
}

/* ── 모바일 전용 — 시세탭(싱글/PSA10 토글) 헬퍼 ─────────────────────── */

/** Two market segments we surface on the price tab:
 *   - 'single' = un-graded "raw" cards (most users hold these)
 *   - 'psa10'  = PSA-10 graded copies, typically a multi-x premium
 *  Mode toggles in the UI just swap which segment's median we display. */
export type PriceMode = 'single' | 'psa10';

/** True when the sales history has at least one PSA-10 graded transaction.
 *  Used to decide whether the singles/PSA10 toggle should be shown — packs
 *  and boxes never have PSA grades and hiding the toggle there avoids a
 *  useless control. */
export function hasPsa10Transactions(
  history: SnkrdunkSalesHistory | null | undefined,
): boolean {
  return (history?.history ?? []).some((h) => /^PSA\s*10$/i.test((h.condition ?? '').trim()));
}

/** Parse snkrdunk's relative-date strings ("3時間前", "1日前", "2025/05/10",
 *  "어제" after localization etc) into an absolute millisecond timestamp.
 *  Returns null when the format isn't recognized. */
export function parseSnkrdunkDate(text: string | null | undefined, now = Date.now()): number | null {
  if (!text) return null;
  const s = String(text).trim();
  let m: RegExpMatchArray | null;
  m = s.match(/^(\d+)\s*分前/);
  if (m) return now - Number(m[1]) * 60_000;
  m = s.match(/^(\d+)\s*時間前/);
  if (m) return now - Number(m[1]) * 3_600_000;
  m = s.match(/^(\d+)\s*日前/);
  if (m) return now - Number(m[1]) * 86_400_000;
  m = s.match(/^(\d+)\s*週間前/);
  if (m) return now - Number(m[1]) * 7 * 86_400_000;
  m = s.match(/^(\d+)\s*ヶ月前/);
  if (m) return now - Number(m[1]) * 30 * 86_400_000;
  m = s.match(/^(\d+)\s*年前/);
  if (m) return now - Number(m[1]) * 365 * 86_400_000;
  if (/^어제|^昨日/.test(s)) return now - 86_400_000;
  if (/^오늘|^今日/.test(s)) return now;
  // ISO-ish: "2025/05/10" or "2025-05-10" — accept with optional time
  m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    const t = Date.parse(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T00:00:00`);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

/** Convert sales history into `[ms, price]` pairs filtered by mode, sorted
 *  oldest→newest. Used to derive chart points when the sales-chart endpoint
 *  is empty (common for newer cards), and to split a single chart into two
 *  series (singles vs PSA10). */
export function salesHistoryToPoints(
  history: SnkrdunkSalesHistory | null | undefined,
  mode: PriceMode,
): Array<[number, number]> {
  const now = Date.now();
  const filtered = (history?.history ?? []).filter((h) => inSegment(h.condition, mode));
  const points: Array<[number, number]> = [];
  for (const h of filtered) {
    const t = parseSnkrdunkDate(h.date, now);
    const p = Number(h.price);
    if (t != null && Number.isFinite(p) && p > 0) points.push([t, p]);
  }
  return points.sort((a, b) => a[0] - b[0]);
}

function inSegment(condition: string | null | undefined, mode: PriceMode): boolean {
  const c = (condition ?? '').trim();
  if (mode === 'psa10') return /^PSA\s*10$/i.test(c);
  // single = anything that ISN'T a PSA-graded sale. "A" / "B" / "中古" /
  // 新品 / empty all qualify.
  return !/PSA\s*\d+/i.test(c);
}

/** Median price of the most recent N transactions in the given segment.
 *  Median (not mean) so a single outlier sale doesn't drag the typical
 *  price upward. Returns null when there's no usable history — caller
 *  falls back to apparel.minPrice. */
export function recentTransactionMedian(
  history: SnkrdunkSalesHistory | null | undefined,
  mode: PriceMode = 'single',
  n = 5,
): number | null {
  const filtered = (history?.history ?? [])
    .filter((h) => inSegment(h.condition, mode))
    .slice(0, n);
  const sorted = filtered
    .map((h) => Number(h.price))
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/**
 * 시세상세 헤드라인과 동일한 '대표 시세' — 정본은 shared/snkrdunkPrice.ts 의
 * headlinePriceFromHistory. 여기는 기존 모바일 시그니처(history 래퍼 객체) 호환 어댑터.
 */
export function headlinePriceFromHistory(
  history: SnkrdunkSalesHistory | null | undefined,
  minPrice: number,
): number {
  return sharedHeadlinePrice(history?.history ?? [], minPrice);
}

/** 대표 시세 + 등급 기준('PSA 10' | 'PSA 9' | 'RAW'). HOT 카드 PSA10 마크 판별용. */
export function headlineFromHistory(
  history: SnkrdunkSalesHistory | null | undefined,
  minPrice: number,
): Headline {
  return sharedHeadline(history?.history ?? [], minPrice);
}

/* ── 홈 추천 시드 ─────────────────────────────────────────────────── */

export interface SnkrdunkCardSeed {
  apparelId: number;
  shortName: string;
  category: 'SAR' | '프로모' | 'SR' | '원피스';
}

export const SNKRDUNK_FEATURED_CARDS: SnkrdunkCardSeed[] = [
  { apparelId: 128117, shortName: '리자몽ex SAR (151)', category: 'SAR' },
  { apparelId: 103079, shortName: '리자몽VSTAR SAR', category: 'SAR' },
  { apparelId: 100090, shortName: '피카츄 뭉크展 프로모', category: '프로모' },
  { apparelId: 106796, shortName: 'Nagaba × 피카츄 프로모', category: '프로모' },
  { apparelId: 104636, shortName: '게코우가 & 조로아크 GX SR', category: 'SR' },
  { apparelId: 108050, shortName: '루피 P-033 (점프 부록)', category: '원피스' },
];

/** Find the snkrdunk apparelId for a stored collection card. We need a
 *  CONFIDENT match — naive name-only search returns sibling prints (a
 *  different ピカチュウ for example), and overwriting the price with the
 *  wrong card is worse than not refreshing at all.
 *
 *  Strategy:
 *    1. Parse setCode + cardNumber from the card's snkrdunk image URL
 *       (`pkmn-tcg-{SET}-{NUM}-…webp`) or the saved set+num fields.
 *    2. Search snkrdunk with "name + SET + NUM" — the exact format that
 *       appears in apparel titles (e.g. "ピカチュウ P [M-P 020]").
 *    3. Require the result name to contain both setCode and cardNumber.
 *    4. Return null when no result meets that bar.
 */
export async function recoverSnkrdunkApparelId(card: {
  name?: string;
  set?: string;
  num?: string;
  imageUrl?: string;
}): Promise<number | null> {
  const baseName = (card.name ?? '').split(/[\[(（【]/)[0].replace(/\s+[A-Z]$/, '').trim();
  // Extract setCode + cardNumber, preferring the image URL (most reliable
  // since the file naming is server-side and consistent).
  let setCode = '';
  let num = '';
  const urlMatch = (card.imageUrl ?? '').match(/pkmn-tcg-([A-Za-z]+(?:-[A-Za-z]+)?)-(\d+)/i);
  if (urlMatch) {
    setCode = urlMatch[1].toUpperCase();
    num = urlMatch[2];
  } else if (card.set && card.num) {
    setCode = card.set.replace(/^(세트|Set)\s*/i, '').trim().toUpperCase();
    num = String(card.num).split('/')[0].replace(/^0+(?=\d)/, '');
  }
  if (!setCode || !num) return null;
  const num3 = num.padStart(3, '0');
  const queries = [
    baseName ? `${baseName} ${setCode} ${num3}` : '',
    `${setCode} ${num3}`,
  ].filter(Boolean);
  // setCode separators in titles can be '-' / ' '; num may or may not be zero-padded.
  const setEscaped = setCode.replace(/-/g, '[-\\s]?');
  const numEscaped = num.replace(/^0+(?=\d)/, '').replace(/(\d)/g, '0?$1');
  const matchRe = new RegExp(`${setEscaped}\\s*[-_ ]?\\s*${numEscaped}\\b`, 'i');
  for (const q of queries) {
    const results = await searchSnkrdunkByQuery(q);
    const best = results.find((r) => matchRe.test(r.name));
    if (best?.apparelId) return best.apparelId;
  }
  return null;
}

/* ── 코드 조회 (카메라 스캔 fast path) ─────────────────────────────── */

/** `/api/snkrdunk/by-code` 응답 1건. 서버가 우리 DB 우선으로 채워 준다. */
export interface CardByCode {
  apparelId: number;
  name: string;
  koName: string;
  shortName: string;
  imageUrl: string | null;
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

/**
 * 세트코드 + 카드번호로 카드 찾기 — 스캔 결과 화면의 단일 조회 경로.
 * 서버가 DB 에 있으면 즉시, 없으면 스니덩 코드검색 후 적재해서 돌려준다.
 */
export async function fetchCardsByCode(
  setCode: string,
  cardNumber: string,
  game?: string | null,
): Promise<{ cards: CardByCode[]; source: 'db' | 'live' | 'none' }> {
  const set = setCode.trim();
  const num = cardNumber.trim();
  if (!set || !num) return { cards: [], source: 'none' };
  const g = game && game !== 'other' ? `&game=${encodeURIComponent(game)}` : '';
  const r = await getProxy<{ cards?: CardByCode[]; source?: 'db' | 'live' }>(
    `/api/snkrdunk/by-code?setCode=${encodeURIComponent(set)}&number=${encodeURIComponent(num)}${g}`,
    12000,
  );
  return { cards: r?.cards ?? [], source: r?.source ?? 'none' };
}
