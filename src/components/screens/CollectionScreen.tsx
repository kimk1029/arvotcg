'use client';

import Link from 'next/link';
import { COLLECTION_CACHE_KEY } from '@/lib/collectionCache';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CardThumb } from '@/components/CardThumb';
import { GradeMark } from '@/components/cards/GradeMark';
import { useCurrency } from '@/components/CurrencyProvider';
import { usePriceMode } from '@/components/PriceModeProvider';
import { Panel } from '@/components/ui/Panel';
import { parseCardStatics } from '../../../shared/cardStatics';
import { SegmentedTabs, SegIcons } from '@/components/ui/SegmentedTabs';
import { FavoritesPanel } from '@/components/screens/FavoritesPanel';
import { groupDuplicates, type CardGroup } from '../../../shared/collectionGroup';
import { evaluationUnitJpy } from '../../../shared/snkrdunkPrice';

interface HistPoint {
  date: string;
  totalJpy: number;
}

interface PortfolioData {
  totalJpy: number;
  totalPsa10Jpy: number;
  pricedCount: number;
  totalCount: number;
  changeAbsJpy: number | null;
  changePct: number | null;
  history: HistPoint[];
  asOfDate?: string;
}

interface CardRow {
  id: number;
  cardId: string | null;
  snkrdunkApparelId: number | null;
  nickname: string | null;
  photoUrl: string | null;
  snkrdunkName: string | null;
  snkrdunkImageUrl: string | null;
  priceSingleJpy: number;
  pricePsa10Jpy: number;
  /** 등급 기준 현재시세(JPY) — 서버가 등록가와 같은 규칙(PSA10/9/8→등급가, 타사→PSA10, 싱글→raw)으로 산정. */
  currentPriceJpy: number;
  /** currentPriceJpy 의 등급 기준('RAW'|'PSA 10'|…) — 시세상세를 같은 탭으로 열기 위해 전달. */
  priceBasis?: string | null;
  /** 등록 시점 시세(JPY) — "등록가격". 구매가 미입력 카드의 손익 기준. */
  registerPriceJpy: number | null;
  trend: number[];
  buyPrice: number | null;
  buyCurrency: string | null;
  qty: number;
  buyDate: string | null;
  createdAt: string;
  region: string | null;
  series: string | null;
  /** 카드 게임 종류 ('pokemon'|'onepiece'|'yugioh'|'other') — 테마순 정렬용. */
  game?: string | null;
  /** 'single' | 'box' — 박스(미개봉 상품) 여부. '박스 제외' 필터용. */
  itemKind?: 'single' | 'box' | null;
  selfPulled: boolean;
  graded: boolean;
  gradeCompany: string | null;
  gradeValue: string | null;
  ocrSetCode: string | null;
  ocrCardNumber: string | null;
}

/**
 * 컬렉션 카드 → 시세상세 링크. 목록이 보여준 가격의 등급 기준을 `?grade=` 로 넘겨
 * 상세 첫 화면이 같은 등급·같은 금액으로 열리게 한다(RAW 저장 카드는 RAW 탭 먼저,
 * PSA10 은 탭으로 전환). 기준이 없으면 상세가 스스로 최다거래 등급을 고른다.
 */
function cardDetailHref(c: Pick<CardRow, 'snkrdunkApparelId' | 'priceBasis'>): string | undefined {
  if (!c.snkrdunkApparelId) return undefined;
  const q = c.priceBasis ? `?grade=${encodeURIComponent(c.priceBasis)}` : '';
  return `/cards/snkrdunk/${c.snkrdunkApparelId}${q}`;
}

// KR 관례: 상승=빨강, 하락=파랑.
const UP = 'var(--red)';
const DOWN = 'var(--blu)';
type SortKey = 'value' | 'recent' | 'name' | 'change' | 'game';
type View = 'grid' | 'list';

function cardName(c: CardRow): string {
  return c.snkrdunkName || c.nickname || '이름 미상';
}
/** 테마순 정렬 순서 — 포켓몬 → 원피스 → 유희왕 → 기타/미분류. */
const GAME_SORT_ORDER: Record<string, number> = { pokemon: 0, onepiece: 1, yugioh: 2, sports: 3 };
function gameRank(c: CardRow): number {
  const g = c.game || parseCardStatics(cardName(c)).game;
  return GAME_SORT_ORDER[g] ?? 9;
}
function cardSub(c: CardRow): string {
  if (c.graded) return `${c.gradeCompany ?? 'PSA'} ${c.gradeValue ?? ''}`.trim();
  if (c.ocrSetCode) return [c.ocrSetCode.toUpperCase(), c.ocrCardNumber].filter(Boolean).join(' · ');
  return c.selfPulled ? '직접뽑기' : '싱글카드';
}

/* 세션 캐시 — 재진입 시 마지막 결과를 즉시 그리고(스피너 없이) 백그라운드 갱신(SWR).
 * sessionStorage 라 탭을 닫으면 사라지고, 로그아웃/계정 전환도 새 탭 세션이면 안 샌다. */
function loadCollectionCache(): { port: PortfolioData; cards: CardRow[] } | null {
  try {
    const raw = sessionStorage.getItem(COLLECTION_CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { t?: number; port?: PortfolioData; cards?: CardRow[] };
    if (!j?.port || !Array.isArray(j.cards)) return null;
    return { port: j.port, cards: j.cards };
  } catch {
    return null;
  }
}
function saveCollectionCache(port: PortfolioData, cards: CardRow[]): void {
  try {
    sessionStorage.setItem(COLLECTION_CACHE_KEY, JSON.stringify({ t: Date.now(), port, cards }));
  } catch {
    // 저장 실패(용량 등)는 무시 — 캐시는 가속용일 뿐.
  }
}

/** 서버 GET /api/me/cards/prices 응답 행 (정의 서버 queries.ts, 앱 MyCardPriceRow 페어). */
interface CardPriceRow {
  id: number;
  priceSingleJpy: number;
  pricePsa10Jpy: number;
  pricePsa9Jpy: number;
  pricePsa8Jpy: number;
  currentPriceJpy: number;
  trend: number[];
  /** 서버 최신 박스 판정 — 캐시의 옛 값을 덮어쓴다 (구서버 응답엔 없을 수 있음). */
  itemKind?: 'single' | 'box';
}

/**
 * 캐시된 카드 정적 데이터에 "오늘의 금액"만 merge — 앱 fetchMyCardsSmart 와 동일 규칙.
 * 카드 구성이 다르면(추가/삭제) null → 호출부가 풀 목록을 다시 받는다.
 * 가격 0(스냅샷 없음)은 캐시값 유지.
 */
function mergeCardPrices(cached: CardRow[], prices: CardPriceRow[]): CardRow[] | null {
  const byId = new Map(prices.map((p) => [p.id, p]));
  if (prices.length !== cached.length || cached.some((c) => !byId.has(c.id))) return null;
  return cached.map((c) => {
    const p = byId.get(c.id)!;
    return {
      ...c,
      priceSingleJpy: p.priceSingleJpy > 0 ? p.priceSingleJpy : c.priceSingleJpy,
      pricePsa10Jpy: p.pricePsa10Jpy > 0 ? p.pricePsa10Jpy : c.pricePsa10Jpy,
      currentPriceJpy: p.currentPriceJpy > 0 ? p.currentPriceJpy : c.currentPriceJpy,
      trend: p.trend.length > 0 ? p.trend : c.trend,
      // 박스 판정은 캐시가 아니라 서버 최신값 — '박스 제외' 필터가 옛 오판을 물고 있지 않게.
      itemKind: p.itemKind ?? c.itemKind,
    };
  });
}

type AssetTab = 'assets' | 'favorites';

export function CollectionScreen() {
  // 내 자산 ↔ 관심카드 탭 (커뮤니티의 커뮤니티↔Shop 과 같은 전환).
  const [tab, setTab] = useState<AssetTab>('assets');
  const router = useRouter();
  const { format, rate, mode, setMode } = useCurrency();
  const { mode: priceMode } = usePriceMode();
  // 세션 캐시 시드 — 재진입 시 마지막 결과를 즉시 그리고 백그라운드 갱신(SWR, 앱 peekMyCards 페어).
  const [port, setPort] = useState<PortfolioData | null>(() => loadCollectionCache()?.port ?? null);
  const [cards, setCards] = useState<CardRow[] | null>(() => loadCollectionCache()?.cards ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [sort, setSort] = useState<SortKey>('value');
  // 기본은 리스트형 — 한 화면에 더 많은 카드와 등록가/손익을 같이 본다.
  const [view, setView] = useState<View>('list');
  // 박스 제외 — 목록·손익 합계·비중 도넛에서 박스(미개봉 상품)를 뺀다 (앱 my/cards 동일).
  const [excludeBox, setExcludeBox] = useState(false);

  useEffect(() => {
    let alive = true;
    // 스니덩크 라이브 스크래핑이 느리면 응답이 안 와 스피너가 영원히 남는다. 20초 타임아웃.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    setErr(null);
    // 캐시 시드가 그려져 있으면 비우지 않고 그대로 둔 채 갱신 — 수동 재시도(reload)만 초기화.
    if (reload > 0) {
      setPort(null);
      setCards(null);
    }
    (async () => {
      try {
        // 캐시된 카드가 있으면 정적 데이터는 그대로 쓰고 "오늘의 금액"만 경량 /prices 로
        // 받아 merge (앱 fetchMyCardsSmart 페어). 캐시가 없거나 카드 구성이 바뀌었으면 풀 조회.
        const cachedCards = reload > 0 ? null : loadCollectionCache()?.cards ?? null;
        const cardsUrl =
          cachedCards && cachedCards.length > 0 ? '/api/me/cards/prices' : '/api/me/cards/with-prices';
        const [pr, cr] = await Promise.all([
          fetch('/api/me/portfolio', { credentials: 'include', cache: 'no-store', signal: ctrl.signal }),
          fetch(cardsUrl, { credentials: 'include', cache: 'no-store', signal: ctrl.signal }),
        ]);
        if (!alive) return;
        if (!pr.ok) {
          if (pr.status === 401) {
            // 로그아웃 상태 — 이전 계정 캐시가 남지 않게 비운다.
            try { sessionStorage.removeItem(COLLECTION_CACHE_KEY); } catch {}
            setPort(null);
            setCards(null);
          }
          setErr(pr.status === 401 ? '로그인이 필요해요' : '포트폴리오를 불러오지 못했어요');
          return;
        }
        const pj = (await pr.json().catch(() => null)) as { data?: PortfolioData } | null;
        if (!alive) return;
        if (!pj?.data) {
          setErr('포트폴리오를 불러오지 못했어요');
          return;
        }
        let nextCards: CardRow[];
        if (cachedCards && cachedCards.length > 0) {
          const dj = (await cr.json().catch(() => null)) as { data?: CardPriceRow[] } | null;
          const merged = cr.ok && dj?.data ? mergeCardPrices(cachedCards, dj.data) : null;
          if (merged) {
            nextCards = merged;
          } else {
            // 카드 추가/삭제됨(또는 델타 실패) — 풀 목록 재조회.
            const fr = await fetch('/api/me/cards/with-prices', { credentials: 'include', cache: 'no-store', signal: ctrl.signal });
            const fj = (await fr.json().catch(() => null)) as { data?: CardRow[] } | null;
            nextCards = fj?.data ?? cachedCards;
          }
        } else {
          const cj = (await cr.json().catch(() => null)) as { data?: CardRow[] } | null;
          nextCards = cj?.data ?? [];
        }
        if (!alive) return;
        setPort(pj.data);
        setCards(nextCards);
        saveCollectionCache(pj.data, nextCards);
      } catch {
        if (alive) setErr('시세 조회가 지연되고 있어요. 잠시 후 다시 시도해주세요');
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [reload]);

  const usePsa10 = priceMode === 'psa10';

  const allRows = useMemo(() => {
    if (!cards) return [];
    return cards.map((c) => {
      const qty = Math.max(1, c.qty || 1);
      const buyJpy =
        c.buyPrice != null && c.buyPrice > 0
          ? c.buyCurrency === 'JPY'
            ? c.buyPrice
            : c.buyPrice / (rate || 1)
          : null;
      // 손익 기준가 — 구매가 우선, 없으면 등록가(등록 시점 등급 기준 시세 스냅).
      const basisJpy =
        buyJpy ?? (c.registerPriceJpy != null && c.registerPriceJpy > 0 ? c.registerPriceJpy : null);
      // ★ 등급 일치 시세 — 서버 currentPriceJpy(PSA10/9/8→등급가, 타사→PSA10, 싱글→raw).
      //   등록가↔현재가를 항상 같은 등급끼리만 비교한다(전역 토글과 무관).
      const gradePriceJpy =
        c.currentPriceJpy > 0 ? c.currentPriceJpy : c.graded ? c.pricePsa10Jpy : c.priceSingleJpy;
      // 시세를 아직 못 받은 카드도 등록가로 평가액에 잡히게 — 폴백 정본 evaluationUnitJpy(서버 총 자산 동일).
      const curJpy = evaluationUnitJpy({ gradeJpy: gradePriceJpy, basisJpy });
      // 등록(매입)가 대비 손익률 — 같은 등급 시세 기준(단가). 실시세 없으면 표시 안 함.
      const profitPct = basisJpy && gradePriceJpy > 0 ? ((gradePriceJpy - basisJpy) / basisJpy) * 100 : null;
      // 어제(직전 체결일) 대비 등락 — 시세 추이 마지막 두 점.
      const t = c.trend ?? [];
      const dayPct =
        t.length >= 2 && t[t.length - 2] > 0 ? ((t[t.length - 1] - t[t.length - 2]) / t[t.length - 2]) * 100 : null;
      return { c, curJpy, gradePriceJpy, qty, basisJpy, profitPct, dayPct, changePct: profitPct ?? dayPct, value: curJpy * qty };
    });
  }, [cards, rate]);
  const boxCount = useMemo(() => allRows.filter((r) => r.c.itemKind === 'box').length, [allRows]);
  const visibleRows = useMemo(
    () => (excludeBox ? allRows.filter((r) => r.c.itemKind !== 'box') : allRows),
    [allRows, excludeBox],
  );

  const rows = useMemo(() => {
    const arr = [...visibleRows];
    if (sort === 'value') arr.sort((a, b) => b.value - a.value);
    else if (sort === 'change') arr.sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
    else if (sort === 'name') arr.sort((a, b) => cardName(a.c).localeCompare(cardName(b.c), 'ko'));
    else if (sort === 'recent') arr.sort((a, b) => (b.c.createdAt || '').localeCompare(a.c.createdAt || ''));
    // 테마순 — 게임(포켓몬→원피스→…)별로 묶고 그룹 안은 가격 내림차순.
    else if (sort === 'game') arr.sort((a, b) => gameRank(a.c) - gameRank(b.c) || b.value - a.value);
    return arr;
  }, [visibleRows, sort]);

  // 중복 등록(같은 카드·같은 등급)은 한 줄로 묶는다 — 정본 shared/collectionGroup (앱 동일).
  const groups = useMemo(() => groupDuplicates(rows), [rows]);

  const totals = useMemo(() => {
    let invested = 0;
    let current = 0;
    for (const r of visibleRows) {
      // 손익은 실시세가 있는 카드만 — 등록가 폴백 카드는 손익 0 으로 섞이지 않게.
      if (r.basisJpy && r.gradePriceJpy > 0) {
        invested += r.basisJpy * r.qty;
        current += r.gradePriceJpy * r.qty;
      }
    }
    const profit = current - invested;
    const pct = invested > 0 ? (profit / invested) * 100 : null;
    return { invested, current, profit, pct };
  }, [visibleRows]);

  const summary = useMemo(() => {
    const h = port?.history ?? [];
    const over = (days: number): { abs: number; pct: number } | null => {
      if (h.length < 2) return null;
      const last = h[h.length - 1].totalJpy;
      const base = h[Math.max(0, h.length - 1 - days)].totalJpy;
      if (!base) return null;
      return { abs: last - base, pct: ((last - base) / base) * 100 };
    };
    return { d7: over(7), d30: over(30) };
  }, [port]);

  // 컬렉션에서 카드 제거 — 낙관적으로 목록에서 빼고 DELETE. 실패 시 전체 재조회.
  const handleRemove = useCallback(async (id: number) => {
    if (typeof window !== 'undefined' && !window.confirm('이 카드를 컬렉션에서 제거할까요?')) return;
    setCards((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
    try {
      const res = await fetch(`/api/me/cards/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      // 총 자산(히어로)도 갱신되도록 포트폴리오 재조회.
      setReload((n) => n + 1);
    } catch {
      setReload((n) => n + 1);
    }
  }, []);

  if (tab === 'favorites')
    return (
      <>
        <CollectionHeader tab={tab} setTab={setTab} />
        <FavoritesPanel />
      </>
    );
  if (err)
    return (
      <>
        <CollectionHeader tab={tab} setTab={setTab} />
        <Msg>
          ⚠ {err}
          <br />
          <button type="button" onClick={() => setReload((n) => n + 1)} style={retryBtn}>
            다시 시도
          </button>
        </Msg>
      </>
    );
  if (!port || !cards)
    return (
      <>
        <CollectionHeader tab={tab} setTab={setTab} />
        <Msg>불러오는 중…</Msg>
      </>
    );
  if (port.totalCount === 0)
    return (
      <>
        <CollectionHeader tab={tab} setTab={setTab} />
        <Msg>
          아직 보유 카드가 없어요.
          <br />
          <Link href="/cards/add" style={{ color: 'var(--blu)', textDecoration: 'underline' }}>
            카드 추가하러 가기 →
          </Link>
        </Msg>
      </>
    );

  const totalJpy = usePsa10 && port.totalPsa10Jpy > 0 ? port.totalPsa10Jpy : port.totalJpy;
  // 누적 수익률 — 보유 카드 전체의 (현재가-기준가)×수량 합산 / 구매금액 합산.
  // 카드별 손익(-100만/+50만)을 상쇄한 평균 수익률 (앱 PortfolioHero 동일).
  const up = totals.profit >= 0;

  return (
    <div style={{ paddingBottom: 40 }}>
      <CollectionHeader tab={tab} setTab={setTab} />

      {/* ── 총 자산 가치 카드 (다크 히어로) — 클릭 시 포트폴리오 상세(전체화면). 앱 PortfolioHero 와 패리티 ── */}
      <div style={{ padding: '4px var(--gap) 16px' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push('/my/portfolio')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/my/portfolio'); }}
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--r-xl,16px)',
            padding: 20,
            background: 'linear-gradient(160deg,#22222a,#0e0e12)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
            <span style={{ fontFamily: 'var(--f1)', fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,.65)' }}>
              총 자산 가치{usePsa10 ? ' · PSA10' : ''} <span style={{ color: 'rgba(255,255,255,.4)' }}>›</span>
            </span>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,.1)', borderRadius: 9, padding: 3 }}>
              {(['krw', 'jpy'] as const).map((m) => {
                const on = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMode(m); }}
                    style={{
                      fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 7,
                      border: 'none', cursor: 'pointer',
                      background: on ? '#fff' : 'transparent', color: on ? '#16161a' : 'rgba(255,255,255,.6)',
                    }}
                  >
                    {m === 'krw' ? '원화' : '엔화'}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ fontFamily: 'var(--f1)', fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginTop: 12 }}>
              {format(totalJpy)}
            </div>
            {totals.pct != null && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', marginRight: 7 }}>
                  누적 수익률
                </span>
                <span style={{ fontFamily: 'var(--f1)', fontSize: 13.5, fontWeight: 800, color: up ? '#FF6B5E' : '#6FA8FF' }}>
                  {up ? '+' : '-'}{format(Math.abs(totals.profit))} ({up ? '+' : ''}{totals.pct.toFixed(2)}%) {up ? '▲' : '▼'}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.12)', position: 'relative', zIndex: 2 }}>
            <HeroStat label="보유 카드" value={`${port.totalCount}장`} />
            <HeroStat label="구매 금액" value={totals.invested > 0 ? format(totals.invested) : '—'} flex={1.3} />
            <HeroStat
              label="평가 손익"
              value={totals.pct != null ? `${totals.profit >= 0 ? '+' : '-'}${format(Math.abs(totals.profit))}` : '—'}
              color={totals.pct == null ? '#fff' : totals.profit >= 0 ? '#FF6B5E' : '#6FA8FF'}
              flex={1.2}
            />
          </div>

          {/* 자산 요약(7일·30일 변화) — 총 자산 가치 블록 안에 같이 표시. 앱 PortfolioHero 동일. */}
          <div style={{ display: 'flex', marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.12)', position: 'relative', zIndex: 2 }}>
            <HeroDelta label="7일 변화" delta={summary.d7} format={format} />
            <HeroDelta label="30일 변화" delta={summary.d30} format={format} />
          </div>
        </div>
      </div>

      {/* ── 내 카드 목록 ── */}
      <div style={{ padding: '0 var(--gap)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>
            내 카드 목록 <span style={{ color: 'var(--ink3)' }}>({rows.length})</span>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--pap2)', borderRadius: 'var(--r-sm)', padding: 3 }}>
            {(['grid', 'list'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-label={v === 'grid' ? '그리드 보기' : '리스트 보기'}
                style={{
                  width: 30, height: 26, borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                  display: 'grid', placeItems: 'center', background: view === v ? 'var(--white)' : 'transparent',
                }}
              >
                {v === 'grid' ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={view === v ? 'var(--ink)' : 'var(--ink3)'} strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={view === v ? 'var(--ink)' : 'var(--ink3)'} strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 정렬 — 미니멀 세그먼트 (작게) + 박스 제외 체크박스 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: 2, background: 'var(--pap2)', borderRadius: 'var(--r-sm)', padding: 2 }}>
          {([
            { k: 'value', label: '가격순' },
            { k: 'change', label: '등락순' },
            { k: 'recent', label: '등록일' },
            { k: 'name', label: '이름순' },
            { k: 'game', label: '테마순' },
          ] as Array<{ k: SortKey; label: string }>).map((s) => {
            const on = sort === s.k;
            return (
              <button
                key={s.k}
                type="button"
                onClick={() => setSort(s.k)}
                style={{
                  flex: 'none', whiteSpace: 'nowrap', fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 700,
                  padding: '5px 10px', borderRadius: 'calc(var(--r-sm) - 2px)', cursor: 'pointer', border: 'none',
                  background: on ? 'var(--white)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink3)',
                  boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {boxCount > 0 && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 700, color: excludeBox ? 'var(--ink)' : 'var(--ink3)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={excludeBox} onChange={(e) => setExcludeBox(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--ink)', margin: 0 }} />
            박스 제외 ({boxCount})
          </label>
        )}
        </div>

        {groups.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--ink3)' }}>
            해당 조건의 카드가 없어요
          </div>
        ) : view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, paddingBottom: 24 }}>
            {groups.map((g, i) => (
              <CardGridItem key={g.key} group={g} rank={i + 1} format={format} onRemove={handleRemove} />
            ))}
          </div>
        ) : (
          <div style={{ paddingBottom: 24 }}>
            {groups.map((g, i, arr) => (
              <CardListItem key={g.key} group={g} format={format} last={i === arr.length - 1} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </div>

      <div style={{ fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)', textAlign: 'center', letterSpacing: 0.3, lineHeight: 1.6, padding: '0 var(--gap)' }}>
        스니덩크 최근 체결 중앙값 기준 · 관심카드 제외 · 등락은 등록가 대비 누적
      </div>
    </div>
  );
}

type Row = {
  c: CardRow;
  /** 표시용 현재가 — 실시세, 없으면 등록가 폴백. */
  curJpy: number;
  /** 실시세(등급 일치). 0 이면 시세 미확보 — 손익 계산에서 제외. */
  gradePriceJpy: number;
  qty: number;
  basisJpy: number | null;
  /** 등록(매입)가 대비 손익률. */
  profitPct: number | null;
  /** 어제 대비 시세 등락률. */
  dayPct: number | null;
  changePct: number | null;
  value: number;
};

function rankBadgeColor(rank: number): string {
  if (rank === 1) return 'var(--gold)';
  if (rank === 2) return '#9AA0A6';
  if (rank === 3) return '#C8732B';
  return 'var(--ink)';
}

const FALLBACK_GRADS = [
  'linear-gradient(150deg,#ff6a3d,#c81d25)',
  'linear-gradient(150deg,#f9d423,#ff8a3c)',
  'linear-gradient(150deg,#f7a6c4,#b78cf0)',
  'linear-gradient(150deg,#9d6bd6,#4568dc)',
  'linear-gradient(150deg,#3a3a44,#16161a)',
  'linear-gradient(150deg,#11998e,#38ef7d)',
];

/** 손익률 부호색 — 이득(≥0) 빨강 / 손해(<0) 파랑 / 기준 없음(null) 기본 잉크. */
function profitColor(pct: number | null): string {
  if (pct == null) return 'var(--ink)';
  return pct >= 0 ? UP : DOWN;
}

/** 현재가 옆 손익률 태그 — 라벨 없이 부호색 ▲/▼ X%. 매입가 없으면 렌더 안 함. */
function ProfitTag({ pct, size = 12 }: { pct: number | null; size?: number }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span style={{ fontFamily: 'var(--f1)', fontSize: size, fontWeight: 800, color: up ? UP : DOWN, whiteSpace: 'nowrap' }}>
      {up ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/**
 * 그레이딩 카드 표식 — 부모(position:relative) 우하단에 작게 플로팅.
 * 구현 정본은 공통 GradeMark(src/components/cards/GradeMark) — 여기는 골드 폴백만 고정한 얇은 래퍼.
 */
function GradedLabel({ company, grade, height }: { company?: string | null; grade?: string | null; height?: number }) {
  return <GradeMark company={company} grade={grade} height={height} gold="var(--gold)" />;
}

/** 카드 더보기(⋯) 메뉴 — 시세 보기 / 컬렉션에서 제거. Link/Panel 바깥에 형제로 배치. */
function CardMenu({ apparelId, basis, onRemove, plain = false }: { apparelId: number | null; basis?: string | null; onRemove: () => void; plain?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  // plain: 리스트형 — 배경 컨테이너 없는 점 3개(영역 최소). 기본: 그리드 이미지 위 어두운 원형 오버레이.
  const btnStyle: React.CSSProperties = plain
    ? {
        width: 20, height: 26, border: 'none', cursor: 'pointer', background: 'transparent',
        color: 'var(--ink3)', fontSize: 17, fontWeight: 900, lineHeight: 1, padding: 0,
        display: 'grid', placeItems: 'center',
      }
    : {
        width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: 15, fontWeight: 900, lineHeight: 1,
        display: 'grid', placeItems: 'center', backdropFilter: 'blur(2px)',
      };
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="카드 메뉴"
        onClick={(e) => {
          stop(e);
          setOpen((o) => !o);
        }}
        style={btnStyle}
      >
        ⋯
      </button>
      {open && (
        <div
          onClick={stop}
          style={{
            position: 'absolute', top: 30, right: 0, zIndex: 20, minWidth: 138,
            background: 'var(--white)', borderRadius: 'var(--r-sm)', overflow: 'hidden',
            boxShadow: '0 6px 20px rgba(0,0,0,.18)', border: '1px solid var(--pap3)',
          }}
        >
          {apparelId && (
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                setOpen(false);
                router.push(cardDetailHref({ snkrdunkApparelId: apparelId, priceBasis: basis }) ?? `/cards/snkrdunk/${apparelId}`);
              }}
              style={menuItemStyle}
            >
              📈 시세 보기
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setOpen(false);
              onRemove();
            }}
            style={{ ...menuItemStyle, color: 'var(--red)', borderTop: apparelId ? '1px solid var(--pap3)' : 'none' }}
          >
            🗑 컬렉션에서 제거
          </button>
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px',
  fontFamily: 'var(--f1)', fontSize: 13, fontWeight: 700, color: 'var(--ink)',
  background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
};

function CardGridItem({ group, rank, format, onRemove }: { group: CardGroup<Row>; rank: number; format: (j: number) => string; onRemove: (id: number) => void }) {
  const { c, curJpy, basisJpy } = group.head;
  // 중복 등록은 한 타일로 — 장수는 그룹 합, 손익률도 그룹 합산 기준.
  const qty = group.qty;
  const profitPct = group.profitPct;
  const img = c.snkrdunkImageUrl || c.photoUrl || null;
  const href = cardDetailHref(c);
  const body = (
    <>
      <CardThumb
        style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: img ? 'var(--pap2)' : FALLBACK_GRADS[rank % FALLBACK_GRADS.length], display: 'grid', placeItems: 'center', overflow: 'hidden' }}
        src={img}
        alt={cardName(c)}
        emojiSize={42}
        emojiStyle={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.3))' }}
      >
        <div style={{ position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: '50%', background: rankBadgeColor(rank), color: '#fff', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,.25)' }}>
          {rank}
        </div>
        {c.graded && <GradedLabel company={c.gradeCompany} grade={c.gradeValue} />}
      </CardThumb>
      <div style={{ padding: '7px 9px 9px' }}>
        <div style={{ fontFamily: 'var(--f1)', fontSize: 12, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cardName(c)}
        </div>
        <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)', fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cardSub(c)}{qty > 1 ? ` · ×${qty}` : ''}
        </div>
        {/* 현재가(손익 색상) + 등록가 대비 손익률 */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4, marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--f1)', fontSize: 13.5, fontWeight: 900, color: profitColor(profitPct) }}>{curJpy > 0 ? format(curJpy) : '—'}</span>
          <ProfitTag pct={profitPct} size={11} />
        </div>
        {/* 등록(매입)가 */}
        <div style={{ marginTop: 2 }}>
          <span style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            등록 {basisJpy ? format(basisJpy) : '—'}{group.items.length > 1 ? ` 외 ${group.items.length - 1}건` : ''}
          </span>
        </div>
      </div>
    </>
  );
  const boxStyle = { display: 'block', overflow: 'hidden', textDecoration: 'none', color: 'inherit', minWidth: 0 } as const;
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      {href ? (
        <Panel href={href} style={boxStyle}>{body}</Panel>
      ) : (
        <Panel style={boxStyle}>{body}</Panel>
      )}
      {/* ⋯ 메뉴 — Link/Panel 바깥 형제(이미지 우상단 오버레이). */}
      <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 6 }}>
        <CardMenu apparelId={c.snkrdunkApparelId} basis={c.priceBasis} onRemove={() => onRemove(c.id)} />
      </div>
    </div>
  );
}

function CardListItem({ group, format, last, onRemove }: { group: CardGroup<Row>; format: (j: number) => string; last: boolean; onRemove: (id: number) => void }) {
  const { c, curJpy } = group.head;
  const dup = group.items.length > 1;
  const [open, setOpen] = useState(false);
  const img = c.snkrdunkImageUrl || c.photoUrl || null;
  const href = cardDetailHref(c) ?? '#';
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--pap3)' }}>
      <div style={{ position: 'relative' }}>
        <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px 11px 2px', textDecoration: 'none', color: 'inherit' }}>
          {/* 썸네일 + 그레이딩 표식 — 표식은 이미지 좌측 블록 안(하단에 살짝 겹침)에 둔다.
              행 전체를 기준으로 잡으면 우측 ⋯ 메뉴와 겹친다. */}
          <div style={{ position: 'relative', flex: 'none' }}>
            <CardThumb
              style={{ width: 62, height: 62, borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--pap2)', display: 'grid', placeItems: 'center' }}
              src={img}
              alt={cardName(c)}
              emojiSize={28}
            />
            {c.graded && <GradedLabel company={c.gradeCompany} grade={c.gradeValue} height={9} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ fontFamily: 'var(--f1)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cardName(c)}</span>
              {/* 중복 등록 장수 배지 */}
              {group.qty > 1 && (
                <span style={{ flex: 'none', fontFamily: 'var(--f1)', fontSize: 10.5, fontWeight: 800, color: 'var(--ink)', background: 'var(--pap2)', borderRadius: 999, padding: '1px 7px' }}>
                  ×{group.qty}
                </span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{cardSub(c)}</div>
            {/* 등록(매입)가 — 중복이면 각 장을 펼쳐 본다. */}
            <div style={{ marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--f1)', fontSize: 10.5, color: 'var(--ink3)', fontWeight: 600 }}>
                등록 {group.head.basisJpy ? format(group.head.basisJpy) : '—'}{dup ? ` 외 ${group.items.length - 1}건` : ''}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            {/* 현재가(손익 색상) + 등록가 대비 손익률(그룹 합산) */}
            <div style={{ fontFamily: 'var(--f1)', fontSize: 14, fontWeight: 900, color: profitColor(group.profitPct) }}>{curJpy > 0 ? format(curJpy) : '—'}</div>
            <div style={{ marginTop: 3 }}>
              <ProfitTag pct={group.profitPct} size={12} />
            </div>
          </div>
        </Link>
        {/* ⋯ 메뉴 — Link 바깥 형제(우측 세로 중앙). 중복이면 펼치기 버튼으로 대체. */}
        <div style={{ position: 'absolute', top: '50%', right: -2, transform: 'translateY(-50%)', zIndex: 6 }}>
          {dup ? (
            <button
              type="button"
              aria-label={open ? '중복 카드 접기' : '중복 카드 펼치기'}
              onClick={() => setOpen((o) => !o)}
              style={{ width: 22, height: 26, border: 'none', background: 'transparent', color: 'var(--ink3)', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              {open ? '▲' : '▼'}
            </button>
          ) : (
            <CardMenu apparelId={c.snkrdunkApparelId} basis={c.priceBasis} onRemove={() => onRemove(c.id)} plain />
          )}
        </div>
      </div>

      {/* 중복 등록분 — 장마다 등록가·손익이 다르므로 각각 보여준다. */}
      {dup && open && (
        <div style={{ padding: '2px 0 10px 60px' }}>
          {group.items.map((r, i) => (
            <div key={r.c.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 20px 7px 0' }}>
              <span style={{ fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>
                {i + 1}번째{r.qty > 1 ? ` · ×${r.qty}` : ''} · 등록 {r.basisJpy ? format(r.basisJpy) : '—'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                <span style={{ fontFamily: 'var(--f1)', fontSize: 12.5, fontWeight: 800, color: profitColor(r.profitPct) }}>{r.curJpy > 0 ? format(r.curJpy) : '—'}</span>
                <ProfitTag pct={r.profitPct} size={11} />
              </span>
              <div style={{ position: 'absolute', top: '50%', right: -2, transform: 'translateY(-50%)' }}>
                <CardMenu apparelId={r.c.snkrdunkApparelId} basis={r.c.priceBasis} onRemove={() => onRemove(r.c.id)} plain />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 상단 헤더 — 내 자산 ↔ 관심카드 타이틀 스왑 탭 + 검색 아이콘. */
function CollectionHeader({ tab, setTab }: { tab?: AssetTab; setTab?: (t: AssetTab) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px var(--gap) 10px' }}>
      {tab && setTab ? (
        <SegmentedTabs
          items={[
            { id: 'assets', label: '내 자산', icon: SegIcons.wallet },
            { id: 'favorites', label: '관심카드', icon: SegIcons.star },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : (
        <div style={{ fontFamily: 'var(--f1)', fontSize: 23, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
          내 자산
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/cards/snkrdunk/search" aria-label="검색" style={{ display: 'block', color: 'var(--ink)' }}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </Link>
      </div>
    </div>
  );
}

function HeroStat({ label, value, color = '#fff', flex = 1 }: { label: string; value: string; color?: string; flex?: number }) {
  return (
    <div style={{ flex }}>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 11.5, color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 15, fontWeight: 800, color, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}


/** 히어로 안 7일/30일 변화 셀 — 금액 + (등락률). 색은 KR 관례(상승 빨강). */
function HeroDelta({ label, delta, format }: { label: string; delta: { abs: number; pct: number } | null; format: (j: number) => string }) {
  const up = (delta?.pct ?? 0) >= 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 11.5, color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 15, fontWeight: 800, color: delta == null ? 'rgba(255,255,255,.55)' : up ? '#FF6B5E' : '#6FA8FF', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {delta == null ? '—' : `${delta.abs >= 0 ? '+' : '-'}${format(Math.abs(delta.abs))}`}
        {delta != null && (
          <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 5 }}>({up ? '+' : ''}{delta.pct.toFixed(2)}%)</span>
        )}
      </div>
    </div>
  );
}

/** 다크 히어로용 스파크라인(우하단 배경). */
function Msg({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 13, color: 'var(--ink3)', lineHeight: 1.8 }}>
      {children}
    </div>
  );
}

const retryBtn: React.CSSProperties = {
  marginTop: 12,
  padding: '8px 18px',
  background: 'transparent',
  color: 'var(--blu)',
  border: '1px solid var(--blu)',
  borderRadius: 'var(--r-sm)',
  cursor: 'pointer',
  font: 'inherit',
};
