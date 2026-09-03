'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  mvcImgProxy,
  stripDeadlinePrefix,
  upscaleCafeThumb,
  MVC_CAFE_URL,
  type MvcAuctionItem,
  type MvcAuctionPageResult,
  type MvcLatestBid,
} from '@/lib/navercafe';
import { useTheme } from '@/components/ThemeProvider';
import { useUnread } from '@/components/UnreadProvider';
import { ListAdRow } from '@/components/ListAdRow';
import { useListingFavorites, type ListingFavorite } from '@/lib/useListingFavorites';

/**
 * 경매(MVC) — Claude Design 'ARVOTCG 경매' 프로토타입 레이아웃.
 *  헤더(경매+검색·알림·경매내역) · 다크 히어로 · 상태 탭(진행중/예정/종료+관심) ·
 *  필터 칩 · 🔥 마감 임박(가로 카드) · 🔨 주목할 만한 경매(세로 리스트) · 출품 FAB.
 * 모든 테마가 같은 레이아웃을 쓰고 색/폰트만 테마별(클린=레드 포인트, 그 외=CSS변수).
 * 데이터/입찰갱신/관심/무한스크롤 로직은 그대로 유지하고 표현만 새 디자인으로.
 */

const RED = '#F5333F';
const MAX_PAGE = 30;
const PAGES_PER_TRIGGER = 5;
const BID_CHUNK = 25;
const FEATURE_COUNT = 8; // 마감 임박 가로 카드 수
const AUTO_REFRESH_MS = 30_000; // 마감 임박 카드 호가 자동 갱신

type BidMap = Record<number, MvcLatestBid | null>;

interface Palette {
  pageBg: string;
  cardBg: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  line: string;
  chev: string;
  chipBd: string;
  chipFg: string;
}

const CLEAN_P: Palette = {
  pageBg: '#ffffff',
  cardBg: '#ffffff',
  ink: '#16161a',
  ink2: '#6B6B70',
  ink3: '#9A9AA0',
  accent: RED,
  line: '#F0F0F2',
  chev: '#9A9AA0',
  chipBd: '#E5E5EA',
  chipFg: '#16161a',
};

const VAR_P: Palette = {
  pageBg: 'var(--paper)',
  cardBg: 'var(--paper)',
  ink: 'var(--ink)',
  ink2: 'var(--ink2)',
  ink3: 'var(--ink3)',
  accent: 'var(--red)',
  line: 'var(--pap3)',
  chev: 'var(--ink3)',
  chipBd: 'var(--pap3)',
  chipFg: 'var(--ink)',
};

// 썸네일 없는 카드용 폴백 그라데이션
const FALLBACK_GRADS = [
  'linear-gradient(150deg,#ff6a3d,#c81d25)',
  'linear-gradient(150deg,#f9d423,#ff8a3c)',
  'linear-gradient(150deg,#c9a6f0,#8e6bd6)',
  'linear-gradient(150deg,#6fb1e0,#3a6ea5)',
  'linear-gradient(150deg,#f7d774,#e0a500)',
  'linear-gradient(150deg,#e07a9a,#a83a6e)',
];

/** 오늘(KST) 23:00 = 14:00 UTC epoch ms. */
function todayClose2300Kst(): number {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .split('-')
    .map(Number);
  return Date.UTC(y, m - 1, d, 14, 0, 0);
}
function fmtRemain(ms: number): string {
  if (ms <= 0) return '마감';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 1) return `${h}시간 ${m}분`;
  return `${m}분 ${String(s).padStart(2, '0')}초`;
}
function fmtRemainLong(ms: number): string {
  if (ms <= 0) return '마감';
  return `${fmtRemain(ms)} 남음`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '입찰 전';
  return `₩${n.toLocaleString('ko-KR')}`;
}

// 제목에서 지역/등급 칩 추출(있을 때만 표시). 셋코드는 신뢰도 낮아 생략.
function parseRegion(s: string): string | null {
  if (/일판|일본/.test(s)) return '일본판';
  if (/한판|한국|국내/.test(s)) return '한국판';
  return null;
}
function parseGrade(s: string): string | null {
  if (/psa\s*10|10등급|피?10등?/i.test(s)) return 'PSA 10';
  if (/psa\s*9|9등급/i.test(s)) return 'PSA 9';
  if (/raw|미감정|무감정|로우/i.test(s)) return 'RAW';
  return null;
}

const FILTERS = ['전체', 'PSA10', 'PSA9', 'RAW', '일본판', '한국판'] as const;
type FilterId = (typeof FILTERS)[number];
function matchFilter(f: FilterId, subject: string): boolean {
  if (f === '전체') return true;
  const g = parseGrade(subject);
  const r = parseRegion(subject);
  if (f === 'PSA10') return g === 'PSA 10';
  if (f === 'PSA9') return g === 'PSA 9';
  if (f === 'RAW') return g === 'RAW';
  if (f === '일본판') return r === '일본판';
  if (f === '한국판') return r === '한국판';
  return true;
}

function favToItem(f: ListingFavorite): MvcAuctionItem {
  return {
    articleId: Number(f.externalId),
    subject: f.title,
    writerNickname: '',
    commentCount: 0,
    readCount: 0,
    writtenAt: 0,
    writtenAgo: '',
    lastCommentedAt: 0,
    thumbnailUrl: f.imageUrl,
    costText: '',
  };
}
function synthBid(articleId: number, price: number | null): MvcLatestBid | undefined {
  if (price == null) return undefined;
  return { articleId, amount: price, content: '', writerNickname: '', writtenAt: 0, writtenClock: '', commentCount: 0 };
}
function favFromItem(item: MvcAuctionItem, bid: MvcLatestBid | null | undefined): ListingFavorite {
  return {
    source: 'mvc',
    externalId: String(item.articleId),
    title: stripDeadlinePrefix(item.subject) || item.subject,
    imageUrl: item.thumbnailUrl,
    price: bid?.amount ?? null,
    url: `/cards/mvc-auction/${item.articleId}`,
  };
}

/* ---------------- 아이콘 ---------------- */

const Ic = {
  search: (c: string, s = 23) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
  ),
  bell: (c: string, s = 23) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
  ),
  receipt: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>
  ),
  heart: (fill: string, stroke: string, s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" /></svg>
  ),
  clock: (c: string, s = 11) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  filter: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
  ),
  chevR: (c: string, s = 13) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
  ),
  plus: (c: string, s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
};

interface Props {
  initial: MvcAuctionPageResult;
}

export function MvcAuctionList({ initial }: Props) {
  const router = useRouter();
  const { theme } = useTheme();
  const { count: unread } = useUnread();
  const P = theme === 'clean' ? CLEAN_P : VAR_P;

  const [items, setItems] = useState<MvcAuctionItem[]>(initial.items);
  const [bids, setBids] = useState<BidMap>({});
  const [changedIds, setChangedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(initial.page);
  const [done, setDone] = useState(!initial.hasNext || initial.page >= MAX_PAGE);
  const [loading, setLoading] = useState(false);
  const [remain, setRemain] = useState<number | null>(null);

  const [tab, setTab] = useState<'live' | 'soon' | 'ended' | 'fav'>('live');
  const [filter, setFilter] = useState<FilterId>('전체');

  const { isFav, toggle, favorites } = useListingFavorites('mvc');

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const busy = useRef(false);
  const seen = useRef<Set<number>>(new Set(initial.items.map((i) => i.articleId)));
  const bidsRef = useRef<BidMap>({});

  const fetchBids = useCallback(async (ids: number[], fresh: boolean): Promise<BidMap> => {
    const collected: BidMap = {};
    for (let i = 0; i < ids.length; i += BID_CHUNK) {
      const chunk = ids.slice(i, i + BID_CHUNK);
      try {
        const res = await fetch(`/api/navercafe/latest-bids?ids=${chunk.join(',')}${fresh ? '&fresh=1' : ''}`);
        const data = (await res.json()) as { bids: BidMap };
        Object.assign(collected, data.bids ?? {});
        bidsRef.current = { ...bidsRef.current, ...(data.bids ?? {}) };
        setBids((prev) => ({ ...prev, ...(data.bids ?? {}) }));
      } catch {
        /* 무시 — 다음 갱신에서 재시도 */
      }
    }
    return collected;
  }, []);

  const loadBids = useCallback(
    (targets: MvcAuctionItem[], fresh: boolean): Promise<BidMap> => {
      const ids = targets
        .filter((it) => it.commentCount > 0)
        .map((it) => it.articleId)
        .filter((id) => fresh || !(id in bidsRef.current));
      return fetchBids(ids, fresh);
    },
    [fetchBids],
  );

  const loadMore = useCallback(async () => {
    if (busy.current || done) return;
    busy.current = true;
    setLoading(true);
    let nextPage = page;
    try {
      for (let i = 0; i < PAGES_PER_TRIGGER; i++) {
        nextPage += 1;
        const res = await fetch(`/api/navercafe/list?page=${nextPage}`);
        const data = (await res.json()) as MvcAuctionPageResult;
        const fresh = (data.items ?? []).filter((it) => {
          if (seen.current.has(it.articleId)) return false;
          seen.current.add(it.articleId);
          return true;
        });
        if (fresh.length > 0) {
          setItems((prev) => [...prev, ...fresh]);
          loadBids(fresh, false);
        }
        if (!data.hasNext || nextPage >= MAX_PAGE) {
          setDone(true);
          break;
        }
        if (fresh.length > 0) break;
      }
    } catch {
      /* 다음 트리거에서 재시도 */
    } finally {
      setPage(nextPage);
      setLoading(false);
      busy.current = false;
    }
  }, [page, done, loadBids]);

  // 초기 호가 로딩
  useEffect(() => {
    loadBids(initial.items, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 관심 항목은 라이브 리스트에 없을 수 있어 항상 별도로 최신 호가 직접 조회
  const favKey = favorites.map((f) => f.externalId).join(',');
  useEffect(() => {
    const ids = favorites.map((f) => Number(f.externalId)).filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length > 0) fetchBids(ids, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favKey, fetchBids]);

  // 마감까지 카운트다운(전 경매 23:00 종료)
  useEffect(() => {
    const tick = () => setRemain(todayClose2300Kst() - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // '갱신' 배지는 6초 후 사라짐
  useEffect(() => {
    if (changedIds.size === 0) return;
    const t = setTimeout(() => setChangedIds(new Set()), 6000);
    return () => clearTimeout(t);
  }, [changedIds]);

  // 무한스크롤 (진행중 탭에서만)
  useEffect(() => {
    if (done || tab !== 'live') return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, done, tab]);

  /* ---- 파생 목록 ---- */
  const favIdSet = useMemo(() => new Set(favorites.map((f) => f.externalId)), [favorites]);
  const rest = useMemo(() => items.filter((it) => !favIdSet.has(String(it.articleId))), [items, favIdSet]);
  // 마감 임박 = 입찰 활발한 상위 N (관심 제외)
  const featured = useMemo(
    () => [...rest].sort((a, b) => b.commentCount - a.commentCount).slice(0, FEATURE_COUNT),
    [rest],
  );
  const featuredIds = useMemo(() => new Set(featured.map((f) => f.articleId)), [featured]);
  const mainList = useMemo(
    () => rest.filter((it) => !featuredIds.has(it.articleId) && matchFilter(filter, it.subject)),
    [rest, featuredIds, filter],
  );
  const featuredFiltered = useMemo(
    () => featured.filter((it) => matchFilter(filter, it.subject)),
    [featured, filter],
  );

  // 마감 임박 카드 30초마다 호가 자동 갱신 + 변경 감지
  useEffect(() => {
    if (featured.length === 0) return;
    const run = async () => {
      const ids = featured.filter((it) => it.commentCount > 0).map((it) => it.articleId);
      if (ids.length === 0) return;
      const before = { ...bidsRef.current };
      const updated = await fetchBids(ids, true);
      const changed = new Set<number>();
      for (const idStr of Object.keys(updated)) {
        const id = Number(idStr);
        if ((before[id]?.content ?? null) !== (updated[id]?.content ?? null)) changed.add(id);
      }
      if (changed.size > 0) setChangedIds(changed);
    };
    const t = setInterval(run, AUTO_REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured.map((f) => f.articleId).join(','), fetchBids]);

  const bidFor = useCallback(
    (item: MvcAuctionItem): MvcLatestBid | null | undefined => {
      if (item.articleId in bids) return bids[item.articleId];
      const favMeta = favorites.find((f) => f.externalId === String(item.articleId));
      return favMeta ? synthBid(item.articleId, favMeta.price) : undefined;
    },
    [bids, favorites],
  );

  const pinnedItems = useMemo(() => {
    const liveById = new Map(items.map((it) => [String(it.articleId), it]));
    return favorites.map((f) => liveById.get(f.externalId) ?? favToItem(f));
  }, [favorites, items]);

  const remainText = remain == null ? '' : fmtRemain(remain);

  const onToggleFav = (item: MvcAuctionItem) => toggle(favFromItem(item, bids[item.articleId]));

  const cafeUrl = `https://cafe.naver.com/${MVC_CAFE_URL}`;

  return (
    <div className="pagebg" style={{ fontFamily: 'var(--f1)', background: P.pageBg, position: 'relative' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px 12px', background: P.cardBg }}>
        <div style={{ flex: 1, fontSize: 24, fontWeight: 900, color: P.ink, letterSpacing: '-.6px' }}>경매</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/cards/snkrdunk/search" aria-label="검색" style={{ display: 'block', color: P.ink }}>{Ic.search(P.ink)}</a>
          <a href="/my/messages" aria-label="알림" style={{ position: 'relative', display: 'block', color: P.ink }}>
            {Ic.bell(P.ink)}
            {unread > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 15, height: 15, padding: '0 3px', background: P.accent, borderRadius: 8, color: '#fff', fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${P.cardBg}` }}>{unread > 99 ? '99+' : unread}</span>
            )}
          </a>
          <button type="button" onClick={() => setTab('fav')} style={{ display: 'flex', alignItems: 'center', gap: 5, border: `1px solid ${P.chipBd}`, borderRadius: 10, padding: '7px 11px', background: 'transparent', cursor: 'pointer', color: P.ink }}>
            {Ic.receipt(P.ink)}
            <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap' }}>경매 내역</span>
          </button>
        </div>
      </div>

      {/* hero banner */}
      <div style={{ padding: '8px 20px 16px' }}>
        <a href={cafeUrl} target="_blank" rel="noreferrer noopener" style={{ textDecoration: 'none', position: 'relative', display: 'flex', alignItems: 'center', gap: 14, height: 88, borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(115deg,#2a2436,#16131e)', padding: '0 18px' }}>
          <div style={{ position: 'absolute', right: -6, top: -8, bottom: -8, width: 120, background: 'radial-gradient(circle at 70% 50%,rgba(255,200,90,.32),transparent 62%)' }} />
          <div style={{ fontSize: 46, filter: 'drop-shadow(0 4px 12px rgba(255,180,50,.45))', position: 'relative' }}>🏆</div>
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-.3px' }}>오늘 마감 카드 경매</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,.65)', marginTop: 3 }}>
              {remain != null && remain > 0 ? `23:00 마감 · ${remainText} 남음` : '카드의 가치를 경매로 경험하세요'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.14)', padding: '7px 12px', borderRadius: 20, position: 'relative', whiteSpace: 'nowrap' }}>안내 {Ic.chevR('#fff', 12)}</div>
        </a>
      </div>

      {/* status tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '0 20px 2px' }}>
        {([['live', '진행중', rest.length], ['soon', '예정', 0], ['ended', '종료', 0]] as Array<['live' | 'soon' | 'ended', string, number]>).map(([id, label, count]) => {
          const on = tab === id;
          return (
            <button key={id} type="button" onClick={() => setTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0 12px', borderBottom: `2.5px solid ${on ? P.accent : 'transparent'}`, background: 'none', border: 'none', borderBottomStyle: 'solid', cursor: 'pointer' }}>
              <span style={{ fontSize: 15.5, fontWeight: on ? 800 : 600, color: on ? P.ink : P.ink3 }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: on ? P.accent : '#C7C7CC', padding: '1px 7px', borderRadius: 9 }}>{count}</span>
            </button>
          );
        })}
        <div style={{ width: 1, height: 18, background: P.line }} />
        <button type="button" onClick={() => setTab('fav')} style={{ display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
          {Ic.heart(tab === 'fav' ? P.accent : 'none', tab === 'fav' ? P.accent : P.ink3, 16)}
          <span style={{ fontSize: 13.5, fontWeight: 700, color: tab === 'fav' ? P.accent : P.ink3, whiteSpace: 'nowrap' }}>관심 경매</span>
        </button>
      </div>
      <div style={{ height: 1, background: P.line, margin: '0 20px 14px' }} />

      {/* filter chips */}
      {tab === 'live' && (
        <div className="cv-hrow" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 20px 20px' }}>
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <button key={f} type="button" onClick={() => setFilter(f)} style={{ flex: 'none', whiteSpace: 'nowrap', fontSize: 13.5, fontWeight: 700, padding: '9px 17px', borderRadius: 11, cursor: 'pointer', background: on ? P.ink : P.cardBg, color: on ? (theme === 'clean' ? '#fff' : 'var(--paper)') : P.chipFg, border: `1px solid ${on ? P.ink : P.chipBd}` }}>{f}</button>
            );
          })}
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', fontSize: 13.5, fontWeight: 700, padding: '9px 15px', borderRadius: 11, background: P.cardBg, color: P.ink, border: `1px solid ${P.chipBd}` }}>{Ic.filter(P.ink)}필터</div>
        </div>
      )}

      {tab === 'live' ? (
        <LiveView
          P={P}
          theme={theme}
          featured={featuredFiltered}
          mainList={mainList}
          remainText={remainText}
          remainMs={remain}
          bidFor={bidFor}
          changedIds={changedIds}
          isFav={isFav}
          onToggleFav={onToggleFav}
          onOpen={(id) => router.push(`/cards/mvc-auction/${id}`)}
          loading={loading}
          done={done}
          totalCount={rest.length}
          sentinelRef={sentinelRef}
        />
      ) : tab === 'fav' ? (
        <NotableList
          title="관심 경매"
          P={P}
          list={pinnedItems}
          remainMs={remain}
          bidFor={bidFor}
          isFav={isFav}
          onToggleFav={onToggleFav}
          onOpen={(id) => router.push(`/cards/mvc-auction/${id}`)}
          emptyText="아직 관심 경매가 없어요. ♡ 를 눌러 추가해 보세요."
        />
      ) : (
        <div style={{ padding: '40px 24px 60px', textAlign: 'center', color: P.ink3, fontSize: 14, fontWeight: 600 }}>
          {tab === 'soon' ? '예정된 경매는 곧 공개됩니다.' : '종료된 경매가 아직 없어요.'}
        </div>
      )}

      {/* floating 출품 버튼 */}
      <a href={cafeUrl} target="_blank" rel="noreferrer noopener" style={{ position: 'fixed', right: 18, bottom: 96, zIndex: 35, display: 'flex', alignItems: 'center', gap: 8, background: P.accent, borderRadius: 26, padding: '13px 18px 13px 15px', boxShadow: '0 8px 22px rgba(245,51,63,.4)', textDecoration: 'none' }}>
        {Ic.plus('#fff')}
        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>경매 출품</span>
      </a>
    </div>
  );
}

/* ---------------- 진행중 뷰 ---------------- */

function LiveView({
  P, theme, featured, mainList, remainText, remainMs, bidFor, changedIds, isFav, onToggleFav, onOpen, loading, done, totalCount, sentinelRef,
}: {
  P: Palette;
  theme: string;
  featured: MvcAuctionItem[];
  mainList: MvcAuctionItem[];
  remainText: string;
  remainMs: number | null;
  bidFor: (it: MvcAuctionItem) => MvcLatestBid | null | undefined;
  changedIds: Set<number>;
  isFav: (id: string) => boolean;
  onToggleFav: (it: MvcAuctionItem) => void;
  onOpen: (id: number) => void;
  loading: boolean;
  done: boolean;
  totalCount: number;
  sentinelRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <>
      {/* 🔥 마감 임박 */}
      {featured.length > 0 && (
        <>
          <SectionHead title="🔥 마감 임박" P={P} />
          <div className="cv-hrow" style={{ display: 'flex', gap: 13, overflowX: 'auto', padding: '0 20px 24px' }}>
            {featured.map((it, i) => {
              const bid = bidFor(it);
              const fav = isFav(String(it.articleId));
              const region = parseRegion(it.subject);
              const grade = parseGrade(it.subject);
              return (
                <div key={it.articleId} onClick={() => onOpen(it.articleId)} role="link" style={{ flex: 'none', width: 172, background: P.cardBg, border: `1px solid ${P.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,.05)', cursor: 'pointer' }}>
                  <div style={{ position: 'relative', padding: 11 }}>
                    <div style={{ position: 'absolute', top: 11, left: 11, zIndex: 2, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,.72)', padding: '4px 9px', borderRadius: 8 }}>
                      {Ic.clock('#FF5247')}
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#FF5247' }}>{remainMs != null && remainMs > 0 ? remainText : '마감'}</span>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onToggleFav(it); }} aria-label="관심" style={{ position: 'absolute', top: 13, right: 13, zIndex: 2, background: 'none', border: 'none', cursor: 'pointer', padding: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.4))' }}>
                      {Ic.heart(fav ? P.accent : 'rgba(0,0,0,.25)', '#fff', 22)}
                    </button>
                    <CardImage item={it} idx={i} height={200} radius={10} fontSize={64} />
                  </div>
                  <div style={{ padding: '2px 14px 15px' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stripDeadlinePrefix(it.subject)}</div>
                    <ChipRow region={region} grade={grade} P={P} mt={9} />
                    <div style={{ fontSize: 12, color: P.ink3, fontWeight: 600, marginTop: 13 }}>현재가</div>
                    <div style={{ fontSize: 21, fontWeight: 900, color: P.ink, letterSpacing: '-.6px', marginTop: 2, whiteSpace: 'nowrap' }}>{fmtPrice(bid?.amount)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: P.ink3, fontWeight: 600, marginTop: 7 }}>
                      <span>입찰 {it.commentCount}회</span>
                      {changedIds.has(it.articleId) && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--grn,#16a34a)', padding: '1px 6px', borderRadius: 6 }}>갱신</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 🔨 주목할 만한 경매 */}
      <SectionHead title="🔨 주목할 만한 경매" P={P} />
      <NotableList
        P={P}
        list={mainList}
        remainMs={remainMs}
        bidFor={bidFor}
        isFav={isFav}
        onToggleFav={onToggleFav}
        onOpen={onOpen}
        emptyText={featured.length > 0 ? '해당 조건의 경매가 더 없어요.' : '오늘 마감인 경매가 없습니다.'}
        adRows
      />

      {!done && <div ref={sentinelRef} style={{ height: 1 }} />}
      <div style={{ padding: '8px 0 16px', textAlign: 'center', fontSize: 12, color: P.ink3, fontWeight: 600 }}>
        {loading ? '불러오는 중…' : done ? `오늘 마감 경매 ${totalCount}건` : ''}
      </div>
    </>
  );
}

/* ---------------- 주목할 만한(세로 리스트) ---------------- */

function NotableList({
  title, P, list, remainMs, bidFor, isFav, onToggleFav, onOpen, emptyText, adRows,
}: {
  title?: string;
  P: Palette;
  list: MvcAuctionItem[];
  remainMs: number | null;
  bidFor: (it: MvcAuctionItem) => MvcLatestBid | null | undefined;
  isFav: (id: string) => boolean;
  onToggleFav: (it: MvcAuctionItem) => void;
  onOpen: (id: number) => void;
  emptyText: string;
  adRows?: boolean;
}) {
  if (list.length === 0) {
    return (
      <>
        {title && <SectionHead title={title} P={P} />}
        <div style={{ padding: '36px 24px 50px', textAlign: 'center', color: P.ink3, fontSize: 14, fontWeight: 600 }}>{emptyText}</div>
      </>
    );
  }
  return (
    <>
      {title && <SectionHead title={title} P={P} />}
      <div style={{ padding: '0 20px 28px' }}>
        <div style={{ background: P.cardBg, border: `1px solid ${P.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,.04)' }}>
          {list.map((it, i) => {
            const bid = bidFor(it);
            const fav = isFav(String(it.articleId));
            const region = parseRegion(it.subject);
            const grade = parseGrade(it.subject);
            const node = (
              <div key={it.articleId} onClick={() => onOpen(it.articleId)} role="link" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 15px', borderTop: i === 0 ? 'none' : `1px solid ${P.line}`, cursor: 'pointer', position: 'relative' }}>
                <CardImage item={it} idx={i} width={50} height={68} radius={8} fontSize={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #F3C9CC', background: '#FFF0F0', padding: '3px 8px', borderRadius: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: P.accent }}>{remainMs != null && remainMs > 0 ? fmtRemainLong(remainMs) : '마감'}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: P.ink, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stripDeadlinePrefix(it.subject)}</div>
                  <ChipRow region={region} grade={grade} P={P} mt={7} sm />
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div style={{ fontSize: 11.5, color: P.ink3, fontWeight: 600 }}>현재가</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: P.ink, marginTop: 3, letterSpacing: '-.4px', whiteSpace: 'nowrap' }}>{fmtPrice(bid?.amount)}</div>
                  <div style={{ fontSize: 11.5, color: P.ink3, fontWeight: 600, marginTop: 4 }}>입찰 {it.commentCount}회</div>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); onToggleFav(it); }} aria-label="관심" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  {Ic.heart(fav ? P.accent : 'none', fav ? P.accent : P.chev, 17)}
                </button>
              </div>
            );
            if (adRows && (i + 1) % 6 === 0) {
              return [node, <div key={`ad-${i}`} style={{ borderTop: `1px solid ${P.line}` }}><ListAdRow slotIndex={Math.floor(i / 6)} /></div>];
            }
            return node;
          })}
        </div>
      </div>
    </>
  );
}

/* ---------------- 공용 ---------------- */

function SectionHead({ title, P }: { title: string; P: Palette }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 14px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: P.ink }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, fontWeight: 600, color: P.ink3 }}>더보기{Ic.chevR(P.ink3)}</div>
    </div>
  );
}

function ChipRow({ region, grade, P, mt, sm }: { region: string | null; grade: string | null; P: Palette; mt: number; sm?: boolean }) {
  const chips = [grade, region].filter(Boolean) as string[];
  if (chips.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 5, marginTop: mt, flexWrap: 'wrap' }}>
      {chips.map((c) => (
        <span key={c} style={{ fontSize: sm ? 10 : 10.5, fontWeight: 700, color: P.ink3, border: `1px solid ${P.chipBd}`, padding: sm ? '2px 6px' : '3px 7px', borderRadius: sm ? 5 : 6 }}>{c}</span>
      ))}
    </div>
  );
}

function CardImage({ item, idx, width, height, radius, fontSize }: { item: MvcAuctionItem; idx: number; width?: number; height: number; radius: number; fontSize: number }) {
  const [err, setErr] = useState(false);
  const has = Boolean(item.thumbnailUrl) && !err;
  const src = item.thumbnailUrl ? mvcImgProxy(upscaleCafeThumb(item.thumbnailUrl, height >= 160 ? 'w800' : 'w300')) : '';
  return (
    <div style={{ position: 'relative', width: width ?? '100%', height, flex: 'none', borderRadius: radius, overflow: 'hidden', background: has ? '#1c1c1e' : FALLBACK_GRADS[idx % FALLBACK_GRADS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: height >= 160 ? '0 6px 16px rgba(0,0,0,.16)' : '0 4px 10px rgba(0,0,0,.14)' }}>
      {has ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={item.subject} loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <span style={{ fontSize }}>🔨</span>
      )}
    </div>
  );
}
