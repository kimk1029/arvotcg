/**
 * KREAM 검색 — 공개 JSON API가 403(서명 헤더 필요)이고 헤드리스는 안티봇 차단이라,
 * Nuxt(Vue) SSR 검색 페이지 HTML을 파싱해서 결과를 추출한다.
 *
 * 주의: KREAM은 스크래핑에 적대적이라 같은 IP로 반복 요청하면 500/차단된다.
 * 그래서 next.revalidate 로 쿼리당 캐시하고, 실패 시 빈 배열로 폴백한다(호출부는
 * "KREAM에서 검색" 이동 버튼을 항상 함께 노출).
 */

const KREAM_ORIGIN = 'https://kream.co.kr';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REVALIDATE_SEC = 300;
const MAX_ITEMS = 40;

export interface KreamItem {
  id: string;
  name: string;
  /** 즉시판매가(원). 파싱 실패 시 0. */
  price: number;
  imageUrl: string | null;
  productUrl: string;
}

export function kreamSearchUrl(query: string): string {
  return `${KREAM_ORIGIN}/search?keyword=${encodeURIComponent(query)}`;
}

export function kreamProductUrl(id: string): string {
  return `${KREAM_ORIGIN}/products/${id}`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * KREAM 검색 SSR HTML 파서. 카드 래퍼는 `data-sdui-id="product_card/<id>"` 로 시작하고,
 * 상품명은 `<img alt>`, 가격은 카드 텍스트의 `숫자원`, 이미지는 kream-phinf srcset 에 있다.
 */
export function parseKreamSearchHtml(html: string): KreamItem[] {
  const noc = html.replace(/<!--[\s\S]*?-->/g, '');
  const segs = noc.split('product_card/');
  const seen = new Set<string>();
  const out: KreamItem[] = [];
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i];
    const id = (seg.match(/^(\d+)/) || [])[1];
    if (!id || seen.has(id)) continue;
    const alt = decodeEntities((seg.match(/alt="([^"]*)"/) || [])[1] || '');
    const name = alt
      .replace(/\s+/g, ' ')
      .replace(/^포켓몬\s?TCG\s*/i, '')
      .replace(/^Pokemon\s?TCG\s*/i, '')
      // 뒤에 붙는 영문 중복명 (...) 제거 — 한글 "(일어판)" 등은 보존
      .replace(/\s*\([A-Za-z0-9][^()]*\)\s*$/, '')
      .trim();
    const text = seg.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    const pm = text.match(/([\d,]{2,})\s*원/);
    const price = pm ? Number(pm[1].replace(/,/g, '')) : 0;
    const rawImg = (seg.match(/srcset="(https:\/\/kream-phinf[^" ]+)"/) || [])[1] || '';
    const imageUrl = rawImg ? decodeEntities(rawImg) : null;
    if (!name && !price) continue;
    seen.add(id);
    out.push({ id, name: name || '(이름 없음)', price, imageUrl, productUrl: kreamProductUrl(id) });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/**
 * KREAM 릴레이 — KREAM 안티봇이 데이터센터 IP(Vultr·Vercel 등)를 차단할 수 있어,
 * 메인 API 서버(클라우드)는 국내 가정용 IP(NAS)의 릴레이 서버를 폴백으로 둔다.
 *
 *   순서 (2026-09-08): ① 이 서버에서 직접 스크레이핑 → ② 실패/차단이면 릴레이(NAS).
 *   · 직접 시도가 차단(non-OK·타임아웃)되면 DIRECT_BLOCK_TTL 동안은 직접 시도를 건너뛰고
 *     바로 릴레이로 간다 — 차단 시 KREAM 이 연결을 늘어뜨려 매 요청 6초를 버리지 않게.
 *   · KREAM_RELAY_ORIGIN 미설정(NAS 인스턴스 자신)이면 직접 시도만 한다.
 *
 * ⚠️ NAS(릴레이 제공자) 쪽에는 이 env 를 절대 설정하지 말 것 — 자기 자신을
 *    호출하는 루프가 된다. 캐시는 호출자(fetchKreamSearch) 계층에서 동일하게
 *    적용되므로 릴레이 결과도 로컬 캐시되어 NAS 부하를 줄인다.
 */
const KREAM_RELAY_ORIGIN = (process.env.KREAM_RELAY_ORIGIN ?? '').replace(/\/$/, '');
/** 직접 시도가 차단됐다고 판단한 뒤 릴레이만 쓰는 시간. */
const DIRECT_BLOCK_TTL = 10 * 60 * 1000;
let directBlockedUntil = 0;

/** 진단용 — /api/kream/search 응답 meta 에 실어 "지금 어느 경로인지" 바깥에서 볼 수 있게. */
export function kreamRouteState(): { relay: boolean; directBlocked: boolean } {
  return { relay: KREAM_RELAY_ORIGIN !== '', directBlocked: Date.now() < directBlockedUntil };
}

async function fetchKreamViaRelay(q: string, token?: string): Promise<KreamItem[]> {
  if (!token || !KREAM_RELAY_ORIGIN.startsWith('https://')) return [];
  try {
    const res = await fetch(
      `${KREAM_RELAY_ORIGIN}/api/kream/search?q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: KreamItem[] };
    return Array.isArray(body.items) ? body.items : [];
  } catch (err) {
    console.warn('[kream.relay] fetch failed', err instanceof Error ? err.message : err);
    return [];
  }
}

/** 이 프로세스의 IP 로 직접 스크레이핑. blocked = 차단으로 볼 만한 실패(non-OK/타임아웃/네트워크). */
async function fetchKreamDirect(q: string): Promise<{ items: KreamItem[]; blocked: boolean }> {
  try {
    const res = await fetch(kreamSearchUrl(q), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'ko',
        Accept: 'text/html',
        Referer: `${KREAM_ORIGIN}/`,
      },
      next: { revalidate: REVALIDATE_SEC },
      // KREAM 안티봇은 차단 시 연결을 늘어뜨려 응답을 안 준다 → 6초면 끊고 폴백.
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.error('[kream] non-OK', res.status, q);
      return { items: [], blocked: true };
    }
    return { items: parseKreamSearchHtml(await res.text()), blocked: false };
  } catch (err) {
    console.error('[kream] fetch failed', q, err);
    return { items: [], blocked: true };
  }
}

async function fetchKreamRaw(q: string, token?: string): Promise<KreamItem[]> {
  // ① 직접 — 최근 차단 표시가 없을 때만.
  if (Date.now() >= directBlockedUntil) {
    const direct = await fetchKreamDirect(q);
    if (direct.items.length > 0) return direct.items;
    if (direct.blocked) {
      directBlockedUntil = Date.now() + DIRECT_BLOCK_TTL;
      console.warn(
        `[kream] direct blocked — relay${KREAM_RELAY_ORIGIN ? ' (' + KREAM_RELAY_ORIGIN + ')' : ' 없음'} for ${DIRECT_BLOCK_TTL / 60000}m`,
      );
    }
    // OK 인데 빈 결과: 실제로 검색 결과가 없거나 안티봇이 빈 페이지를 준 경우 → 릴레이가 있으면 한 번 더.
  }
  // ② 릴레이(NAS) 폴백.
  if (KREAM_RELAY_ORIGIN) return fetchKreamViaRelay(q, token);
  return [];
}

// ── 서버 프로세스 인메모리 캐시 ──
// KREAM은 같은 IP 반복 요청을 500/차단하므로, 검색어당 결과를 일정 시간 캐시해
// 실제 KREAM 요청 빈도를 크게 낮춘다. 성공은 길게, 빈/실패는 짧게 캐시(곧 복구 시도).
interface CacheEntry {
  ts: number;
  ttl: number;
  items: KreamItem[];
}
const SUCCESS_TTL = 30 * 60 * 1000; // 30분
const EMPTY_TTL = 5 * 60 * 1000; // 빈/차단 응답은 5분만 (그 사이 KREAM 재호출 안 함)
const MAX_ENTRIES = 300;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<KreamItem[]>>();

/**
 * KREAM 검색 (캐시됨). 같은 검색어는 TTL 동안 KREAM에 재요청하지 않고,
 * 동시 요청은 in-flight 하나로 합친다. 실패/차단 시 빈 배열.
 */
export async function fetchKreamSearch(query: string, token?: string): Promise<KreamItem[]> {
  const q = query.trim();
  if (!q) return [];
  const now = Date.now();

  const cached = cache.get(q);
  if (cached && now - cached.ts < cached.ttl) return cached.items;

  const pending = inflight.get(q);
  if (pending) return pending;

  const p = (async () => {
    try {
      const items = await fetchKreamRaw(q, token);
      cache.set(q, { ts: Date.now(), ttl: items.length > 0 ? SUCCESS_TTL : EMPTY_TTL, items });
      // 오래된 항목 정리 (메모리 상한)
      if (cache.size > MAX_ENTRIES) {
        let oldestKey: string | null = null;
        let oldestTs = Infinity;
        for (const [k, v] of cache) {
          if (v.ts < oldestTs) {
            oldestTs = v.ts;
            oldestKey = k;
          }
        }
        if (oldestKey) cache.delete(oldestKey);
      }
      return items;
    } finally {
      inflight.delete(q);
    }
  })();
  inflight.set(q, p);
  return p;
}
