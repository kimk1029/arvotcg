import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAuthHeader } from '@/lib/session';
import type { CardScanResponse, ScanUploadInput } from '@/types/cardScan';

/**
 * Polyfill for AbortSignal.timeout — Hermes/RN 0.81 doesn't ship it natively
 * yet, and calling AbortSignal.timeout(...) there throws "undefined is not a
 * function" before fetch even runs. We construct an equivalent signal from
 * AbortController + setTimeout.
 */
function abortAfter(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

function deriveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  // Use Metro's host (same tunnel) — metro.config.js proxies /api/* to the OCR server.
  const hostUri = (Constants.expoConfig as { hostUri?: string } | null)?.hostUri
    ?? (Constants.manifest2 as { extra?: { expoGo?: { developer?: { host?: string } } } } | null)?.extra?.expoGo?.developer?.host
    ?? '';
  // Embedded debug/release builds do not always expose Expo's hostUri.
  // Production fallback: hit the Synology server directly.
  if (!hostUri) return 'https://kimk1029.synology.me:3031';
  // Tunnel URLs already include scheme via .exp.direct (use https). LAN URLs use http.
  const isTunnel = /\.exp\.direct/.test(hostUri);
  const scheme = isTunnel ? 'https' : 'http';
  return `${scheme}://${hostUri.replace(/^https?:\/\//, '')}`;
}

const BASE_URL = deriveBaseUrl();
// Mock only when explicitly requested — we now have a real server.
const USE_MOCK = process.env.EXPO_PUBLIC_SCAN_MOCK === '1';

export class CardScanError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type CardLookupResult = {
  ok: boolean;
  source: 'local' | 'tcgdex-ja' | 'tcgdex-en' | 'none';
  found: boolean;
  card: {
    id?: string;
    name?: string;
    setName?: string;
    setCode?: string;
    number?: string;
    totalNumber?: string | number;
    rarity?: string;
    illustrator?: string;
    hp?: number;
    types?: string[];
    stage?: string;
    description?: string;
    attacks?: Array<{ cost?: string[]; name: string; effect?: string; damage?: string | number }>;
    weaknesses?: Array<{ type: string; value?: string }>;
    retreat?: number;
    imageSmall?: string | null;
    imageLarge?: string | null;
    pricing?: {
      cardmarket?: {
        avg?: number; low?: number; trend?: number; unit?: string; updated?: string;
      } | null;
      tcgplayer?: unknown;
    };
    priceSummary?: {
      source: string;
      value: number;
      currency: 'EUR' | 'USD' | 'KRW';
      low: number | null;
      trend: number | null;
      /** Same value rendered in each major market — server does the FX so
       *  the mobile UI can show EU / NA / JP / KR prices without depending
       *  on a live FX feed. JPY / KRW values are rounded to integer; EUR /
       *  USD keep 2 decimals. */
      byRegion?: {
        eur: number | null;
        usd: number | null;
        jpy: number | null;
        krw: number | null;
      };
    } | null;
    sourceLang?: 'ja' | 'en';
    /** Korean-name override merged in from the local cards.json — TCGdex
     * doesn't ship Korean (`ko`) yet, so JA/EN names come back as
     * 일본어/English. The mobile UI should prefer this when present. */
    localName?: string;
    marketPrice?: number;  // legacy: local DB rows ship this
    [k: string]: unknown;
  } | null;
  fields: {
    setCode: string;
    cardNumber: string;
    totalNumber: string;
    rarity: string;
    name: string;
    language: string;
  };
};

/**
 * GET /api/cards/lookup with the 3 critical fields from the OCR scan
 * (setCode + cardNumber + rarity, plus optional total/name).
 * Returns enriched card data from local DB or pokemontcg.io.
 */
export async function lookupCardInfo(args: {
  setCode: string;
  cardNumber: string;
  totalNumber?: string;
  rarity?: string;
  name?: string;
  language?: string;
}): Promise<CardLookupResult> {
  const params = new URLSearchParams();
  params.set('setCode', args.setCode);
  params.set('number', args.cardNumber);
  if (args.totalNumber) params.set('total', args.totalNumber);
  if (args.rarity) params.set('rarity', args.rarity);
  if (args.name) params.set('name', args.name);
  if (args.language) params.set('language', args.language);
  const url = `${BASE_URL}/api/cards/lookup?${params.toString()}`;
  const res = await fetch(url, { signal: abortAfter(12_000) });
  if (!res.ok) {
    throw new CardScanError('LOOKUP_FAILED', `lookup HTTP ${res.status}`);
  }
  return (await res.json()) as CardLookupResult;
}

/**
 * GET /api/cards/dominant-color — 카드 이미지 URL 에서 네온 톤 hex 추출.
 * 실패 시 null 반환 (호출자가 디폴트 그린 사용).
 */
export async function fetchDominantNeon(imageUrl: string): Promise<string | null> {
  const u = String(imageUrl ?? '').trim();
  if (!u) return null;
  try {
    const res = await fetch(
      `${BASE_URL}/api/cards/dominant-color?url=${encodeURIComponent(u)}`,
      { signal: abortAfter(8_000) },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { ok?: boolean; hex?: string };
    if (j?.ok && typeof j.hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(j.hex)) return j.hex;
    return null;
  } catch {
    return null;
  }
}

export async function uploadScanImage(input: ScanUploadInput): Promise<CardScanResponse> {
  if (USE_MOCK) return mockScan(input);

  const form = new FormData();
  const fileName = `scan-${Date.now()}.jpg`;
  // RN FormData accepts the {uri,name,type} shape on both iOS and Android.
  form.append('image', {
    uri: input.uri,
    name: fileName,
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('guideRect', JSON.stringify(input.guideRect));
  form.append('platform', Platform.OS);
  form.append('imageWidth', String(input.imageWidth));
  form.append('imageHeight', String(input.imageHeight));
  form.append('capturedAt', input.capturedAt);
  if (input.useAi) form.append('useAi', 'true');
  if (input.language) form.append('language', input.language);

  const url = `${BASE_URL}/api/cards/scan`;
  if (!BASE_URL) {
    throw new CardScanError('NO_BASE_URL', '서버 URL을 찾을 수 없습니다 (Constants.hostUri 없음)');
  }
  console.log('[cardScanApi] POST', url);
  let res: Response;
  try {
    // PaddleOCR runs ~25s per pass × 4 passes ≈ 100s in worst case. Default
    // RN fetch timeout (~60s on Android) was killing scans mid-flight, which
    // is what produced the "Network request failed" error.
    // 스캔은 서버에서 로그인 필수 — 세션 JWT 첨부
    const auth = getAuthHeader();
    res = await fetch(url, {
      method: 'POST',
      headers: auth ? { Authorization: auth } : undefined,
      body: form,
      signal: abortAfter(180_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('[cardScanApi] fetch error:', msg);
    throw new CardScanError('NETWORK', `네트워크 오류: ${msg.slice(0, 80)} (URL=${url})`);
  }

  if (res.status === 401) {
    throw new CardScanError('AUTH', '로그인 후 이용 가능합니다');
  }
  if (res.status === 429) {
    throw new CardScanError('RATE_LIMIT', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
  }
  if (!res.ok) {
    throw new CardScanError('SERVER', `서버 오류 (${res.status})`);
  }

  let data: CardScanResponse;
  try {
    data = (await res.json()) as CardScanResponse;
  } catch {
    throw new CardScanError('FORMAT', '응답 형식이 올바르지 않습니다.');
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.candidates)) {
    throw new CardScanError('FORMAT', '응답 형식이 올바르지 않습니다.');
  }
  return data;
}

/**
 * Mock scan response — deterministic across rapid retakes by hashing capturedAt.
 * Produces an "extracted" block focused on the bottom-left card-info area
 * (card number / set / rarity), then 1–2 candidates.
 */
function mockScan(input: ScanUploadInput): Promise<CardScanResponse> {
  const seed = simpleHash(input.capturedAt);
  return new Promise((resolve) => {
    setTimeout(() => {
      const pool = MOCK_CANDIDATES;
      const i = seed % pool.length;
      const primary = pool[i];
      // 30% chance multi-candidate
      const multi = seed % 10 < 3;
      const candidates = multi ? [primary, pool[(i + 1) % pool.length]] : [primary];
      resolve({
        success: true,
        scanId: `mock-${seed}`,
        confidence: multi ? 0.62 : 0.94,
        extracted: {
          rawText: `${primary.number} ${primary.setCode} ${primary.rarity}`,
          cardNumber: primary.number,
          totalNumber: primary.totalNumber,
          setCode: primary.setCode,
          rarity: primary.rarity,
          language: 'ko',
          name: primary.name,
        },
        candidates: candidates.map((c) => ({
          id: c.id,
          source: 'internal',
          name: c.name,
          setName: c.setName,
          setCode: c.setCode,
          number: `${c.number}/${c.totalNumber}`,
          rarity: c.rarity,
          language: 'ko',
          imageUrl: undefined,
          price: { marketPrice: c.price, currency: 'KRW', source: 'mock', updatedAt: new Date().toISOString() },
        })),
        needsUserSelection: multi,
        message: multi ? '비슷한 카드가 여러 장 있습니다. 맞는 카드를 골라주세요.' : undefined,
      });
    }, 1100);
  });
}

interface MockEntry {
  id: string;
  name: string;
  setName: string;
  setCode: string;
  number: string;
  totalNumber: string;
  rarity: string;
  price: number;
}
const MOCK_CANDIDATES: MockEntry[] = [
  { id: 'mock-sample-a', name: 'Ember Drake', setName: '샘플 세트', setCode: 'set-a', number: '006', totalNumber: '165', rarity: 'SR', price: 128000 },
  { id: 'mock-sample-b', name: 'Aurora Fox', setName: '샘플 세트 2', setCode: 'set-b', number: '044', totalNumber: '185', rarity: 'HR', price: 85000 },
  { id: 'mock-mewtwo-gx', name: '샘플 홀로 카드', setName: '울트라 샤이니', setCode: 'sm8b', number: '093', totalNumber: '150', rarity: 'SR', price: 62000 },
  { id: 'mock-sample-c', name: 'Solar Titan', setName: '샘플 세트 3', setCode: 'set-c', number: '076', totalNumber: '069', rarity: 'SR', price: 54000 },
  { id: 'mock-greninja', name: '개굴닌자 ex', setName: '레이징 서프', setCode: 'sv4a', number: '106', totalNumber: '108', rarity: 'SAR', price: 71000 },
];

function simpleHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
