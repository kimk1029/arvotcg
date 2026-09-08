import { api, getApiBaseUrl } from '@/lib/apiClient';
import { isSameKstDay, kstDateParts } from '../../../shared/kst';

const NAVER_API = 'https://apis.naver.com';
const CAFE_ORIGIN = 'https://cafe.naver.com';
const BUNJANG_API = 'https://api.bunjang.co.kr';
const BUNJANG_WEB = 'https://m.bunjang.co.kr';
const KREAM_ORIGIN = 'https://kream.co.kr';

const MVC_CLUB_ID = 30418914;
const MVC_AUCTION_MENU_ID = 63;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface MvcAuctionItem {
  articleId: number;
  subject: string;
  writerNickname: string;
  commentCount: number;
  readCount: number;
  writtenAt: number;
  writtenAgo: string;
  thumbnailUrl: string | null;
  costText: string;
  sourceUrl: string;
  /** 목록 API 첨부 이미지 플래그 — representImage 누락 시 본문 폴백 판단용(내부). */
  attachImage?: boolean;
}

export interface BunjangItem {
  pid: string;
  name: string;
  price: number;
  imageUrl: string | null;
  location: string;
  favCount: number;
  updatedAt: number;
  productUrl: string;
}

interface RawMvcArticle {
  articleId?: number;
  subject?: string;
  writerNickname?: string;
  commentCount?: number;
  readCount?: number;
  writeDateTimestamp?: number;
  representImage?: string;
  formattedCost?: string;
  blindArticle?: boolean;
  /** 첨부 이미지 존재 여부. representImage 가 비어도 true 면 본문에 이미지가 있음. */
  attachImage?: boolean;
}

interface RawMvcList {
  message?: {
    result?: {
      articleList?: RawMvcArticle[];
      hasNext?: boolean;
    };
  };
}

interface RawBunjangProduct {
  pid?: string | number;
  name?: string;
  price?: string | number;
  product_image?: string;
  location?: string;
  num_faved?: string | number;
  update_time?: number;
}

interface RawBunjangList {
  list?: RawBunjangProduct[];
}

export function mvcArticleUrl(articleId: number): string {
  return `${CAFE_ORIGIN}/f-e/cafes/${MVC_CLUB_ID}/articles/${articleId}`;
}

export function mvcImgProxy(url: string | null | undefined): string {
  if (!url) return '';
  if (!/^https:\/\/[^/]*\.pstatic\.net\//.test(url)) return url;
  return `${getApiBaseUrl()}/api/navercafe/img?u=${encodeURIComponent(url)}`;
}

export function bunjangSearchUrl(query: string): string {
  return `${BUNJANG_WEB}/search/products?q=${encodeURIComponent(query)}`;
}

function relativeTimeKo(ts: number): string {
  if (!ts || !Number.isFinite(ts)) return '';
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function isTodayDeadline(subject: string): boolean | null {
  const { m: month, d: day } = kstDateParts();
  const today = { month, day };
  const re = /(\d{1,2})\s*[\/.월]\s*(\d{1,2})/g;
  let found = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(subject)) !== null) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    found = true;
    if (month === today.month && day === today.day) return true;
  }
  return found ? false : null;
}

function stripDeadlinePrefix(subject: string): string {
  return subject
    .trim()
    .replace(/^\s*[([{][^)\]}]*?(?:마감|\d{1,2}\s*[/.월]\s*\d{1,2})[^)\]}]*[)\]}]\s*[-–:_]?\s*/, '')
    .replace(/^\s*\d{1,2}\s*[/.월]\s*\d{1,2}\s*일?\s*(?:당일)?마감\s*[-–:_]?\s*/, '')
    .trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function cafeThumb(url: string | undefined): string | null {
  if (!url) return null;
  const clean = decodeHtmlEntities(url);
  if (!/^https?:\/\//.test(clean)) return null;
  return /[?&]type=/.test(clean) ? clean.replace(/([?&]type=)[^&]+/, '$1w300') : `${clean}?type=w300`;
}

function toNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const n = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function bunjangImage(template: string | undefined): string | null {
  if (!template) return null;
  return template.replace('{cnt}', '1').replace('{res}', '300');
}

/** 경매 게시판 한 페이지 — 오늘 마감 글만 필터해 반환 + 다음 페이지 존재 여부. */
async function fetchMvcAuctionsPage(
  page = 1,
): Promise<{ items: MvcAuctionItem[]; hasNext: boolean }> {
  const url =
    `${NAVER_API}/cafe-web/cafe2/ArticleListV2dot1.json` +
    `?search.clubid=${MVC_CLUB_ID}&search.menuid=${MVC_AUCTION_MENU_ID}` +
    `&search.boardtype=L&search.page=${page}&search.perPage=50`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ko,en-US;q=0.8',
      'User-Agent': USER_AGENT,
      Referer: `${CAFE_ORIGIN}/f-e/cafes/${MVC_CLUB_ID}/menus/${MVC_AUCTION_MENU_ID}`,
    },
  });
  if (!res.ok) throw new Error(`MVC ${res.status}`);
  const raw = (await res.json()) as RawMvcList;
  const rows = raw.message?.result?.articleList ?? [];
  const hasNext = Boolean(raw.message?.result?.hasNext);
  const items: MvcAuctionItem[] = rows
    .filter((a) => !a.blindArticle && Number.isInteger(a.articleId))
    .filter((a) => {
      const subject = a.subject ?? '';
      const verdict = isTodayDeadline(subject);
      if (verdict === true) return true;
      if (verdict === false) return false;
      return isSameKstDay(a.writeDateTimestamp ?? 0);
    })
    .map((a) => {
      const articleId = a.articleId ?? 0;
      const writtenAt = a.writeDateTimestamp ?? 0;
      return {
        articleId,
        subject: stripDeadlinePrefix(a.subject ?? '') || (a.subject ?? ''),
        writerNickname: a.writerNickname ?? '',
        commentCount: a.commentCount ?? 0,
        readCount: a.readCount ?? 0,
        writtenAt,
        writtenAgo: relativeTimeKo(writtenAt),
        thumbnailUrl: cafeThumb(a.representImage),
        costText: (a.formattedCost ?? '').trim(),
        sourceUrl: mvcArticleUrl(articleId),
        attachImage: Boolean(a.attachImage),
      };
    });
  // representImage 누락(attachImage=true) 글은 본문 첫 이미지로 썸네일 폴백.
  await fillMissingThumbnails(items);
  return { items, hasNext };
}

export async function fetchMvcAuctions(page = 1): Promise<MvcAuctionItem[]> {
  return (await fetchMvcAuctionsPage(page)).items;
}

/**
 * 오늘(KST) 마감 경매 '전체'.
 *   오늘 마감 글이 카페 목록 여러 페이지에 흩어져 있어(예: 24개가 p1=17 + p2=7),
 *   1페이지만 보면 일부가 누락된다 → hasNext=false 까지(안전 상한 maxPages) 끝까지
 *   훑어 모은다. 경매 게시판은 작아(현재 ~2페이지) 비용이 낮다.
 */
export async function fetchAllTodayAuctions(maxPages = 6): Promise<MvcAuctionItem[]> {
  const cap = Math.min(Math.max(Number.isInteger(maxPages) ? maxPages : 6, 1), 30);
  const out: MvcAuctionItem[] = [];
  const seen = new Set<number>();
  for (let p = 1; p <= cap; p++) {
    const { items, hasNext } = await fetchMvcAuctionsPage(p);
    for (const it of items) {
      if (seen.has(it.articleId)) continue;
      seen.add(it.articleId);
      out.push(it);
    }
    if (!hasNext) break;
  }
  return out;
}

const CAFE_IMG_RE = /<img[^>]+src="(https:\/\/[^"]+)"/i;

interface RawMvcArticleDetail {
  result?: { article?: { contentHtml?: string } };
}

/** 한 경매글 본문의 첫 이미지(w300 썸네일). 없거나 실패 시 null. */
async function fetchMvcFirstImage(articleId: number): Promise<string | null> {
  if (!Number.isInteger(articleId) || articleId <= 0) return null;
  try {
    const url =
      `${NAVER_API}/cafe-web/cafe-articleapi/v3/cafes/${MVC_CLUB_ID}/articles/${articleId}` +
      `?query=&useCafeId=true&requestFrom=A`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'ko,en-US;q=0.8',
        'User-Agent': USER_AGENT,
        Referer: mvcArticleUrl(articleId),
      },
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as RawMvcArticleDetail;
    const m = CAFE_IMG_RE.exec(raw.result?.article?.contentHtml ?? '');
    return m ? cafeThumb(m[1]) : null;
  } catch {
    return null;
  }
}

/** representImage 누락 + attachImage=true 인 글들의 썸네일을 본문 첫 이미지로 채움(cap 제한). */
async function fillMissingThumbnails(items: MvcAuctionItem[], cap = 12): Promise<void> {
  const targets = items.filter((it) => !it.thumbnailUrl && it.attachImage).slice(0, cap);
  if (targets.length === 0) return;
  const imgs = await Promise.all(targets.map((it) => fetchMvcFirstImage(it.articleId)));
  targets.forEach((it, i) => {
    if (imgs[i]) it.thumbnailUrl = imgs[i];
  });
}

/** 한 경매글의 '최종호가'(최신 댓글). 웹 navercafe.fetchMvcLatestBid 의 모바일 포팅. */
export interface MvcLatestBid {
  articleId: number;
  /** 최신 댓글에서 파싱한 호가(원). 실패 시 null. */
  amount: number | null;
  content: string;
  commentCount: number;
  writtenAt: number;
}

interface RawComment {
  content?: string;
  isDeleted?: boolean;
  updateDate?: number;
}
interface RawLatestCommentsResponse {
  result?: { comments?: { items?: RawComment[] }; displayCommentCount?: number };
}

/** 댓글 본문에서 호가(원) 파싱 — "12만3천" / "123,000" 등. */
export function parseBidAmount(content: string): number | null {
  if (!content) return null;
  const s = content.replace(/,/g, '').trim();
  const unit = s.match(/(\d+)\s*만(?:\s*(\d+)\s*천)?/);
  if (unit) {
    const man = Number(unit[1]) * 10000;
    const cheon = unit[2] ? Number(unit[2]) * 1000 : 0;
    return man + cheon;
  }
  const cheonOnly = s.match(/^(\d+)\s*천$/);
  if (cheonOnly) return Number(cheonOnly[1]) * 1000;
  const num = s.match(/\d{2,}/);
  if (num) {
    const n = Number(num[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export async function fetchMvcLatestBid(articleId: number): Promise<MvcLatestBid | null> {
  if (!Number.isInteger(articleId) || articleId <= 0) return null;
  const url =
    `${NAVER_API}/cafe-web/cafe-articleapi/v2/cafes/${MVC_CLUB_ID}/articles/${articleId}` +
    `/comments/pages/1?requestFrom=A&orderBy=desc&page=1`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'ko,en-US;q=0.8',
        'User-Agent': USER_AGENT,
        Referer: `${CAFE_ORIGIN}/f-e/cafes/${MVC_CLUB_ID}/articles/${articleId}`,
      },
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as RawLatestCommentsResponse;
    const items = raw?.result?.comments?.items ?? [];
    const commentCount = raw?.result?.displayCommentCount ?? items.length;
    // 정렬 가정 없이 최대 updateDate 의 유효 댓글 = 최종호가.
    let latest: RawComment | null = null;
    for (const c of items) {
      if (c.isDeleted || !(c.content ?? '').trim()) continue;
      if (!latest || (c.updateDate ?? 0) > (latest.updateDate ?? 0)) latest = c;
    }
    if (!latest) return null;
    const content = (latest.content ?? '').trim();
    return { articleId, amount: parseBidAmount(content), content, commentCount, writtenAt: latest.updateDate ?? 0 };
  } catch {
    return null;
  }
}

/** 여러 글의 최신 호가를 병렬 조회 (호출량 보호로 25건 제한). */
export async function fetchMvcLatestBids(
  articleIds: number[],
): Promise<Record<number, MvcLatestBid | null>> {
  const ids = articleIds.filter((id) => Number.isInteger(id) && id > 0).slice(0, 25);
  const results = await Promise.all(ids.map((id) => fetchMvcLatestBid(id)));
  const map: Record<number, MvcLatestBid | null> = {};
  ids.forEach((id, i) => {
    map[id] = results[i];
  });
  return map;
}

/* ── 경매글 상세 (본문/이미지/댓글) — 웹 navercafe.fetchMvcArticle 의 모바일 포팅 ── */

export interface MvcCommentItem {
  id: number;
  writerNickname: string;
  content: string;
  writtenAt: number;
  writtenAgo: string;
  /** 글 작성자(판매자)가 단 댓글인지. */
  byArticleWriter: boolean;
  deleted: boolean;
}

export interface MvcArticleDetail {
  articleId: number;
  subject: string;
  writerNickname: string;
  readCount: number;
  commentCount: number;
  writtenAgo: string;
  /** 본문 평문 텍스트. */
  contentText: string;
  /** 본문 이미지 URL(중간 크기). */
  images: string[];
  /** 작성순(오래된→최신) 댓글. */
  comments: MvcCommentItem[];
  /** 최종호가(가장 최근 유효 댓글). */
  latestBid: MvcCommentItem | null;
  latestBidAmount: number | null;
  sourceUrl: string;
}

interface RawArticleFull {
  result?: {
    article?: {
      subject?: string;
      contentHtml?: string;
      writeDate?: number;
      readCount?: number;
      commentCount?: number;
      writer?: { nick?: string };
    };
  };
}
interface RawCommentFull {
  id: number;
  content?: string;
  updateDate?: number;
  writer?: { nick?: string };
  isArticleWriter?: boolean;
  isDeleted?: boolean;
}
interface RawCommentsPage {
  result?: { comments?: { items?: RawCommentFull[] }; hasNext?: boolean };
}

const CAFE_IMG_RE_G = /<img[^>]+src="(https:\/\/[^"]+)"/gi;

/** 네이버 카페 이미지 URL의 type 파라미터를 원하는 크기로(없으면 추가). */
function cafeImg(url: string, type: string): string {
  const clean = decodeHtmlEntities(url);
  if (!/^https?:\/\//.test(clean)) return clean;
  return /[?&]type=/.test(clean) ? clean.replace(/([?&]type=)[^&]+/, `$1${type}`) : `${clean}?type=${type}`;
}

/** 본문 HTML → 이미지 URL 목록(중복 제거, 최대 20). */
function extractImages(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(CAFE_IMG_RE_G.source, CAFE_IMG_RE_G.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = decodeHtmlEntities(m[1]);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= 20) break;
  }
  return out;
}

/** 본문 HTML → 평문 텍스트. */
function htmlToText(html: string): string {
  if (!html) return '';
  let s = html;
  s = s.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  s = s.replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeHtmlEntities(s);
  s = s.replace(/​/g, '');
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

async function cafeJson<T>(url: string, articleId: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'ko,en-US;q=0.8',
        'User-Agent': USER_AGENT,
        Referer: `${CAFE_ORIGIN}/f-e/cafes/${MVC_CLUB_ID}/articles/${articleId}`,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function mapComment(c: RawCommentFull): MvcCommentItem {
  const writtenAt = c.updateDate ?? 0;
  return {
    id: c.id,
    writerNickname: c.writer?.nick ?? '',
    content: c.isDeleted ? '(삭제된 댓글)' : (c.content ?? '').trim(),
    writtenAt,
    writtenAgo: relativeTimeKo(writtenAt),
    byArticleWriter: Boolean(c.isArticleWriter),
    deleted: Boolean(c.isDeleted),
  };
}

/** v2 댓글 API로 전 페이지 수집(작성순, 중복 제거, cap 제한). */
async function fetchAllComments(articleId: number, cap = 300): Promise<MvcCommentItem[]> {
  const out: MvcCommentItem[] = [];
  const seen = new Set<number>();
  for (let page = 1; page <= 30 && out.length < cap; page++) {
    const url =
      `${NAVER_API}/cafe-web/cafe-articleapi/v2/cafes/${MVC_CLUB_ID}/articles/${articleId}` +
      `/comments/pages/${page}?requestFrom=A&orderBy=asc&page=${page}`;
    const raw = await cafeJson<RawCommentsPage>(url, articleId);
    const items = raw?.result?.comments?.items ?? [];
    if (items.length === 0) break;
    let added = 0;
    for (const c of items) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(mapComment(c));
      added++;
    }
    if (!raw?.result?.hasNext || added === 0) break;
  }
  return out.slice(0, cap);
}

function pickLatestComment(comments: MvcCommentItem[]): MvcCommentItem | null {
  let best: MvcCommentItem | null = null;
  for (const c of comments) {
    if (c.deleted || !c.content) continue;
    if (!best || c.writtenAt > best.writtenAt) best = c;
  }
  return best;
}

/** 단일 경매글 상세(본문 + 이미지 + 전체 댓글). 실패 시 null. */
export async function fetchMvcArticle(articleId: number): Promise<MvcArticleDetail | null> {
  if (!Number.isInteger(articleId) || articleId <= 0) return null;
  const url =
    `${NAVER_API}/cafe-web/cafe-articleapi/v3/cafes/${MVC_CLUB_ID}/articles/${articleId}` +
    `?query=&useCafeId=true&requestFrom=A`;
  const raw = await cafeJson<RawArticleFull>(url, articleId);
  const article = raw?.result?.article;
  if (!article) return null;
  const html = article.contentHtml ?? '';
  const comments = await fetchAllComments(articleId);
  const latestBid = pickLatestComment(comments);
  return {
    articleId,
    subject: (article.subject ?? '').trim(),
    writerNickname: article.writer?.nick ?? '',
    readCount: article.readCount ?? 0,
    commentCount: article.commentCount ?? comments.length,
    writtenAgo: relativeTimeKo(article.writeDate ?? 0),
    contentText: htmlToText(html),
    // pstatic CDN은 고정 프리셋(w300/w800/w1600)만 지원 — w800 사용(w640 등은 404).
    images: extractImages(html).map((u) => cafeImg(u, 'w800')),
    comments,
    latestBid,
    latestBidAmount: latestBid ? parseBidAmount(latestBid.content) : null,
    sourceUrl: mvcArticleUrl(articleId),
  };
}

/** 응답이 없을 때 무한 대기하지 않도록 ms 후 abort 하는 시그널. */
function abortAfter(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

export async function fetchBunjangItems(query = '포켓몬카드', page = 0): Promise<BunjangItem[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `${BUNJANG_API}/api/1/find_v2.json` +
    `?q=${encodeURIComponent(q)}&order=score&page=${page}&n=40&stat_device=w&version=4`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: abortAfter(10000),
  });
  if (!res.ok) throw new Error(`Bunjang ${res.status}`);
  const raw = (await res.json()) as RawBunjangList;
  return (raw.list ?? [])
    .filter((p) => p.pid != null)
    .map((p) => {
      const pid = String(p.pid);
      return {
        pid,
        name: (p.name ?? '').trim(),
        price: toNumber(p.price),
        imageUrl: bunjangImage(p.product_image),
        location: (p.location ?? '').trim(),
        favCount: toNumber(p.num_faved),
        updatedAt: typeof p.update_time === 'number' ? p.update_time * 1000 : 0,
        productUrl: `${BUNJANG_WEB}/products/${pid}`,
      };
    });
}

// ───────────────────────── 번개장터 상품 상세 ─────────────────────────

export interface BunjangProduct {
  pid: string;
  name: string;
  price: number;
  originPrice: number;
  description: string;
  images: string[];
  conditionText: string;
  saleStatusText: string;
  category: string;
  freeShipping: boolean;
  shippingFee: number;
  favCount: number;
  viewCount: number;
  commentCount: number;
  updatedAt: number;
  shopName: string;
  productUrl: string;
}

interface RawBunjangDetail {
  data?: {
    product?: {
      pid?: string | number;
      name?: string;
      price?: string | number;
      originPrice?: string | number;
      description?: string;
      imageUrl?: string;
      imageCount?: number;
      condition?: string;
      saleStatus?: string;
      category?: { name?: string };
      trade?: { freeShipping?: boolean; shippingSpecs?: Record<string, { fee?: number }> };
      metrics?: { favoriteCount?: number; viewCount?: number; commentCount?: number };
      updatedAt?: string;
    };
    shop?: { name?: string };
  };
}

const BUNJANG_CONDITION_KO: Record<string, string> = { NEW: '새상품', USED: '중고' };
const BUNJANG_SALE_STATUS_KO: Record<string, string> = {
  SELLING: '판매중',
  RESERVED: '예약중',
  SOLD: '판매완료',
  SOLD_OUT: '판매완료',
};

/** 번개장터 이미지 템플릿(..._{cnt}_..._w{res}.jpg)을 imageCount 만큼 전개. */
function buildBunjangImages(template: string | undefined, count: number | undefined): string[] {
  if (!template) return [];
  const n = Math.min(Math.max(count ?? 1, 1), 12);
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(template.replace('{cnt}', String(i)).replace('{res}', '600'));
  }
  return out;
}

/** 번개장터 상품 상세. 웹 `src/lib/bunjang.ts` 의 fetchBunjangProduct 포팅. */
export async function fetchBunjangProduct(pid: string): Promise<BunjangProduct | null> {
  const id = String(pid).trim();
  if (!/^\d+$/.test(id)) return null;
  const url = `${BUNJANG_API}/api/pms/v3/products-detail/${id}?viewerUid=-1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      Referer: `${BUNJANG_WEB}/products/${id}`,
    },
    signal: abortAfter(10000),
  });
  if (!res.ok) throw new Error(`Bunjang detail ${res.status}`);
  const data = (await res.json()) as RawBunjangDetail;
  const p = data.data?.product;
  if (!p || p.pid == null) return null;
  const fee = p.trade?.shippingSpecs?.DEFAULT?.fee ?? 0;
  const updatedMs = p.updatedAt ? Date.parse(p.updatedAt) : 0;
  return {
    pid: String(p.pid),
    name: (p.name ?? '').trim(),
    price: toNumber(p.price),
    originPrice: toNumber(p.originPrice),
    description: (p.description ?? '').trim(),
    images: buildBunjangImages(p.imageUrl, p.imageCount),
    conditionText: p.condition ? (BUNJANG_CONDITION_KO[p.condition] ?? p.condition) : '',
    saleStatusText: p.saleStatus ? (BUNJANG_SALE_STATUS_KO[p.saleStatus] ?? p.saleStatus) : '',
    category: p.category?.name ?? '',
    freeShipping: Boolean(p.trade?.freeShipping),
    shippingFee: Number.isFinite(fee) ? fee : 0,
    favCount: p.metrics?.favoriteCount ?? 0,
    viewCount: p.metrics?.viewCount ?? 0,
    commentCount: p.metrics?.commentCount ?? 0,
    updatedAt: Number.isFinite(updatedMs) ? updatedMs : 0,
    shopName: data.data?.shop?.name ?? '',
    productUrl: `${BUNJANG_WEB}/products/${p.pid}`,
  };
}

// ────────────────────────────────────────────────────────────
// KREAM (Nuxt SSR HTML 스크래핑 — JSON API는 403, 헤드리스 안티봇 차단)
// ────────────────────────────────────────────────────────────
export interface KreamItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  productUrl: string;
}

export function kreamSearchUrl(query: string): string {
  return `${KREAM_ORIGIN}/search?keyword=${encodeURIComponent(query)}`;
}

/** KREAM 검색 SSR HTML 파서 — 카드는 data-sdui-id="product_card/<id>", 이름은 img alt, 가격은 `숫자원`. */
/**
 * KREAM 검색 — 서버 /api/kream/search (웹 동일). 기기에서 kream.co.kr 을 직접 받으면
 * 2MB 대 SSR HTML 을 JS 스레드에서 파싱하느라 화면 전체가 멈췄다(2026-09-08 실측, 결과도 1건뿐).
 * 스크레이핑은 국내 IP 서버가 하고 앱은 결과만 받는다. 실패·타임아웃은 빈 배열(이동 버튼 폴백).
 */
export async function fetchKreamItems(query: string): Promise<KreamItem[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const r = await api<{ items?: KreamItem[] }>(`/api/kream/search?q=${encodeURIComponent(q)}`, {
      auth: false,
      signal: abortAfter(15000),
    });
    return Array.isArray(r?.items) ? r.items : [];
  } catch {
    return [];
  }
}
