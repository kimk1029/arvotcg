/**
 * SNKRDUNK 공통 로직 — 웹·모바일·NAS 서버 공유 단일 소스.
 *
 * 여기에는 플랫폼 무관한 순수 로직만 둔다:
 *   - 타입 / raw 응답 → SnkrdunkApparel 변환 / 싱글·박스 분류
 *   - 일본어 라벨 한국어 로컬라이즈, 등급 배지 판정
 *   - 검색 SSR HTML 파서 (절대 재구현 금지 — 과거 중복 사본이 파싱 버그 원인)
 *   - 차트 다운샘플링
 *
 * 실제 네트워크 fetch 는 각 플랫폼에 남긴다:
 *   - 웹/서버: src/lib/snkrdunk.ts (Next fetch revalidate 캐시)
 *   - 모바일: mobile/src/services/snkrdunk.ts (직접 호출 + timeout)
 */

import { gameFromKeywords, gameFromSnkrdunkBrand, type CardGame } from './cardStatics';

export const SNKRDUNK_ORIGIN = 'https://snkrdunk.com';

export const SNKRDUNK_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ── 타입 ─────────────────────────────────────────────────────────── */

export type SnkrdunkItemKind = 'single' | 'box';

export interface SnkrdunkApparel {
  id: number;
  name: string;
  localizedName: string;
  imageUrl: string | null;
  /** 자체 CDN 캐싱 webp 경로. 서버 라우트가 채움. 미캐싱이면 없음 → imageUrl 폴백. */
  cdnImageUrl?: string | null;
  itemKind: SnkrdunkItemKind;
  minPrice: number;
  regularPrice: number;
  displayPrice: string;
  listingCount: number;
  listingCountText: string;
  releasedAt: string | null;
  productNumber: string;
  /** DB 카탈로그 보강(서버 /apparels/:id) — 파싱된 세트코드. 박스는 소속 팩의 세트코드. 없으면 null. */
  setCode?: string | null;
  /** DB 카탈로그 보강 — 소속 팩 코드(CARD_PACKS.code). 없으면 null. */
  packCode?: string | null;
  /** 스니덩크 상품 카탈로그 id — v3 trading-history(수량별 체결) 조회 키. 없으면 구형 sales-history 폴백. */
  productCatalogId?: number | null;
  /** 작품 — raw brands(ONE PIECE·YU-GI-OH·Pokemon Card Game)에서 판정, 없으면 이름 키워드. 모르면 null(카탈로그가 이름 파싱 폴백). */
  game?: CardGame | null;
}

export interface SnkrdunkSaleEntry {
  /** 체결가 — fetcher 를 거친 뒤엔 항상 1개 단가 (묶음 체결은 수량으로 나눈 값, toUnitPriceSale). */
  price: number;
  date: string;
  size: string;
  condition: string;
  /** "中古" 등 거래 라벨. 싱글카드 응답에만 옴. */
  label: string;
  /** 묶음 수량 — size "2個/3枚" 에서 파싱. 단품이면 1. toUnitPriceSale 이 채운다. */
  units?: number;
}

export interface SnkrdunkSalesHistory {
  history: SnkrdunkSaleEntry[];
}

export interface SnkrdunkSalesChart {
  points: Array<[number, number]>;
  rangeKeys?: Array<{ key: string; text: string; enabled: boolean }>;
  /** 차트 수량 기준 — 1 이면 1장 체결. 1장 체결이 없어 묶음(2·3장) 차트를 쓴 경우 그 장수(가격은 1장 단가로 나눔). */
  units?: number;
}

export interface SnkrdunkApparelGroupPage {
  apparels: SnkrdunkApparel[];
  apparelsCount: number;
}

export interface RawApparel {
  id: number;
  productCatalogId?: number;
  brands?: Array<{ name?: string; localizedName?: string }>;
  name?: string;
  localizedName?: string;
  primaryMedia?: { imageUrl?: string };
  colorName?: string;
  colorLocalizedName?: string;
  minPrice?: number;
  usedMinPrice?: number;
  regularPrice?: number;
  displayPrice?: string;
  listingCount?: number;
  usedListingCount?: number;
  listingCountText?: string;
  usedListingCountText?: string;
  releasedAt?: string;
  productNumber?: string;
  categories?: Array<{ name?: string; localizedName?: string }>;
  totalListingCount?: number;
  totalListingCountText?: string;
  totalOfferCount?: number;
  totalOfferCountText?: string;
}

export interface RawApparelGroupPage {
  apparels?: RawApparel[];
  apparelsCount?: number;
}

export function snkrdunkApparelUrl(apparelId: number): string {
  return `${SNKRDUNK_ORIGIN}/apparels/${apparelId}`;
}

/* ── 분류 / 변환 ──────────────────────────────────────────────────── */

export function classifySnkrdunkItem(raw: RawApparel): SnkrdunkItemKind {
  const names = [
    raw.name,
    raw.localizedName,
    raw.productNumber,
    raw.colorName,
    raw.colorLocalizedName,
    ...(raw.categories ?? []).flatMap((c) => [c.name, c.localizedName]),
  ]
    .filter(Boolean)
    .join(' ');

  if (/trading-card-single|シングルカード|single/i.test(names)) return 'single';
  // 카드 번호 [n/m] / 카드 코드 [OP05-119] / 싱글 품번은 싱글 확정 (classifySnkrdunkName 과 동일 규칙).
  if (looksLikeSingleCardRef(names, raw.productNumber)) return 'single';
  if (/ボックス|BOX|Box|デッキビルド|スターターセット|ポケモンセンターセット|シュリンク|trading_card/i.test(names)) {
    return 'box';
  }
  if (raw.usedMinPrice && raw.usedMinPrice > 0 && (!raw.minPrice || raw.minPrice <= 0)) return 'single';
  return 'box';
}

/**
 * 이름만으로 싱글/박스 분류 — 검색 결과(SnkrdunkSearchResult)에는 상세 itemKind 가
 * 없어 name 으로만 판별해야 할 때 사용. 박스 마커가 보이면 box, 아니면 single.
 * (DashboardScreen 클라이언트의 BOX_NAME_RE 와 마커를 일치시킬 것 — 변경 시 양쪽 수정)
 */
export function classifySnkrdunkName(
  name: string | null | undefined,
  productNumber?: string | null,
): SnkrdunkItemKind {
  const n = name ?? '';
  if (/シングルカード|trading-card-single/i.test(n)) return 'single';
  // 싱글 카드명은 소속 팩명을 꼬리표로 달고 온다 — 「リザードンV SR [S9 103/100](拡張パック「スターバース」)」,
  // 「モンキー・D・ルフィ SEC [OP05-119](ブースターパック「神速の拳」)」. 팩 마커(拡張パック·ブースター 등)보다
  // 카드 번호/코드가 우선 — 이걸 먼저 보지 않으면 싱글 전부가 박스로 오판되어 컬렉션 '박스 제외'에서
  // 카드까지 빠진다 (2026-09-07 실측: 포켓몬 [n/m]·원피스 [OP05-119]·[ST01-012]).
  if (looksLikeSingleCardRef(n, productNumber)) return 'single';
  if (/ボックス|box|booster|ブースター|デッキビルド|スターター|拡張パック|ハイクラスパック|ポケモンセンターセット|シュリンク/i.test(n)) return 'box';
  return 'single';
}

/** 이름 대괄호 안의 카드 번호 `[S9 103/100]` 또는 카드 코드 `[OP05-119]`·`[QCCP-JP001]`. */
const CARD_REF_IN_BRACKET_RE =
  /\[[^\]]*(?:\d{1,3}\s*\/\s*\d{1,3}|\b[A-Z]{1,6}\d{1,3}-[A-Z]{0,3}\d{2,4}\b|\b[A-Z]{2,6}-[A-Z]{2}\d{3}\b)[^\]]*\]/;
/**
 * 싱글 카드 품번 — 원피스 `OP05-119`/`ST01-012`(세트코드에 숫자 포함 + 대시 + 번호), 유희왕 `QCCP-JP001`.
 * 포켓몬 `pkmn-tcg-…` 는 박스(`pkmn-tcg-M1L`)에도 붙어 판별 불가라 이름 대괄호에 맡긴다.
 * 박스 코드 `OP-05` 는 대시 앞에 숫자가 없어 매칭되지 않는다.
 */
const SINGLE_PRODUCT_NUMBER_RE = /^(?:[A-Z]{1,6}\d{1,3}-[A-Z]{0,3}\d{2,4}|[A-Z]{2,6}-[A-Z]{2}\d{3})$/i;

/** 이름/품번에서 싱글 카드 참조가 보이면 true — classifySnkrdunkName/classifySnkrdunkItem 공통. */
export function looksLikeSingleCardRef(name: string | null | undefined, productNumber?: string | null): boolean {
  if (name && CARD_REF_IN_BRACKET_RE.test(name)) return true;
  return SINGLE_PRODUCT_NUMBER_RE.test((productNumber ?? '').trim());
}

/** raw 응답 → 통합 SnkrdunkApparel. 싱글카드는 중고(usedMinPrice) 시장만 있어 활성 쪽 노출. */
export function toSnkrdunkApparel(raw: RawApparel, itemKind?: SnkrdunkItemKind): SnkrdunkApparel {
  const newMin = raw.minPrice ?? 0;
  const usedMin = raw.usedMinPrice ?? 0;
  const useUsed = newMin <= 0 && usedMin > 0;
  const totalListingCount = raw.totalListingCount ?? raw.listingCount ?? 0;
  const totalListingCountText = raw.totalListingCountText ?? raw.listingCountText ?? '';

  return {
    id: raw.id,
    name: raw.name ?? '',
    localizedName: raw.localizedName ?? raw.name ?? '',
    imageUrl: raw.primaryMedia?.imageUrl ?? null,
    itemKind: itemKind ?? classifySnkrdunkItem(raw),
    minPrice: useUsed ? usedMin : newMin,
    regularPrice: raw.regularPrice ?? 0,
    displayPrice: raw.displayPrice ?? '',
    listingCount: useUsed ? (raw.usedListingCount ?? totalListingCount) : totalListingCount,
    listingCountText: useUsed ? (raw.usedListingCountText ?? totalListingCountText) : totalListingCountText,
    releasedAt: raw.releasedAt ?? null,
    productNumber: raw.productNumber ?? '',
    productCatalogId: raw.productCatalogId ?? null,
    game: snkrdunkGameFromRaw(raw),
  };
}

/** raw apparel 의 작품 판정 — brands 우선(정확), 없으면 이름 키워드. 모르면 null. */
export function snkrdunkGameFromRaw(raw: Pick<RawApparel, 'brands' | 'name' | 'localizedName'>): CardGame | null {
  for (const b of raw.brands ?? []) {
    const g = gameFromSnkrdunkBrand(b.name) ?? gameFromSnkrdunkBrand(b.localizedName);
    if (g) return g;
  }
  return gameFromKeywords(`${raw.localizedName ?? ''} ${raw.name ?? ''}`);
}

/* ── v3 trading-history (수량별 체결) ─────────────────────────────── */

/**
 * 스니덩크 사이트가 시세상세에 쓰는 `/v3/products/{productCatalogId}/trading-history` 응답.
 * 구형 `/v1/apparels/{id}/sales-history` 는 모든 수량(1枚·2枚…)의 체결을 수량 표시 없이 섞어 줘서
 * 묶음 체결이 1장 체결처럼 보였다(2026-09-08 실측). v3 는 variant(수량)별로만 주며 기본은 1枚.
 */
export interface RawTradingHistory {
  filters?: { variants?: { title?: string; options?: Array<{ id: number; name: string }>; showAllOption?: boolean } };
  trades?: Array<{ price: number; soldAt: string; title: string; label: string }>;
  chart?: { lines?: Array<{ labelName?: string | null; points?: Array<{ timestamp: number; price: number }> }>; ranges?: string[] };
}

/** v3 chart → 시세 차트 포인트([ts, 1장 단가]) 오름차순. 묶음 variant 차트면 units 로 나눈다. */
export function tradingHistoryToChart(raw: RawTradingHistory | null | undefined, units = 1): SnkrdunkSalesChart | null {
  const pts = (raw?.chart?.lines ?? [])
    .flatMap((l) => l.points ?? [])
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.price) && p.price > 0)
    .map((p): [number, number] => [p.timestamp, units > 1 ? Math.round(p.price / units) : p.price])
    .sort((a, b) => a[0] - b[0]);
  return pts.length > 0 ? { points: pts, units } : null;
}

/**
 * 체결 목록이 묶음뿐일 때(1장 체결 없음) 화면이 "N장 묶음 단가 기준" 을 표시하도록 — 가장 작은 묶음 장수.
 * 1장 체결이 하나라도 있거나 목록이 비면 1.
 */
export function bundleOnlyUnits(history: ReadonlyArray<Pick<SnkrdunkSaleEntry, 'units'>>): number {
  if (history.length === 0) return 1;
  let min = Infinity;
  for (const h of history) {
    const u = h.units ?? 1;
    if (u <= 1) return 1;
    if (u < min) min = u;
  }
  return Number.isFinite(min) ? min : 1;
}

/** "2枚" / "3個" → 2 / 3. 다른 형식이면 null. */
export function parseUnitLabel(label: string | null | undefined): number | null {
  const m = /^(\d+)\s*(個|枚)$/.exec((label ?? '').trim());
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** 시세상세에 묶음 체결도 보여줄 수량 — 2·3장 묶음까지(요청 2건 추가). 그 이상은 드물어 생략. */
export const BUNDLE_UNITS_TO_FETCH: readonly number[] = [2, 3];

/**
 * ISO 체결 시각 → 구형 API 의 date 문구와 같은 형식("16分前"·"3時間前"·"1日前"·"2026/08/29").
 * 화면은 localizeSnkrdunkText 로 한글화하므로 일본어 형식을 유지한다. 날짜는 JST 기준.
 */
export function formatSnkrdunkSoldAt(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diff = now - t;
  const min = Math.floor(diff / 60_000), hour = Math.floor(diff / 3_600_000), day = Math.floor(diff / 86_400_000);
  if (min < 60) return `${Math.max(0, min)}分前`;
  if (hour < 24) return `${hour}時間前`;
  if (day < 2) return '1日前';
  const jst = new Date(t + 9 * 3_600_000);
  return `${jst.getUTCFullYear()}/${String(jst.getUTCMonth() + 1).padStart(2, '0')}/${String(jst.getUTCDate()).padStart(2, '0')}`;
}

/**
 * v3 trades → SnkrdunkSaleEntry(1개 단가 + units). label 이 수량("2枚"), title 이 상태(PSA10·A…).
 * 여러 수량의 목록을 합칠 때는 soldAt 내림차순으로 병합(mergeTradingHistories).
 */
export function tradingHistoryToSales(raw: RawTradingHistory | null | undefined, now = Date.now()): Array<SnkrdunkSaleEntry & { soldAt: string }> {
  return (raw?.trades ?? [])
    .filter((t) => Number.isFinite(t.price) && t.price > 0)
    .map((t) => {
      // title/label 중 어느 쪽이 수량("2枚")인지 응답마다 다를 수 있어 파싱되는 쪽을 수량, 나머지를 상태로 쓴다
      // (상태 칸에 '2枚' 가 일본어 그대로 뜨던 원인). 화면은 condition 을 localizeSnkrdunkText 로 한글화한다.
      const fromLabel = parseUnitLabel(t.label);
      const fromTitle = parseUnitLabel(t.title);
      const units = fromLabel ?? fromTitle ?? 1;
      const condition = (fromLabel != null ? t.title : fromTitle != null ? t.label : t.title) ?? '';
      const sizeText = fromLabel != null ? t.label : fromTitle != null ? t.title : '';
      return {
        price: units > 1 ? Math.round(t.price / units) : t.price,
        date: formatSnkrdunkSoldAt(t.soldAt, now),
        size: units > 1 ? sizeText.trim() : '',
        condition: condition.trim(),
        label: '中古',
        units,
        soldAt: t.soldAt,
      };
    });
}

/** 수량별 목록 병합 — 최신 체결 순, 상한 limit. */
export function mergeTradingHistories(lists: Array<Array<SnkrdunkSaleEntry & { soldAt: string }>>, limit = 60): SnkrdunkSaleEntry[] {
  return lists
    .flat()
    .sort((a, b) => Date.parse(b.soldAt) - Date.parse(a.soldAt))
    .slice(0, limit)
    .map(({ soldAt: _soldAt, ...entry }) => entry);
}

/** v3 filters 에서 원하는 수량(2枚·3枚…)의 variant id 를 고른다. */
export function pickBundleVariantIds(raw: RawTradingHistory | null | undefined, units: readonly number[] = BUNDLE_UNITS_TO_FETCH): Array<{ id: number; units: number }> {
  const out: Array<{ id: number; units: number }> = [];
  for (const o of raw?.filters?.variants?.options ?? []) {
    const n = parseUnitLabel(o.name);
    if (n != null && units.includes(n)) out.push({ id: o.id, units: n });
  }
  return out;
}

/** 묶음 수량 — size "2個" / "3枚" → 2 / 3. 비어 있거나 다른 형식이면 1(단품). */
export function saleUnitCount(entry: Pick<SnkrdunkSaleEntry, 'size'>): number {
  const m = /^(\d+)\s*(個|枚)$/.exec((entry.size ?? '').trim());
  const n = m ? Number(m[1]) : 1;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * 묶음 체결을 1개 단가로 정규화 — 체결가·헤드라인(중앙값)·등급 집계 전부 "1개 기준" 으로 맞춘다
 * (2026-09-08 사용자 지시). 예전엔 묶음을 통째로 버렸는데(isSingleUnitSale) 표본이 줄고,
 * 남은 값과 화면의 "가격" 이 어긋났다. units 에 수량을 남겨 화면이 'N개 단가' 를 표시할 수 있다.
 */
export function toUnitPriceSale(entry: SnkrdunkSaleEntry): SnkrdunkSaleEntry {
  // 이미 단가 환산된 항목(v3 경로, units 채워짐)은 그대로 — 두 번 나누지 않는다(멱등).
  if (typeof entry.units === 'number' && entry.units >= 1) return entry;
  const units = saleUnitCount(entry);
  if (units <= 1) return entry.units === 1 ? entry : { ...entry, units: 1 };
  return { ...entry, price: Math.round(entry.price / units), units };
}

/** @deprecated 묶음 체결은 이제 제외하지 않고 toUnitPriceSale 로 단가 환산한다. 호환용으로만 남김. */
export function isSingleUnitSale(entry: SnkrdunkSaleEntry): boolean {
  return saleUnitCount(entry) <= 1;
}

/* ── 로컬라이즈 / 등급 판정 ───────────────────────────────────────── */

/**
 * 스니다 응답의 일본어 상대시간/단위/라벨을 한국어로 변환.
 *   "16分前" → "16분 전", "中古" → "중고", "2024年5月10日" → "2024.5.10" …
 */
export function localizeSnkrdunkText(value: string | null | undefined): string {
  if (!value) return '';
  let v = String(value);
  // 일본식 날짜 → 점 표기
  v = v.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日/g, '$1.$2.$3');
  v = v.replace(/(\d{1,2})月(\d{1,2})日/g, '$1.$2');
  // 상대 시간
  v = v.replace(/(\d+)\s*秒前/g, '$1초 전');
  v = v.replace(/(\d+)\s*分前/g, '$1분 전');
  v = v.replace(/(\d+)\s*時間前/g, '$1시간 전');
  v = v.replace(/(\d+)\s*日前/g, '$1일 전');
  v = v.replace(/(\d+)\s*週間前/g, '$1주 전');
  v = v.replace(/(\d+)\s*ヶ月前/g, '$1개월 전');
  v = v.replace(/(\d+)\s*か月前/g, '$1개월 전');
  v = v.replace(/(\d+)\s*年前/g, '$1년 전');
  v = v.replace(/たった今/g, '방금');
  v = v.replace(/今日/g, '오늘');
  v = v.replace(/昨日/g, '어제');
  // 상태 표기 (PSA8以下 등)
  v = v.replace(/以下/g, ' 이하');
  v = v.replace(/以上/g, ' 이상');
  // 수량 단위
  v = v.replace(/(\d+)\s*個/g, '$1개');
  v = v.replace(/(\d+)\s*枚/g, '$1장');
  v = v.replace(/(\d+)\s*点/g, '$1점');
  v = v.replace(/(\d+)\s*件/g, '$1건');
  v = v.replace(/(\d+)\s*回/g, '$1회');
  // 상태/라벨
  v = v.replace(/中古/g, '중고');
  v = v.replace(/新品/g, '새상품');
  v = v.replace(/美品/g, '미품');
  v = v.replace(/未開封/g, '미개봉');
  v = v.replace(/開封済み/g, '개봉됨');
  v = v.replace(/開封済/g, '개봉됨');
  v = v.replace(/シュリンク付き/g, '슈링크 있음');
  v = v.replace(/シュリンクあり/g, '슈링크 있음');
  v = v.replace(/シュリンクなし/g, '슈링크 없음');
  v = v.replace(/鑑定済み/g, '감정 완료');
  v = v.replace(/鑑定品/g, '감정품');
  v = v.replace(/通常版/g, '일반판');
  v = v.replace(/プロモ/g, '프로모');
  v = v.replace(/シングル/g, '싱글');
  v = v.replace(/ボックス/g, '박스');
  v = v.replace(/ハーフ/g, '하프');
  v = v.replace(/状態/g, '상태');
  v = v.replace(/良好/g, '양호');
  v = v.replace(/折れ/g, '접힘');
  v = v.replace(/擦れ/g, '긁힘');
  v = v.replace(/キズあり/g, '흠집 있음');
  v = v.replace(/キズなし/g, '흠집 없음');
  v = v.replace(/最新/g, '최신');
  v = v.replace(/発売/g, '발매');
  v = v.replace(/送料込/g, '배송비 포함');
  v = v.replace(/送料無料/g, '배송비 무료');
  return v;
}

/**
 * 거래 라벨(condition/label)이 '감정(그레이드)된 카드' 인지 판정.
 * snkrdunk condition 은 비등급이면 상태등급(S/A/B/C/D)·中古 처럼 숫자/등급사명이 없고,
 * 감정품이면 PSA10·PSA9·BGS9以下·PSA8以下 처럼 등급사명/숫자/"○以下" 가 들어간다.
 * RAW(비등급) 시세 집계에서 PSA 외 타 등급사(BGS·CGC 등) 오염을 막기 위해 사용.
 */
const GRADED_BADGE_RE = /PSA|BGS|CGC|SGC|ARS|ACE|BVG|HGA|以下|\d/i;
export function isGradedSnkrdunkBadge(badge: string | null | undefined): boolean {
  return GRADED_BADGE_RE.test((badge ?? '').trim());
}

/* ── 검색 SSR HTML 파서 ───────────────────────────────────────────── */

export interface SnkrdunkSearchResult {
  apparelId: number;
  name: string;
  imageUrl: string | null;
  priceText: string;
}

// 메인 결과 그리드 타일은 `/apparels/{id}/used/{listingId}` 처럼 id 뒤에 경로가 더
// 붙는다(특정 중고매물로 링크). 예전 정규식은 id 바로 뒤 `"` 만 매칭해 그리드 타일을
// 통째로 놓치고 상단 추천 캐러셀(맨 id 링크)만 ~20개 잡혀 "조금밖에 안 나오는" 원인이었다.
// → id 뒤 선택적 경로(`(?:\/[^"]*)?`)를 허용. 캡처(\d+)는 여전히 apparelId 만 잡는다.
const SEARCH_ITEM_RE =
  /<a[^>]*href="https:\/\/snkrdunk\.com\/apparels\/(\d+)(?:\/[^"]*)?"[^>]*aria-label="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/g;

/** 검색 한 페이지당 파싱 상한. 이 수만큼 차면 다음 페이지(page+1)가 더 있다고 간주.
 *  그리드까지 잡으면 한 페이지에 캐러셀+그리드 합쳐 40개를 넘길 수 있어 60으로 상향. */
export const SNKRDUNK_SEARCH_LIMIT = 60;

/**
 * 추천/전체 목록용 카드 풀. 전용 API가 없어 검색 HTML을 일본어 키워드로 스크래핑.
 */
export const SNKRDUNK_BROWSE_KEYWORD = 'ポケモンカード';

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** HTML 파서 — 검색 결과 카드를 추출. */
export function parseSnkrdunkSearchHtml(html: string): SnkrdunkSearchResult[] {
  const seen = new Set<number>();
  const out: SnkrdunkSearchResult[] = [];
  let m: RegExpExecArray | null;
  // RegExp 상태가 모듈 간 공유되지 않도록 매번 새로 생성
  const re = new RegExp(SEARCH_ITEM_RE.source, SEARCH_ITEM_RE.flags);
  while ((m = re.exec(html)) !== null) {
    const id = Number(m[1]);
    if (!Number.isInteger(id) || seen.has(id)) continue;
    seen.add(id);
    const ariaLabel = decodeHtmlEntities(m[2]);
    // aria-label 형태: "{name} - ¥{price}"
    const sepIdx = ariaLabel.lastIndexOf(' - ¥');
    const name = sepIdx > 0 ? ariaLabel.slice(0, sepIdx).trim() : ariaLabel.trim();
    const priceText = sepIdx > 0 ? `¥${ariaLabel.slice(sepIdx + 4).trim()}` : '';
    out.push({ apparelId: id, name, imageUrl: m[3] || null, priceText });
    if (out.length >= SNKRDUNK_SEARCH_LIMIT) break;
  }
  return out;
}

/* ── 차트 다운샘플링 ──────────────────────────────────────────────── */

/**
 * 거래 포인트를 시간 버킷으로 평균내어 다운샘플링.
 * 데이터 기간에 따라 적응형 — 짧으면 원본, 수개월이면 주별, 1년 이상이면 월별.
 * 입력 포인트는 [ms, price]. 출력은 버킷 시작 시각으로 정렬된 동일 형식.
 */
export type PriceDownsampleUnit = 'raw' | 'weekly' | 'monthly';

const _DAY_MS = 86_400_000;

function pickDownsampleUnit(spanMs: number): PriceDownsampleUnit {
  if (spanMs > 365 * _DAY_MS) return 'monthly';
  if (spanMs > 60 * _DAY_MS) return 'weekly';
  return 'raw';
}

/** rawPoints 의 시간 범위로 결정되는 단위. 차트 캡션/툴팁용. */
export function priceDownsampleUnit(
  points: Array<[number, number]>,
): PriceDownsampleUnit {
  if (points.length < 2) return 'raw';
  let min = points[0][0];
  let max = points[0][0];
  for (const [t] of points) {
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return pickDownsampleUnit(max - min);
}

/** UI 표시용 한국어 단위 라벨. */
export function priceUnitLabelKo(unit: PriceDownsampleUnit): string {
  if (unit === 'monthly') return '월';
  if (unit === 'weekly') return '주';
  return '건';
}

export function downsamplePricePoints(
  points: Array<[number, number]>,
): Array<[number, number]> {
  if (points.length < 2) return points.slice();
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  const spanMs = sorted[sorted.length - 1][0] - sorted[0][0];
  const WEEK = 7 * _DAY_MS;
  const MONTH = 30 * _DAY_MS;
  const unit = pickDownsampleUnit(spanMs);
  if (unit === 'raw') return sorted;
  const bucket = unit === 'monthly' ? MONTH : WEEK;

  const map = new Map<number, { sum: number; n: number }>();
  for (const [ts, price] of sorted) {
    const key = Math.floor(ts / bucket) * bucket;
    const b = map.get(key);
    if (b) {
      b.sum += price;
      b.n += 1;
    } else {
      map.set(key, { sum: price, n: 1 });
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, b]) => [key, Math.round(b.sum / b.n)] as [number, number]);
}
