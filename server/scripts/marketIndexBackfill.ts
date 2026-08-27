/**
 * 시장 지표 히스토리 1회 백필 — tcgcsv 일별 아카이브로 ARVO OP200 등 서버 계산 지수를
 * 2024-02-08(아카이브 시작)부터 재구성해 server/data/marketIndexSeed.json 에 쓴다.
 *
 * 실서버(NAS)는 이 파일을 부팅 시 DB 로 들여온 뒤 매일 라이브 /prices 로 한 스텝씩 이어간다
 * (server/lib/marketIndex.ts). 산식·유니버스·디바이저 수학이 일일 빌더와 동일해 백필 구간과
 * 이후 구간이 하나의 연속 시리즈가 된다. 바스켓은 날짜마다 다시 뽑는다(동적 멤버십).
 *
 * 샘플링: 오래된 구간은 주 1회, 최근 183일은 매일(1M/3M/6M 차트가 일 단위 해상도).
 * 아카이브는 PPMd 7z 라 7zip-min(devDependency, 개발 PC 전용)으로 푼다 — 운영 서버는
 * 이 스크립트를 실행하지 않는다.
 *
 *   cd server && npx tsx scripts/marketIndexBackfill.ts
 *   (env TCGCSV_ARCHIVE_DIR 로 아카이브 캐시 위치 지정 가능)
 */
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ARCHIVE_START,
  COMPUTED_INDEXES,
  SEED_PATH,
  advanceCarry,
  buildCatalog,
  carryPrices,
  eligibilityFor,
  firstEditionExcluded,
  guardPrices,
  pricesFromRows,
  pruneWindows,
  stepIndex,
  tcgcsvSnapshotDate,
  type IndexState,
  type SeedFile,
  type SeedSeries,
} from '../lib/marketIndex.js';

const TCGCSV = 'https://tcgcsv.com';
const STEP_DAYS = 7;
const DENSE_DAYS = 183;
const ARCHIVE_DIR = process.env.TCGCSV_ARCHIVE_DIR ?? path.resolve(process.cwd(), '.tcgcsv-archive');

const log = (s: string) => console.log(`[backfill] ${s}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function sampleDates(latest: string): string[] {
  const denseStart = addDays(latest, -DENSE_DAYS) > ARCHIVE_START ? addDays(latest, -DENSE_DAYS) : ARCHIVE_START;
  const dates: string[] = [];
  for (let d = ARCHIVE_START; d < denseStart; d = addDays(d, STEP_DAYS)) dates.push(d);
  for (let d = denseStart; d <= latest; d = addDays(d, 1)) dates.push(d);
  return Array.from(new Set(dates)).sort();
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** 아카이브 다운로드(캐시). 미공개 날짜(404)면 null. */
async function fetchArchive(date: string): Promise<string | null> {
  const file = path.join(ARCHIVE_DIR, `prices-${date}.ppmd.7z`);
  if (await exists(file)) return file;
  const url = `${TCGCSV}/archive/tcgplayer/prices-${date}.ppmd.7z`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'arvotcg-market-index/1.0' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await writeFile(file, Buffer.from(await r.arrayBuffer()));
      return file;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1500 * 2 ** attempt);
    }
  }
  return null;
}

/** 아카이브에서 카테고리 price 파일만 풀어 {productId → 대표가}. */
async function archivePrices(date: string, category: number): Promise<Map<string, number> | null> {
  const archive = await fetchArchive(date);
  if (!archive) return null;
  const sz = await import('7zip-min');
  const entries = (await sz.list(archive)) as Array<{ name: string }>;
  const prefix = `${date}/${category}/`;
  const targets = entries.map((e) => e.name).filter((n) => n.startsWith(prefix) && n.endsWith('/prices'));
  if (targets.length === 0) return null;
  const dest = path.join(ARCHIVE_DIR, `x-${date}`);
  await rm(dest, { recursive: true, force: true });
  await sz.unpackSome(archive, targets, dest);
  const out = new Map<string, number>();
  const catDir = path.join(dest, date, String(category));
  let groups: string[] = [];
  try {
    groups = await readdir(catDir);
  } catch {
    // 카테고리 없음
  }
  for (const g of groups) {
    try {
      const j = JSON.parse(await readFile(path.join(catDir, g, 'prices'), 'utf8')) as { results?: unknown[] };
      pricesFromRows((j.results ?? []) as Parameters<typeof pricesFromRows>[0], out, firstEditionExcluded(category));
    } catch {
      // 파일 하나 손상은 건너뜀
    }
  }
  await rm(dest, { recursive: true, force: true });
  return out;
}

async function main(): Promise<void> {
  await mkdir(ARCHIVE_DIR, { recursive: true });
  const latest = await tcgcsvSnapshotDate();
  if (!latest) throw new Error('tcgcsv last-updated unavailable');
  const dates = sampleDates(latest);
  log(`latest snapshot ${latest} · ${dates.length} sample dates (${dates[0]} → ${dates[dates.length - 1]})`);

  const seed: SeedFile = { generatedAt: new Date().toISOString(), series: {} };

  for (const def of COMPUTED_INDEXES) {
    log(`${def.key}: building catalog (category ${def.category})`);
    const catalog = await buildCatalog(def.category, log);
    log(`${def.key}: ${catalog.size} singles`);

    const points: SeedSeries['points'] = [];
    let prev: { basket: Array<[string, number]>; divisor: number } | null = null;
    let carry: Record<string, [number, string]> = {};
    const windows: Record<string, number[]> = {};
    let lastDate = '';
    let lastEffective = new Map<string, number>();

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const raw = await archivePrices(date, def.category);
      if (!raw) {
        log(`${def.key} ${date}: archive missing — skip`);
        continue;
      }
      if (raw.size < def.size) {
        log(`${def.key} ${date}: only ${raw.size} priced — skip`);
        continue;
      }
      const prices = guardPrices(raw, windows);
      const carryMap = carryPrices(carry);
      const step = stepIndex(prices, catalog, prev, carryMap, def.size, eligibilityFor(date, catalog, windows));
      if (step.ids.length === 0) {
        // 자격(프린트 2회 이상) 종목이 아직 없는 첫 샘플 — 포인트 없이 carry 만 진행. 다음 샘플이 기준일(=1000).
        carry = advanceCarry(carry, prices, date);
        log(`${def.key} ${date}: no eligible products yet — base moves to next sample`);
        continue;
      }
      points.push({
        date,
        value: Math.round(step.index * 100) / 100,
        totalValue: Math.round(step.sumToday * 100) / 100,
        count: step.ids.length,
      });
      carry = advanceCarry(carry, prices, date);
      prev = { basket: step.basket, divisor: step.divisor };
      lastDate = date;
      lastEffective = new Map(carryMap);
      for (const [k, v] of prices) lastEffective.set(k, v);
      if (i % 10 === 0 || i === dates.length - 1) {
        log(`${def.key} ${date}: index ${step.index.toFixed(2)} (basket ${step.ids.length}, $${Math.round(step.sumToday).toLocaleString()}) [${i + 1}/${dates.length}]`);
      }
    }
    if (!prev || points.length === 0) throw new Error(`${def.key}: no points reconstructed`);

    const state: IndexState = {
      divisor: prev.divisor,
      ids: prev.basket.map(([pid]) => pid),
      basket: prev.basket,
      carry,
      windows: pruneWindows(windows, lastEffective, catalog, def.size),
      lastDate,
    };
    seed.series[def.key] = { points, state };
    log(`${def.key}: done — ${points.length} points, index ${points[points.length - 1].value} @ ${lastDate}`);
  }

  await mkdir(path.dirname(SEED_PATH), { recursive: true });
  await writeFile(SEED_PATH, JSON.stringify(seed));
  log(`wrote ${SEED_PATH}`);
}

main().catch((err) => {
  console.error('[backfill] ERROR', err);
  process.exit(1);
});
