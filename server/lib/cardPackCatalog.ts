/**
 * 팩 카탈로그 + 대표 박스 1건 — `GET /api/card-packs?withBox=1` 서빙용.
 *
 * 웹·앱 시세확인 목록이 클라이언트에 번들된 CARD_PACKS 를 순회하며 팩마다
 * NAS 를 호출하던 구조를 서버 1회 호출로 통일 — 카탈로그(shared/data/cardPacks.ts)에
 * 세트를 추가해 서버만 배포하면 웹·앱 재배포 없이 목록에 바로 뜬다.
 *
 * 캐시: 인메모리 TTL 10분 + stale-while-revalidate(만료 후 첫 요청은 이전 캐시를
 * 즉시 주고 백그라운드 갱신). snkrdunk 호출은 동시성 6 cap — 60여 팩을 한 번에
 * 두드리지 않는다.
 */
import { CARD_PACKS, type CardPackMeta } from '@/lib/cardPacks';
import { fetchSnkrdunkApparelGroup, fetchSnkrdunkSearch } from '@/lib/snkrdunk';
// shared 정본 심볼은 shim 의 `export *` 를 거치면 tsx CJS interop 이 이름을 못 봐
// 부팅이 죽는다(NAS) — 반드시 shared 에서 직접 import (cardPackHits.ts 와 동일).
import { translateKnownCardNameToKo } from '../../shared/cardTranslate';

export interface PackWithBox extends Omit<CardPackMeta, 'hits'> {
  boxName: string;
  boxKoName: string;
  boxImageUrl: string | null;
  boxPrice: number;
}

const TTL_MS = 10 * 60 * 1000;
const CONCURRENCY = 6;

let cache: { data: PackWithBox[]; at: number } | null = null;
let inFlight: Promise<PackWithBox[]> | null = null;

async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

/** 그룹 있으면 박스 카테고리(14) 1건, 그룹 미확인(0)이면 '검색어 + ボックス' 첫 매물. */
async function resolveBox(pack: CardPackMeta): Promise<PackWithBox> {
  const { hits: _hits, ...meta } = pack;
  const fallback: PackWithBox = {
    ...meta,
    boxName: pack.searchQuery,
    boxKoName: pack.name,
    boxImageUrl: null,
    boxPrice: 0,
  };
  try {
    if (!pack.apparelGroupId) {
      const results = await fetchSnkrdunkSearch(`${pack.searchQuery} ボックス`, 1);
      const hit = results[0];
      if (!hit) return fallback;
      return {
        ...meta,
        boxName: hit.name,
        boxKoName: translateKnownCardNameToKo(hit.name),
        boxImageUrl: hit.imageUrl,
        boxPrice: Number((hit.priceText ?? '').replace(/[^\d]/g, '')) || 0,
      };
    }
    const page = await fetchSnkrdunkApparelGroup(pack.apparelGroupId, {
      apparelCategoryId: 14,
      page: 1,
      perPage: 1,
    });
    const box = page?.apparels?.[0];
    if (!box) return fallback;
    const name = box.localizedName || box.name;
    return {
      ...meta,
      boxName: name,
      boxKoName: translateKnownCardNameToKo(name),
      boxImageUrl: box.imageUrl,
      boxPrice: box.minPrice,
    };
  } catch (err) {
    console.error('[cardPackCatalog.resolveBox]', pack.code, err);
    return fallback;
  }
}

function refresh(): Promise<PackWithBox[]> {
  if (!inFlight) {
    inFlight = mapWithLimit(CARD_PACKS, CONCURRENCY, resolveBox)
      .then((data) => {
        cache = { data, at: Date.now() };
        return data;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export async function getPacksWithBox(): Promise<PackWithBox[]> {
  if (cache) {
    // stale 이면 백그라운드 갱신을 걸어두고 이전 캐시를 즉시 서빙.
    if (Date.now() - cache.at >= TTL_MS) refresh().catch(() => {});
    return cache.data;
  }
  return refresh();
}
