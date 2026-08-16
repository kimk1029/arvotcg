/**
 * 일러스트레이터 검색 — TCGdex JA 의 cards?illustrator=eq:... 쿼리로 그 작가의
 * 카드 리스트를 가져온다. 사용자가 한국어로 "신지칸다" 같이 입력하면 매핑으로
 * 정식 이름(영문) 으로 변환 후 검색.
 *
 * 데이터 단일 소스: [[shared/data/illustrators.json]] — 웹/모바일 TS 헬퍼
 * (illustratorMap.ts) 와 같은 JSON 을 직접 fs 로 읽는다.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TCGdex from '@tcgdex/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** @type {Array<{tcgdexName:string, ja?:string, en:string, koAliases:string[]}>} */
const ILLUSTRATORS = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'shared', 'data', 'illustrators.json'), 'utf8'),
);

const tcgdexJa = new TCGdex('ja');
const tcgdexEn = new TCGdex('en');

function normalize(s) {
  return String(s ?? '').replace(/\s+/g, '').toLowerCase();
}

/** 어순 무시 비교용 — 공백 단위 토큰을 정렬 후 이어붙임 ("arita mitsuhiro" ≡ "Mitsuhiro Arita"). */
function normalizeSorted(s) {
  return String(s ?? '').trim().toLowerCase().split(/\s+/).sort().join('');
}

/**
 * 입력(한/영/일) → TCGdex 가 인식하는 정식 이름.
 * 영문은 어순이 달라도(성·이름 순서) 매칭하고, 4자 이상이면 부분 일치도 허용
 * (예: "arita" → Mitsuhiro Arita). 매칭 실패 시 입력 그대로 반환.
 */
export function lookupIllustrator(query) {
  const raw = String(query ?? '').trim();
  if (!raw) return { matched: null, tcgdexName: '' };
  const norm = normalize(raw);
  const sorted = normalizeSorted(raw);
  for (const e of ILLUSTRATORS) {
    if (e.koAliases.some((a) => normalize(a) === norm)) return { matched: e, tcgdexName: e.tcgdexName };
    if (e.ja && normalize(e.ja) === norm) return { matched: e, tcgdexName: e.tcgdexName };
    if (normalize(e.en) === norm || normalizeSorted(e.en) === sorted) return { matched: e, tcgdexName: e.tcgdexName };
    if (normalize(e.tcgdexName) === norm || normalizeSorted(e.tcgdexName) === sorted) return { matched: e, tcgdexName: e.tcgdexName };
  }
  // 부분 일치 폴백 — 정확 일치가 전부 실패했을 때만 (짧은 입력 오매칭 방지 4자+).
  if (norm.length >= 4) {
    const hit = ILLUSTRATORS.find(
      (e) => normalize(e.en).includes(norm) || normalize(e.tcgdexName).includes(norm),
    );
    if (hit) return { matched: hit, tcgdexName: hit.tcgdexName };
  }
  return { matched: null, tcgdexName: raw };
}

/** "mitsuhiro arita" → "Mitsuhiro Arita" — 사전 미등록 영문 입력의 TCGdex 정확검색(eq:) 보정. */
function titleCase(s) {
  return String(s ?? '').replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * TCGdex 에서 illustrator 로 카드 검색. JA 우선, miss 면 EN.
 * @param {string} illustratorName - TCGdex 정식 이름
 * @param {number} limit
 * @returns {Promise<Array<any>>}
 */
export async function searchTcgdexByIllustrator(illustratorName, limit = 30) {
  const name = String(illustratorName ?? '').trim();
  if (!name) return [];

  // TCGdex REST API 직접 호출 (SDK 의 list query 가 illustrator 필터 미지원).
  // ?illustrator=eq:Shinji%20Kanda 형식 — 대소문자 정확 일치라, 사전 미등록 영문
  // 소문자 입력은 Title Case 로도 재시도한다.
  const candidates = [...new Set([name, titleCase(name)])];
  const langs = ['ja', 'en'];
  for (const tryName of candidates) {
  for (const lang of langs) {
    const url = `https://api.tcgdex.net/v2/${lang}/cards?illustrator=eq:${encodeURIComponent(tryName)}`;
    try {
      // 외부 API 가 매달리면 클라이언트 스피너가 영원히 돈다 — 12초 컷.
      const resp = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
      if (!resp.ok) continue;
      /** @type {Array<{id:string, localId?:string, name?:string, image?:string}>} */
      const brief = await resp.json();
      if (!Array.isArray(brief) || brief.length === 0) continue;

      // 최신 세트(=뒤 id 가 더 클 가능성) 우선. 같은 일러스트레이터의 같은 포켓몬은
      // 여러 print 가 있어 시각적 중복이 많다.
      brief.sort((a, b) => String(b.id ?? '').localeCompare(String(a.id ?? '')));
      const slice = brief.slice(0, limit);

      // 각 카드의 상세 (image + price) — JA 우선.
      const client = lang === 'ja' ? tcgdexJa : tcgdexEn;
      const fulls = await Promise.all(
        slice.map(async (b) => {
          try {
            const card = await client.card.get(b.id);
            return card ? normalizeBriefCard(card, lang) : null;
          } catch {
            return null;
          }
        }),
      );
      const found = fulls.filter((c) => c && c.id);
      if (found.length > 0) return found;
    } catch (e) {
      console.warn('[illustrator] tcgdex fetch failed:', e?.message ?? e);
    }
  }
  }

  return [];
}

function normalizeBriefCard(card, lang) {
  const setCode = card?.set?.id ?? '';
  const localId = card?.localId ?? '';
  return {
    id: card.id,
    name: card.name,
    setName: card?.set?.name ?? '',
    setCode,
    number: localId,
    totalNumber: card?.set?.cardCount?.official ?? card?.set?.cardCount?.total ?? '',
    rarity: card.rarity ?? '',
    illustrator: card.illustrator ?? '',
    imageSmall: safeImg(card?.image, 'low', 'webp'),
    imageLarge: safeImg(card?.image, 'high', 'png'),
    sourceLang: lang,
  };
}

function safeImg(base, quality, format) {
  if (!base) return null;
  return `${base}/${quality}.${format}`;
}
