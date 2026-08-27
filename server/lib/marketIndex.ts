/**
 * 시장 지표(TCG 인덱스) — 산출·수집·서빙 정본.
 *
 *  · pokemon  : S&Poké 500 (https://poké500.com) 공개 JSON 을 6시간 캐시로 서빙.
 *               독립 비영리 팬 프로젝트라 출처를 화면에 표기한다(응답 source 필드).
 *  · onepiece : ARVO OP200 — S&Poké 500 과 같은 산식을 tcgcsv.com(TCGplayer 카탈로그·
 *               시장가 일별 미러, 무료·무키)의 원피스 카테고리(68)에 적용해 직접 계산.
 *
 * 산식(S&P 500 과 동일한 가격가중 + 디바이저):
 *  - 유니버스 = 카테고리의 '싱글'(extendedData 에 Number 가 있는 상품). 실드 제외.
 *  - 종목 대표가 = 인쇄판(Foil/Normal…) 중 최대 TCGplayer market price. 1st Edition 제외.
 *  - 바스켓 = 대표가 상위 N. 매일 재선정(동적 멤버십).
 *  - 지수 = 어제 바스켓을 오늘 가격으로 재평가한 합 / 어제 디바이저.
 *    디바이저는 오늘 바스켓 합 / 재평가 합 비율로 조정해 리밸런싱 시 연속성 유지.
 *  - forward-fill: 오늘 market 가격이 없는 종목은 최근 가격을 최대 STALE_DAYS 유지.
 *  - 글리치 가드: 최근 5회 중앙값의 ×2 / ÷2 범위를 벗어난 값은 중앙값으로 대체
 *    (TCGplayer market 값이 하루 튀는 경우가 잦아 지수·등락이 오염되는 것을 막는다).
 *  - 바스켓 자격(시즈닝): 세트 출시 후 SEASON_DAYS 가 지났고 가격 프린트가 2회 이상인 종목만.
 *    원피스는 매 세트마다 신카드가 프리세일 호가로 상위권에 들어왔다가 발매 후 급락하는데,
 *    S&Poké 방식 그대로(첫 프린트 신뢰)면 "고점 편입→하락"이 매 세트 반복돼 지수가 실제
 *    시장(고정 바스켓 실측 +116%)과 반대로 −43% 가 나왔다. 자격 규칙으로 이 편향을 제거한다.
 *  - 재평가 결측: 어제 바스켓 종목이 오늘 가격도 carry 도 없으면 0 이 아니라 어제 가격으로
 *    둔다(0 으로 두면 가짜 급락).
 *
 * 저장: 포인트는 MarketIndexPoint, 연속 계산 상태(디바이저·직전 바스켓·carry·가드 윈도)는
 * MarketIndexState. 최초 히스토리는 로컬 백필(server/scripts/marketIndexBackfill.ts →
 * server/data/marketIndexSeed.json)로 만들고 부팅 시 DB 가 비어 있으면 시드를 넣는다.
 * 이후 매일 tcgcsv 갱신(~20:05 UTC = 05:05 KST) 뒤 06:30 KST 에 한 스텝 진행.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './prisma.js';
import { kstDayStart } from '../../shared/kst';
import {
  summarizePoints,
  type MarketIndexBreadth,
  type MarketIndexKey,
  type MarketIndexPoint,
  type MarketIndexResponse,
  type MarketIndexSeries,
} from '../../shared/marketIndex';

const TCGCSV = 'https://tcgcsv.com';
const USER_AGENT = 'arvotcg-market-index/1.0 (+https://www.arvotcg.com)';

export const BASE_INDEX_VALUE = 1000;
/** tcgcsv 가 공개하는 가장 오래된 일별 아카이브 날짜. */
export const ARCHIVE_START = '2024-02-08';
/** forward-fill 최대 일수 — 이보다 오래된 가격은 버린다. */
export const STALE_DAYS = 70;
const GLITCH_FACTOR = 2.0;
const GLITCH_WINDOW = 5;
/** 세트 출시 후 이 일수가 지나야 바스켓 자격 — 프리세일/발매 직후 호가 배제. */
export const SEASON_DAYS = 60;
/** 바스켓 자격에 필요한 최소 가격 프린트 수(가드 윈도 길이). */
const MIN_PRINTS = 2;

/* ── 지수 정의 ─────────────────────────────────────────────────────── */

export interface ComputedIndexDef {
  key: MarketIndexKey;
  /** tcgcsv 카테고리 id. */
  category: number;
  /** 바스켓 크기. */
  size: number;
  label: string;
  indexName: string;
  basketLabel: string;
  source: string;
  sourceUrl: string;
}

/** 서버가 직접 계산하는 지수들. 포켓몬은 외부(S&Poké 500)라 여기 없다. */
export const COMPUTED_INDEXES: ComputedIndexDef[] = [
  {
    key: 'onepiece',
    category: 68,
    size: 200,
    label: '원피스 TCG 지수',
    indexName: 'ARVO OP200',
    basketLabel: '영문 raw 싱글 상위 200종 · TCGplayer 시장가',
    source: 'ARVOTCG 산출 · 시세: tcgcsv.com (TCGplayer)',
    sourceUrl: 'https://tcgcsv.com',
  },
  {
    // 유희왕은 세트가 658개라 일일 라이브 수집이 ~1,300 요청(≈5분) — 하루 한 번이라 허용.
    key: 'yugioh',
    category: 2,
    size: 200,
    label: '유희왕 TCG 지수',
    indexName: 'ARVO YGO200',
    basketLabel: '영문 raw 싱글 상위 200종 · TCGplayer 시장가',
    source: 'ARVOTCG 산출 · 시세: tcgcsv.com (TCGplayer)',
    sourceUrl: 'https://tcgcsv.com',
  },
];

const POKEMON_DEF = {
  key: 'pokemon' as const,
  label: '포켓몬 TCG 지수',
  indexName: 'S&Poké 500',
  basketLabel: '영문 raw 싱글 상위 500종 · TCGplayer 시장가',
  source: 'S&Poké 500 (poké500.com) · 독립 비영리 팬 프로젝트',
  sourceUrl: 'https://xn--pok500-dva.com/',
};

/* ── tcgcsv 수집 ───────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string, timeoutMs = 90_000): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (err) {
      last = err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw new Error(`tcgcsv request failed: ${url} — ${last instanceof Error ? last.message : String(last)}`);
}

interface TcgProduct {
  productId: number;
  name?: string;
  imageUrl?: string;
  extendedData?: Array<{ name?: string; value?: string }>;
}
interface TcgPriceRow {
  productId: number;
  marketPrice?: number | null;
  subTypeName?: string | null;
}
interface TcgGroup {
  groupId: number;
  name?: string;
  publishedOn?: string | null;
}

export interface CatalogEntry {
  id: string;
  name: string;
  number: string;
  rarity: string;
  setName: string;
  image: string;
  /** 세트(그룹) 출시일 "YYYY-MM-DD". 없으면 null(자격 판정에서 통과). */
  releasedAt: string | null;
}
export type Catalog = Map<string, CatalogEntry>;

function extended(p: TcgProduct, key: string): string | null {
  for (const e of p.extendedData ?? []) if (e?.name === key) return e.value ?? null;
  return null;
}

// 상위 랭킹을 오염시키는 특수 상품 — 점보/오버사이즈/스태프 프로모/에러 카드 등.
// 얇게 거래되며 호가만 높아 지수를 흔든다. (S&Poké 500 과 같은 제외 규칙)
const BAD_SET = ['jumbo', 'miscellaneous', 'oversized'];
const BAD_NAME = ['box topper', 'jumbo', 'oversized', '(staff', '[staff', 'miscut', 'misprint', 'error)', 'error]'];

function excluded(name: string, setName: string): boolean {
  const s = setName.toLowerCase();
  const n = name.toLowerCase();
  return BAD_SET.some((k) => s.includes(k)) || BAD_NAME.some((k) => n.includes(k));
}

const SET_PREFIX = /^[A-Z0-9]{2,6}:\s+/;

export async function fetchGroups(category: number): Promise<TcgGroup[]> {
  const j = await getJson<{ results: TcgGroup[] }>(`${TCGCSV}/tcgplayer/${category}/groups`);
  return j.results ?? [];
}

/** 카테고리의 싱글 카탈로그 — {productId → 메타}. 실드 상품 제외. */
export async function buildCatalog(category: number, log?: (s: string) => void): Promise<Catalog> {
  const catalog: Catalog = new Map();
  const groups = await fetchGroups(category);
  let i = 0;
  for (const g of groups) {
    i += 1;
    const setName = (g.name ?? '').replace(SET_PREFIX, '').trim();
    const releasedAt = typeof g.publishedOn === 'string' && /^\d{4}-\d{2}-\d{2}/.test(g.publishedOn) ? g.publishedOn.slice(0, 10) : null;
    let products: TcgProduct[];
    try {
      products = (await getJson<{ results: TcgProduct[] }>(`${TCGCSV}/tcgplayer/${category}/${g.groupId}/products`)).results ?? [];
    } catch {
      continue;
    }
    for (const p of products) {
      const number = extended(p, 'Number');
      if (number == null) continue; // 싱글만
      const name = p.name ?? 'Unknown';
      if (excluded(name, setName)) continue;
      catalog.set(String(p.productId), {
        id: String(p.productId),
        name,
        number,
        rarity: extended(p, 'Rarity') ?? '',
        setName,
        image: p.imageUrl ?? '',
        releasedAt,
      });
    }
    if (log && i % 25 === 0) log(`catalog ${i}/${groups.length} sets · ${catalog.size} singles`);
    await sleep(80);
  }
  if (catalog.size === 0) throw new Error(`tcgcsv returned an empty catalog for category ${category}`);
  return catalog;
}

/**
 * 인쇄판 중 최대 market price.
 * excludeFirstEdition(포켓몬 영문, S&Poké 규칙): 1st Edition 은 그것뿐일 때만 폴백 —
 * 빈티지 1st Ed 의 TCGplayer market 값이 깨져 있어서다. 유희왕은 1st Edition 이 표준 인쇄
 * (한 세트 697/700 행)라 제외하면 안 되므로 카테고리별로 켠다.
 */
function repPrice(rows: TcgPriceRow[], excludeFirstEdition: boolean): number {
  let best = 0;
  let fallback = 0;
  for (const r of rows) {
    const v = r.marketPrice;
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
    const sub = (r.subTypeName ?? '').toLowerCase();
    if (excludeFirstEdition && sub.includes('1st edition')) fallback = Math.max(fallback, v);
    else best = Math.max(best, v);
  }
  return best || fallback;
}

/** 카테고리별 1st Edition 제외 여부 — 포켓몬 영문(3)만. */
export function firstEditionExcluded(category: number): boolean {
  return category === 3;
}

/** 한 그룹 price rows → out 에 {productId → 대표가} 누적. */
export function pricesFromRows(rows: TcgPriceRow[], out: Map<string, number>, excludeFirstEdition = false): void {
  const grouped = new Map<string, TcgPriceRow[]>();
  for (const r of rows) {
    const k = String(r.productId);
    const arr = grouped.get(k);
    if (arr) arr.push(r);
    else grouped.set(k, [r]);
  }
  for (const [pid, arr] of grouped) {
    const p = repPrice(arr, excludeFirstEdition);
    if (p > 0) out.set(pid, Math.round(p * 100) / 100);
  }
}

/** 오늘(tcgcsv 최신 스냅샷)의 대표가 — 그룹별 /prices 순회. */
export async function livePrices(category: number, log?: (s: string) => void): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const groups = await fetchGroups(category);
  let i = 0;
  for (const g of groups) {
    i += 1;
    try {
      const j = await getJson<{ results: TcgPriceRow[] }>(`${TCGCSV}/tcgplayer/${category}/${g.groupId}/prices`);
      pricesFromRows(j.results ?? [], out, firstEditionExcluded(category));
    } catch {
      // 그룹 하나 실패는 건너뛴다 — 종목은 carry 로 forward-fill 된다.
    }
    if (log && i % 25 === 0) log(`prices ${i}/${groups.length} sets · ${out.size} priced`);
    await sleep(80);
  }
  return out;
}

/** tcgcsv 마지막 갱신 시각 → 스냅샷 날짜("YYYY-MM-DD", UTC). 실패 시 null. */
export async function tcgcsvSnapshotDate(): Promise<string | null> {
  try {
    const r = await fetch(`${TCGCSV}/last-updated.txt`, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) return null;
    const txt = (await r.text()).trim();
    const m = txt.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/* ── 지수 산식 (순수) ─────────────────────────────────────────────── */

/** 연속 계산 상태 — DB(MarketIndexState.json)와 시드 파일에 그대로 직렬화. */
export interface IndexState {
  divisor: number;
  /** 직전 바스켓 productId 순서. */
  ids: string[];
  /** 직전 바스켓 [productId, 가격] — 오늘 가격이 없는 종목의 재평가 폴백. */
  basket: Array<[string, number]>;
  /** forward-fill: productId → [가격, 마지막 실제 가격 날짜]. */
  carry: Record<string, [number, string]>;
  /** 글리치 가드: productId → 최근 가격 윈도. */
  windows: Record<string, number[]>;
  /** 마지막으로 반영한 스냅샷 날짜. */
  lastDate: string;
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 글리치 가드 — 윈도 중앙값 ×2/÷2 밖이면 중앙값으로 대체. windows 는 in-place 갱신. */
export function guardPrices(
  raw: Map<string, number>,
  windows: Record<string, number[]>,
): Map<string, number> {
  const eff = new Map<string, number>();
  for (const [pid, m] of raw) {
    if (!(m > 0)) continue;
    const win = windows[pid];
    if (!win || win.length === 0) {
      windows[pid] = [m];
      eff.set(pid, m);
      continue;
    }
    const ref = median(win);
    if (ref > 0 && m / ref >= 1 / GLITCH_FACTOR && m / ref <= GLITCH_FACTOR) eff.set(pid, m);
    else eff.set(pid, Math.round(ref * 100) / 100);
    win.push(m);
    if (win.length > GLITCH_WINDOW) win.shift();
  }
  return eff;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 바스켓 자격 판정기 — 기준일 `date` 에 대해: 세트 출시 SEASON_DAYS 경과 + 프린트 MIN_PRINTS 이상.
 * guardPrices 가 윈도를 갱신한 뒤에 호출해야 오늘 프린트가 카운트된다.
 */
export function eligibilityFor(
  date: string,
  catalog: Catalog,
  windows: Record<string, number[]>,
): (pid: string) => boolean {
  const cutoff = addDaysIso(date, -SEASON_DAYS);
  return (pid) => {
    const e = catalog.get(pid);
    if (!e) return false;
    if (e.releasedAt && e.releasedAt > cutoff) return false;
    return (windows[pid]?.length ?? 0) >= MIN_PRINTS;
  };
}

export function rankBasket(
  prices: Map<string, number>,
  catalog: Catalog,
  size: number,
  eligible: (pid: string) => boolean = (pid) => catalog.has(pid),
): Array<[string, number]> {
  const ranked: Array<[string, number]> = [];
  for (const [pid, p] of prices) if (p > 0 && eligible(pid)) ranked.push([pid, p]);
  ranked.sort((a, b) => b[1] - a[1]);
  return ranked.slice(0, size);
}

export interface StepResult {
  index: number;
  divisor: number;
  ids: string[];
  basket: Array<[string, number]>;
  sumToday: number;
}

/**
 * 하루치 스텝. effective = carry ∪ 오늘 가격(오늘이 우선).
 * 첫 스텝(prev 없음)은 지수 = BASE, 디바이저 = 합/BASE.
 */
export function stepIndex(
  prices: Map<string, number>,
  catalog: Catalog,
  prev: { basket: Array<[string, number]>; divisor: number } | null,
  carry: Map<string, number>,
  size: number,
  eligible?: (pid: string) => boolean,
): StepResult {
  const effective = new Map(carry);
  for (const [k, v] of prices) effective.set(k, v);
  const basket = rankBasket(effective, catalog, size, eligible);
  const ids = basket.map(([pid]) => pid);
  const sumToday = basket.reduce((a, [, p]) => a + p, 0);
  if (!prev || !prev.divisor || prev.basket.length === 0) {
    return { index: BASE_INDEX_VALUE, divisor: sumToday ? sumToday / BASE_INDEX_VALUE : 1, ids, basket, sumToday };
  }
  // 어제 바스켓을 오늘 가격으로 재평가. 오늘 가격·carry 모두 없으면 어제 가격 유지(0 금지).
  const sumOldToday = prev.basket.reduce((a, [pid, p0]) => a + (effective.get(pid) ?? p0), 0) || sumToday;
  const index = sumOldToday / prev.divisor;
  const divisor = sumOldToday ? prev.divisor * (sumToday / sumOldToday) : prev.divisor;
  return { index, divisor, ids, basket, sumToday };
}

/** carry 갱신 — 오늘 실제 가격 반영 후 STALE_DAYS 초과분 제거. */
export function advanceCarry(
  carry: Record<string, [number, string]>,
  prices: Map<string, number>,
  date: string,
): Record<string, [number, string]> {
  const next: Record<string, [number, string]> = { ...carry };
  for (const [pid, p] of prices) next[pid] = [p, date];
  const t = Date.parse(`${date}T00:00:00Z`);
  for (const pid of Object.keys(next)) {
    const d = Date.parse(`${next[pid][1]}T00:00:00Z`);
    if ((t - d) / 86_400_000 > STALE_DAYS) delete next[pid];
  }
  return next;
}

/** carry 레코드 → 가격 맵. */
export function carryPrices(carry: Record<string, [number, string]>): Map<string, number> {
  const m = new Map<string, number>();
  for (const [pid, [p]] of Object.entries(carry)) m.set(pid, p);
  return m;
}

/** 가드 윈도 축소 — 바스켓 + 후보군(상위 2×size)만 보존해 상태 크기를 제한. */
export function pruneWindows(
  windows: Record<string, number[]>,
  effective: Map<string, number>,
  catalog: Catalog,
  size: number,
): Record<string, number[]> {
  const keep = new Set(rankBasket(effective, catalog, size * 2).map(([pid]) => pid));
  const out: Record<string, number[]> = {};
  for (const pid of keep) if (windows[pid]?.length) out[pid] = windows[pid];
  return out;
}

/* ── 저장/시드 ─────────────────────────────────────────────────────── */

export interface SeedSeries {
  points: Array<{ date: string; value: number; totalValue: number; count: number }>;
  state: IndexState;
}
export interface SeedFile {
  generatedAt: string;
  series: Partial<Record<MarketIndexKey, SeedSeries>>;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SEED_PATH = path.resolve(HERE, '../data/marketIndexSeed.json');

async function loadState(key: MarketIndexKey): Promise<IndexState | null> {
  const row = await prisma.marketIndexState.findUnique({ where: { key } });
  return (row?.json as unknown as IndexState | undefined) ?? null;
}

async function saveState(key: MarketIndexKey, state: IndexState): Promise<void> {
  await prisma.marketIndexState.upsert({
    where: { key },
    update: { json: state as object },
    create: { key, json: state as object },
  });
}

/** DB 가 비어 있는 키만 시드에서 채운다(멱등). 시드 파일이 없으면 조용히 건너뜀. */
export async function importSeedIfEmpty(): Promise<void> {
  let seed: SeedFile;
  try {
    seed = JSON.parse(await readFile(SEED_PATH, 'utf8')) as SeedFile;
  } catch {
    return;
  }
  for (const def of COMPUTED_INDEXES) {
    const s = seed.series[def.key];
    if (!s || s.points.length === 0) continue;
    const existing = await prisma.marketIndexPoint.count({ where: { key: def.key } });
    if (existing > 0) continue;
    await prisma.marketIndexPoint.createMany({
      data: s.points.map((p) => ({ key: def.key, date: p.date, value: p.value, totalValue: p.totalValue, count: p.count })),
      skipDuplicates: true,
    });
    await saveState(def.key, s.state);
    console.log(`[marketIndex] seeded ${def.key}: ${s.points.length} points (last ${s.state.lastDate})`);
  }
}

/* ── 일일 스텝 ─────────────────────────────────────────────────────── */

export const MARKET_INDEX_STATE = {
  running: false,
  lastRunAt: null as number | null,
  lastError: null as string | null,
  lastBuilt: {} as Record<string, string>,
};

/** 한 지수를 tcgcsv 최신 스냅샷까지 한 스텝 진행. 이미 반영됐으면 false. */
export async function buildDaily(def: ComputedIndexDef, snapshotDate: string): Promise<boolean> {
  const state = await loadState(def.key);
  if (state && state.lastDate >= snapshotDate) return false;
  const log = (s: string) => console.log(`[marketIndex:${def.key}] ${s}`);
  const catalog = await buildCatalog(def.category, log);
  const raw = await livePrices(def.category, log);
  if (raw.size < def.size) throw new Error(`only ${raw.size} priced products for ${def.key}`);
  const windows: Record<string, number[]> = { ...(state?.windows ?? {}) };
  const prices = guardPrices(raw, windows);
  const carryMap = carryPrices(state?.carry ?? {});
  const prevBasket = state ? (state.basket?.length ? state.basket : state.ids.map((id): [string, number] => [id, carryMap.get(id) ?? 0])) : null;
  const step = stepIndex(
    prices,
    catalog,
    prevBasket ? { basket: prevBasket, divisor: state!.divisor } : null,
    carryMap,
    def.size,
    eligibilityFor(snapshotDate, catalog, windows),
  );
  const nextCarry = advanceCarry(state?.carry ?? {}, prices, snapshotDate);
  const effective = new Map(carryMap);
  for (const [k, v] of prices) effective.set(k, v);
  const nextState: IndexState = {
    divisor: step.divisor,
    ids: step.ids,
    basket: step.basket,
    carry: nextCarry,
    windows: pruneWindows(windows, effective, catalog, def.size),
    lastDate: snapshotDate,
  };
  await prisma.marketIndexPoint.upsert({
    where: { key_date: { key: def.key, date: snapshotDate } },
    update: { value: step.index, totalValue: step.sumToday, count: step.ids.length },
    create: { key: def.key, date: snapshotDate, value: step.index, totalValue: step.sumToday, count: step.ids.length },
  });
  await saveState(def.key, nextState);
  MARKET_INDEX_STATE.lastBuilt[def.key] = snapshotDate;
  log(`${snapshotDate}: index ${step.index.toFixed(2)} (basket ${step.ids.length}, $${Math.round(step.sumToday).toLocaleString()})`);
  return true;
}

export async function runMarketIndexBuild(): Promise<void> {
  if (MARKET_INDEX_STATE.running) return;
  MARKET_INDEX_STATE.running = true;
  MARKET_INDEX_STATE.lastRunAt = Date.now();
  MARKET_INDEX_STATE.lastError = null;
  try {
    await importSeedIfEmpty();
    const date = await tcgcsvSnapshotDate();
    if (!date) throw new Error('tcgcsv last-updated unavailable');
    for (const def of COMPUTED_INDEXES) {
      try {
        await buildDaily(def, date);
      } catch (err) {
        MARKET_INDEX_STATE.lastError = err instanceof Error ? err.message : String(err);
        console.error(`[marketIndex:${def.key}]`, err);
      }
    }
    seriesCache = null; // 응답 캐시 무효화
    warmMarketIndexes();
  } catch (err) {
    MARKET_INDEX_STATE.lastError = err instanceof Error ? err.message : String(err);
    console.error('[marketIndex]', err);
  } finally {
    MARKET_INDEX_STATE.running = false;
  }
}

/** 다음 KST `hour:minute` 까지 남은 ms. */
function msUntilNextKst(hour: number, minute: number, now = Date.now()): number {
  let next = kstDayStart(now).getTime() + hour * 3_600_000 + minute * 60_000;
  if (next <= now) next += 86_400_000;
  return next - now;
}

/**
 * 스케줄러 — 부팅 90초 후 캐치업 1회 + 매일 06:30 KST (tcgcsv 갱신 ~05:05 KST 이후).
 * env MARKET_INDEX_DISABLED=1 로 끈다.
 */
export function startMarketIndexScheduler(): void {
  if (process.env.MARKET_INDEX_DISABLED === '1') {
    console.log('[marketIndex] disabled by env');
    return;
  }
  setTimeout(() => void runMarketIndexBuild(), 90_000);
  setTimeout(warmMarketIndexes, 20_000);
  const schedule = () => {
    const wait = msUntilNextKst(6, 30);
    setTimeout(() => {
      void runMarketIndexBuild().finally(schedule);
    }, wait);
  };
  schedule();
}

/* ── S&Poké 500 (포켓몬) ───────────────────────────────────────────── */

const SPOKE_HISTORY_URL = 'https://xn--pok500-dva.com/data/history.json';
const SPOKE_LATEST_URL = 'https://xn--pok500-dva.com/data/latest.json';
const SPOKE_TTL_MS = 6 * 3_600_000;

interface SpokeCache {
  fetchedAt: number;
  points: MarketIndexPoint[];
  breadth: MarketIndexBreadth | null;
}
let spokeCache: SpokeCache | null = null;

async function fetchSpoke500(): Promise<SpokeCache | null> {
  if (spokeCache && Date.now() - spokeCache.fetchedAt < SPOKE_TTL_MS) return spokeCache;
  try {
    const hist = await getJson<{ sample?: boolean; points?: Array<{ date: string; index: number }> }>(SPOKE_HISTORY_URL, 30_000);
    if (hist.sample || !hist.points?.length) throw new Error('S&Poké history unavailable');
    const points: MarketIndexPoint[] = hist.points
      .filter((p) => typeof p.index === 'number' && p.index > 0)
      .map((p) => ({ date: p.date, value: p.index }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    let breadth: MarketIndexBreadth | null = null;
    try {
      const latest = await getJson<{ breadth?: MarketIndexBreadth; asOfDate?: string; index?: number }>(SPOKE_LATEST_URL, 30_000);
      if (latest.breadth) breadth = latest.breadth;
      // latest 가 history 보다 하루 앞서 있으면 마지막 포인트를 붙인다.
      if (latest.asOfDate && typeof latest.index === 'number' && latest.asOfDate > points[points.length - 1].date) {
        points.push({ date: latest.asOfDate, value: latest.index });
      }
    } catch {
      // breadth 는 선택 정보 — 없어도 된다.
    }
    spokeCache = { fetchedAt: Date.now(), points, breadth };
    return spokeCache;
  } catch (err) {
    console.warn('[marketIndex] S&Poké 500 fetch failed', err instanceof Error ? err.message : err);
    return spokeCache; // stale-while-error
  }
}

/* ── 응답 조립 ─────────────────────────────────────────────────────── */

let seriesCache: { at: number; data: MarketIndexResponse } | null = null;
const SERIES_TTL_MS = 10 * 60_000;
let refreshing: Promise<MarketIndexResponse> | null = null;

async function computedSeries(def: ComputedIndexDef): Promise<MarketIndexSeries | null> {
  const rows = await prisma.marketIndexPoint.findMany({
    where: { key: def.key },
    orderBy: { date: 'asc' },
    select: { date: true, value: true },
  });
  if (rows.length === 0) return null;
  const points: MarketIndexPoint[] = rows.map((r) => ({ date: r.date, value: Math.round(r.value * 100) / 100 }));
  return {
    key: def.key,
    label: def.label,
    indexName: def.indexName,
    basketLabel: def.basketLabel,
    source: def.source,
    sourceUrl: def.sourceUrl,
    breadth: null,
    points,
    ...summarizePoints(points),
  };
}

async function buildResponse(): Promise<MarketIndexResponse> {
  const series: MarketIndexSeries[] = [];
  const spoke = await fetchSpoke500();
  if (spoke && spoke.points.length > 1) {
    series.push({ ...POKEMON_DEF, breadth: spoke.breadth, points: spoke.points, ...summarizePoints(spoke.points) });
  }
  for (const def of COMPUTED_INDEXES) {
    const s = await computedSeries(def).catch(() => null);
    if (s) series.push(s);
  }
  const data: MarketIndexResponse = { generatedAt: new Date().toISOString(), series };
  seriesCache = { at: Date.now(), data };
  return data;
}

/**
 * 응답 — stale-while-revalidate. 캐시가 있으면(만료됐어도) 즉시 돌려주고 백그라운드로 갱신.
 * 캐시가 전혀 없을 때만 대기. NAS 가 스냅샷 배치 등으로 바쁠 때 콜드 요청이 47초까지 걸려
 * 클라이언트 타임아웃(15초)에 걸리던 실측 — 지표는 하루 한 번 바뀌는 데이터라 stale 이 무해하다.
 */
export async function getMarketIndexes(): Promise<MarketIndexResponse> {
  const fresh = seriesCache && Date.now() - seriesCache.at < SERIES_TTL_MS;
  if (seriesCache && !fresh && !refreshing) {
    refreshing = buildResponse().finally(() => {
      refreshing = null;
    });
    void refreshing.catch(() => undefined);
  }
  if (seriesCache) return seriesCache.data;
  if (!refreshing) refreshing = buildResponse().finally(() => { refreshing = null; });
  return refreshing;
}

/** 부팅·일일 빌드 후 캐시 워밍 — 첫 사용자가 콜드 비용을 내지 않게. */
export function warmMarketIndexes(): void {
  void getMarketIndexes().catch(() => undefined);
}
