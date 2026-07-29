/**
 * SNKRDUNK 비공식 v1 JSON API 호출 (모바일).
 *
 * 타입·파서·변환·로컬라이즈·다운샘플 등 순수 로직의 정본은 [[/shared/snkrdunk.ts]] —
 * 이 파일은 re-export + 네이티브 fetch(timeout) 기반 fetcher + 모바일 전용
 * 시세탭 헬퍼(PriceMode 등)만 보유. 웹과 규칙이 어긋나지 않게 재구현 금지.
 *
 * 네이티브에서는 CORS 없이 직접 호출. Expo Web 빌드는 CORS로 차단되므로
 * 그 경우 Next.js 백엔드의 /api/snkrdunk/* 프록시를 거쳐야 함 (현재 미적용).
 */
import {
  SNKRDUNK_ORIGIN,
  SNKRDUNK_BROWSE_KEYWORD,
  isSingleUnitSale,
  parseSnkrdunkSearchHtml,
  toSnkrdunkApparel,
  type RawApparel,
  type RawApparelGroupPage,
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

export * from '../../../shared/snkrdunk';

function abortAfter(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SNKRDUNK_ORIGIN}${path}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'ja,en-US;q=0.8,ko;q=0.7',
      },
      signal: abortAfter(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchSnkrdunkApparel(apparelId: number): Promise<SnkrdunkApparel | null> {
  if (!Number.isInteger(apparelId) || apparelId <= 0) return null;
  const raw = await getJson<RawApparel>(`/v1/apparels/${apparelId}`);
  if (!raw) return null;
  return toSnkrdunkApparel(raw);
}

export async function fetchSnkrdunkApparelGroup(
  groupId: number,
  opts: { apparelCategoryId: 25 | 14; page?: number; perPage?: number },
): Promise<SnkrdunkApparelGroupPage | null> {
  if (!Number.isInteger(groupId) || groupId <= 0) return null;
  const page = Number.isInteger(opts.page) && opts.page && opts.page > 0 ? opts.page : 1;
  const perPage = Number.isInteger(opts.perPage) && opts.perPage ? Math.min(Math.max(opts.perPage, 1), 100) : 100;
  const raw = await getJson<RawApparelGroupPage>(
    `/v1/apparel-groups/${groupId}?page=${page}&perPage=${perPage}&apparelCategoryId=${opts.apparelCategoryId}`,
  );
  if (!raw) return null;
  return {
    apparels: (raw.apparels ?? []).map((a) => toSnkrdunkApparel(a, opts.apparelCategoryId === 25 ? 'single' : 'box')),
    apparelsCount: raw.apparelsCount ?? 0,
  };
}

export async function fetchAllSnkrdunkApparelGroup(
  groupId: number,
  opts: { apparelCategoryId: 25 | 14; maxItems?: number },
): Promise<SnkrdunkApparel[]> {
  const perPage = 100;
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
  const data = await getJson<SnkrdunkSalesHistory>(
    `/v1/apparels/${apparelId}/sales-history?size_id=0&page=1&per_page=20`,
  );
  if (!data) return null;
  // 웹과 동일 규칙 — 여러 장 묶음 체결은 단가 오염원이라 제외.
  return { ...data, history: data.history.filter(isSingleUnitSale) };
}

export async function fetchSnkrdunkSalesChart(
  apparelId: number,
): Promise<SnkrdunkSalesChart | null> {
  if (!Number.isInteger(apparelId) || apparelId <= 0) return null;
  const main = await getJson<SnkrdunkSalesChart>(`/v1/apparels/${apparelId}/sales-chart`);
  if (main && main.points && main.points.length > 0) return main;
  return getJson<SnkrdunkSalesChart>(`/v1/apparels/${apparelId}/sales-chart/used`);
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
  const url = `${SNKRDUNK_ORIGIN}/search?keywords=${encodeURIComponent(query.trim())}${p}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'Accept-Language': 'ja,en-US;q=0.8,ko;q=0.7',
      },
      signal: abortAfter(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseSnkrdunkSearchHtml(html);
  } catch {
    return [];
  }
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
