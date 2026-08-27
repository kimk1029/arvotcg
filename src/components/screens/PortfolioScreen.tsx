'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrency } from '@/components/CurrencyProvider';
import { usePriceMode } from '@/components/PriceModeProvider';
import { PortfolioInfographics } from '@/components/portfolio/PortfolioInfographics';
import { MarketIndexPanel } from '@/components/portfolio/MarketIndexPanel';
import {
  AcquisitionBars,
  CompareChart,
  GradingUpsideCard,
  Histograms,
  InsightTiles,
  Section as VizSection,
  upsideFromCards,
} from '@/components/portfolio/PortfolioExtras';
import type { VizAcquisition } from '../../../shared/portfolioViz';
import { loadEnabledGames } from '@/lib/gamePrefs';
import type { MarketIndexResponse, MarketIndexSeries } from '../../../shared/marketIndex';
import type { VizCard } from '../../../shared/portfolioViz';

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
  nickname: string | null;
  photoUrl: string | null;
  snkrdunkName: string | null;
  snkrdunkImageUrl: string | null;
  priceSingleJpy: number;
  pricePsa10Jpy: number;
  trend: number[];
  buyPrice: number | null;
  buyCurrency: string | null;
  qty: number;
  buyDate: string | null;
  /** 등록일 — 매입일이 없을 때 취득 타임라인의 월 기준. */
  createdAt?: string;
  selfPulled: boolean;
  graded: boolean;
  gradeCompany: string | null;
  gradeValue: string | null;
  ocrSetCode: string | null;
  ocrCardNumber: string | null;
  /** 등급 기준('RAW'|'PSA 10'…) — 인포그래픽 등급 구성용. */
  priceBasis?: string | null;
  /** 작품(pokemon|onepiece|…) · 시리즈(팩 한글명) — 분류별 구성용. */
  game?: string | null;
  series?: string | null;
}

const UP = '#22C55E';
const DOWN = '#FF5B6E';
const GOLD = '#FFD23F';

type Filter = 'all' | 'up' | 'down' | 'graded' | 'pull';
type Range = 7 | 30 | 90 | 0; // 0 = 전체

export function PortfolioScreen() {
  const { format, rate } = useCurrency();
  const { mode: priceMode } = usePriceMode();
  const [port, setPort] = useState<PortfolioData | null>(null);
  const [cards, setCards] = useState<CardRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [sort, setSort] = useState<'value' | 'change'>('value');
  const [filter, setFilter] = useState<Filter>('all');
  const [range, setRange] = useState<Range>(30);
  // 시장 지표 — 포트폴리오 본체와 독립 조회(실패/지연이 자산 표시를 막지 않게). 설정에서 켠 게임만.
  const [marketSeries, setMarketSeries] = useState<MarketIndexSeries[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 보조 정보 — 한 번 실패해도 2초 뒤 1회 재시도(앱 fetchMarketIndexes 동일).
        let r = await fetch('/api/market-index', { cache: 'no-store' }).catch(() => null);
        if (!r || !r.ok) {
          await new Promise((res) => setTimeout(res, 2000));
          r = await fetch('/api/market-index', { cache: 'no-store' }).catch(() => null);
        }
        if (!alive || !r || !r.ok) return;
        const j = (await r.json().catch(() => null)) as { data?: MarketIndexResponse } | null;
        if (!alive || !j?.data) return;
        const enabled = new Set<string>(loadEnabledGames());
        setMarketSeries(j.data.series.filter((x) => enabled.has(x.key)));
      } catch {
        // 지표는 보조 정보 — 조용히 숨긴다.
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    // 스니덩크 라이브 스크래핑이 느리거나 멈추면 응답이 안 와 스피너가 영원히 남는다.
    // 20초 타임아웃 + 에러 응답(비-2xx) 처리로 무한 로딩을 방지한다.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    setErr(null);
    setPort(null);
    setCards(null);
    (async () => {
      try {
        const [pr, cr] = await Promise.all([
          fetch('/api/me/portfolio', { credentials: 'include', cache: 'no-store', signal: ctrl.signal }),
          fetch('/api/me/cards/with-prices', { credentials: 'include', cache: 'no-store', signal: ctrl.signal }),
        ]);
        if (!alive) return;
        if (!pr.ok) {
          setErr(pr.status === 401 ? '로그인이 필요해요' : '포트폴리오를 불러오지 못했어요');
          return;
        }
        // 에러 응답도 JSON 파싱은 성공하므로(throw 안 됨), data 유무로 판정해야 한다.
        const pj = (await pr.json().catch(() => null)) as { data?: PortfolioData } | null;
        const cj = (await cr.json().catch(() => null)) as { data?: CardRow[] } | null;
        if (!alive) return;
        if (!pj?.data) {
          setErr('포트폴리오를 불러오지 못했어요');
          return;
        }
        setPort(pj.data);
        setCards(cj?.data ?? []);
      } catch {
        // AbortController(타임아웃/언마운트) 포함 — 살아있을 때만 에러 표시.
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
    const mapped = cards.map((c) => {
      const curJpy = usePsa10 && c.pricePsa10Jpy > 0 ? c.pricePsa10Jpy : c.priceSingleJpy;
      const qty = Math.max(1, c.qty || 1);
      const basisJpy =
        c.buyPrice != null && c.buyPrice > 0
          ? c.buyCurrency === 'JPY'
            ? c.buyPrice
            : c.buyPrice / (rate || 1)
          : null;
      const profitPct = basisJpy && curJpy > 0 ? ((curJpy - basisJpy) / basisJpy) * 100 : null;
      const t = c.trend ?? [];
      const dayPct =
        t.length >= 2 && t[t.length - 2] > 0 ? ((t[t.length - 1] - t[t.length - 2]) / t[t.length - 2]) * 100 : null;
      return { c, curJpy, qty, basisJpy, profitPct, dayPct, changePct: profitPct ?? dayPct, value: curJpy * qty };
    });
    return mapped;
  }, [cards, usePsa10, rate]);

  const rows = useMemo(() => {
    let r = allRows;
    if (filter === 'up') r = r.filter((x) => (x.changePct ?? 0) > 0);
    else if (filter === 'down') r = r.filter((x) => (x.changePct ?? 0) < 0);
    else if (filter === 'graded') r = r.filter((x) => x.c.graded);
    else if (filter === 'pull') r = r.filter((x) => x.c.selfPulled);
    return [...r].sort((a, b) =>
      sort === 'value' ? b.value - a.value : (b.changePct ?? -999) - (a.changePct ?? -999),
    );
  }, [allRows, filter, sort]);

  const totals = useMemo(() => {
    let invested = 0;
    let current = 0;
    for (const r of allRows) {
      if (r.basisJpy && r.curJpy > 0) {
        invested += r.basisJpy * r.qty;
        current += r.curJpy * r.qty;
      }
    }
    const profit = current - invested;
    const pct = invested > 0 ? (profit / invested) * 100 : null;
    return { invested, current, profit, pct };
  }, [allRows]);

  // 인포그래픽 입력 — 집계는 전부 정본 shared/portfolioViz.ts 가 한다.
  const vizCards = useMemo<VizCard[]>(
    () =>
      allRows
        .filter((r) => r.curJpy > 0)
        .map((r) => ({
          id: r.c.id,
          name: r.c.snkrdunkName || r.c.nickname || '이름 미상',
          valueJpy: r.value,
          basisJpy: r.basisJpy != null ? r.basisJpy * r.qty : null,
          changePct: r.changePct,
          graded: r.c.graded,
          gradeLabel: r.c.priceBasis || (r.c.graded ? `${r.c.gradeCompany ?? 'PSA'} ${r.c.gradeValue ?? ''}`.trim() : 'RAW'),
          game: r.c.game ?? null,
          series: r.c.series ?? null,
          selfPulled: r.c.selfPulled,
        })),
    [allRows],
  );

  // 월별 취득(매입일 없으면 등록일) · PSA10 환산 업사이드 — 집계는 정본 shared/portfolioViz.
  const acquisitions = useMemo<VizAcquisition[]>(
    () =>
      allRows.map((r) => ({
        month: (r.c.buyDate || r.c.createdAt || '').slice(0, 7),
        basisJpy: r.basisJpy != null ? r.basisJpy * r.qty : 0,
        qty: r.qty,
      })).filter((a) => /^\d{4}-\d{2}$/.test(a.month)),
    [allRows],
  );
  const upside = useMemo(
    () => upsideFromCards((cards ?? []).map((c) => ({ graded: c.graded, qty: Math.max(1, c.qty || 1), priceSingleJpy: c.priceSingleJpy, pricePsa10Jpy: c.pricePsa10Jpy }))),
    [cards],
  );

  const movers = useMemo(() => {
    const withChg = allRows.filter((r) => r.changePct != null);
    if (withChg.length === 0) return { up: null, down: null, nUp: 0, nDown: 0 };
    const sorted = [...withChg].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
    return {
      up: sorted[0].changePct! > 0 ? sorted[0] : null,
      down: sorted[sorted.length - 1].changePct! < 0 ? sorted[sorted.length - 1] : null,
      nUp: withChg.filter((r) => (r.changePct ?? 0) > 0).length,
      nDown: withChg.filter((r) => (r.changePct ?? 0) < 0).length,
    };
  }, [allRows]);

  // 시장 지표는 로그인·보유 카드와 무관한 공개 데이터 — 에러/빈 상태에서도 아래에 그린다.
  const marketOnly = <MarketIndexPanel series={marketSeries} />;
  if (err)
    return (
      <div className="cv-pf-board">
      <div className="cv-pf-msg">
        ⚠ {err}
        <br />
        <button
          type="button"
          onClick={() => setReload((n) => n + 1)}
          style={{
            marginTop: 12,
            padding: '8px 18px',
            background: 'transparent',
            color: '#7FB0FF',
            border: '1px solid #7FB0FF',
            borderRadius: 6,
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          다시 시도
        </button>
      </div>
      {marketOnly}
      </div>
    );
  if (!port || !cards) return <div className="cv-pf-board cv-pf-msg">불러오는 중…</div>;
  if (port.totalCount === 0)
    return (
      <div className="cv-pf-board">
      <div className="cv-pf-msg">
        아직 보유 카드가 없어요.
        <br />
        <Link href="/cards/add" style={{ color: '#7FB0FF', textDecoration: 'underline' }}>
          카드 추가하러 가기 →
        </Link>
      </div>
      {marketOnly}
      </div>
    );

  const totalJpy = usePsa10 && port.totalPsa10Jpy > 0 ? port.totalPsa10Jpy : port.totalJpy;
  const up = (port.changePct ?? 0) >= 0;
  const gradedCount = cards.filter((c) => c.graded).length;
  const pullCount = cards.filter((c) => c.selfPulled).length;
  const hist = range === 0 ? port.history : port.history.slice(-range);

  const FILTERS: Array<{ k: Filter; label: string; n: number }> = [
    { k: 'all', label: '전체', n: allRows.length },
    { k: 'up', label: '🔺상승', n: movers.nUp },
    { k: 'down', label: '🔻하락', n: movers.nDown },
    { k: 'graded', label: '🏅등급', n: gradedCount },
    { k: 'pull', label: '🎁직뽑', n: pullCount },
  ];

  return (
    <div className="cv-pf-board">
      <div className="cv-pf-grid" />

      {/* ── 전광판 헤더 ── */}
      <div className="cv-pf-top">
        <span className="cv-pf-id"><span className="cv-pf-dot" /> MY PORTFOLIO{usePsa10 ? ' · PSA10' : ''}</span>
        <span className="cv-pf-asof">{port.asOfDate ?? '실시간'} · KST</span>
      </div>
      <div className="cv-pf-valrow">
        <span className="cv-pf-val">{format(totalJpy)}</span>
        {port.changePct != null && (
          <span className="cv-pf-chg" style={{ color: up ? UP : DOWN }}>
            <span className="cv-pf-tri" style={{ borderBottomColor: up ? UP : 'transparent', borderTopColor: up ? 'transparent' : DOWN }} />
            {up ? '+' : ''}{port.changePct.toFixed(2)}%
            {port.changeAbsJpy != null && <em> {up ? '+' : '-'}{format(Math.abs(port.changeAbsJpy))}</em>}
          </span>
        )}
      </div>

      {/* ── KPI 인포그래픽 그리드 ── */}
      <div className="cv-pf-kpis">
        <Kpi label="매입 합계" value={totals.invested > 0 ? format(totals.invested) : '—'} />
        <Kpi label="현재 평가" value={totals.current > 0 ? format(totals.current) : format(totalJpy)} color={GOLD} />
        <Kpi
          label="평가손익"
          value={totals.pct != null ? `${totals.profit >= 0 ? '+' : '-'}${format(Math.abs(totals.profit))}` : '—'}
          sub={totals.pct != null ? `${totals.pct >= 0 ? '+' : ''}${totals.pct.toFixed(1)}%` : undefined}
          color={totals.pct == null ? undefined : totals.profit >= 0 ? UP : DOWN}
        />
        <Kpi label="보유" value={`${cards.length}장`} />
        <Kpi label="시세반영" value={`${port.pricedCount}/${port.totalCount}`} color="#7FB0FF" />
        <Kpi label="그레이딩" value={`${gradedCount}건`} color="#A78BFA" />
      </div>

      {/* ── 차트 (기간 탭 + 호버/탭 툴팁) ── */}
      <div className="cv-pf-rangebar">
        {([7, 30, 90, 0] as Range[]).map((r) => (
          <button key={r} type="button" className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
            {r === 0 ? '전체' : `${r}일`}
          </button>
        ))}
      </div>
      <PortfolioChart history={hist} format={format} />

      {/* ── 인사이트 타일 (승률·평균 손익·PSA10 업사이드·최고 평가일 대비) ── */}
      <div style={{ marginTop: 12 }}>
        <InsightTiles cards={vizCards} upside={upside} history={port.history} format={format} />
      </div>

      {/* ── 내 자산 vs 시장 (구간 시작 = 100) ── */}
      <div style={{ marginTop: 18 }}>
        <VizSection title="내 자산 vs 시장" sub="선택 구간 시작일 = 100 · 같은 축">
          <CompareChart history={hist} market={marketSeries} format={format} />
        </VizSection>
      </div>

      {/* ── 시장 지표 (포켓몬 S&Poké 500 · 원피스 ARVO OP200) ── */}
      <MarketIndexPanel series={marketSeries} />

      {/* ── 오늘의 등락 (movers) ── */}
      {(movers.up || movers.down) && (
        <div className="cv-pf-movers">
          <Mover row={movers.up} dir="up" format={format} />
          <Mover row={movers.down} dir="down" format={format} />
        </div>
      )}

      {/* ── 인포그래픽 (구성·분류·손익 분포) ── */}
      <PortfolioInfographics cards={vizCards} format={format} totalJpy={totalJpy} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 18 }}>
        <VizSection title="분포" sub="손익률 · 평가액 가격대">
          <Histograms cards={vizCards} />
        </VizSection>
        {acquisitions.length > 0 && (
          <VizSection title="취득 타임라인" sub="월별 장수 · 매입액">
            <AcquisitionBars rows={acquisitions} format={format} />
          </VizSection>
        )}
        {upside && (
          <VizSection title="그레이딩 잠재가치" sub="비등급 보유분 RAW vs PSA10 환산">
            <GradingUpsideCard upside={upside} format={format} />
          </VizSection>
        )}
      </div>

      {/* ── 필터 + 정렬 ── */}
      <div className="cv-pf-filters">
        {FILTERS.map((f) => (
          <button key={f.k} type="button" className={filter === f.k ? 'on' : ''} onClick={() => setFilter(f.k)}>
            {f.label} <em>{f.n}</em>
          </button>
        ))}
      </div>
      <div className="cv-pf-listhead">
        <span>보유 종목 {rows.length}</span>
        <div className="cv-pf-sort">
          {(['value', 'change'] as const).map((s) => (
            <button key={s} type="button" className={sort === s ? 'on' : ''} onClick={() => setSort(s)}>
              {s === 'value' ? '평가액순' : '등락순'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 종목 리스트 ── */}
      <div className="cv-pf-list">
        {rows.length === 0 && <div className="cv-pf-none">해당 조건의 종목이 없어요</div>}
        {rows.map(({ c, curJpy, qty, changePct, basisJpy }) => {
          const img = c.snkrdunkImageUrl || c.photoUrl || null;
          const name = c.snkrdunkName || c.nickname || '이름 미상';
          const cu = (changePct ?? 0) >= 0;
          return (
            <div key={c.id} className="cv-pf-row">
              <div className="cv-pf-thumb">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={name} />
                ) : (
                  <span>🃏</span>
                )}
              </div>
              <div className="cv-pf-rowmid">
                <div className="cv-pf-rowname">
                  {name}
                  {c.graded && <span className="cv-pf-badge">{c.gradeCompany ?? 'PSA'} {c.gradeValue ?? ''}</span>}
                </div>
                <div className="cv-pf-rowsub">
                  {[c.ocrSetCode?.toUpperCase(), c.ocrCardNumber].filter(Boolean).join(' · ')}
                  {qty > 1 ? ` · ×${qty}` : ''}
                  {c.selfPulled ? ' · 직접뽑기' : ''}
                </div>
              </div>
              <Spark trend={c.trend ?? []} up={cu} />
              <div className="cv-pf-rowprice">
                <div className="cv-pf-rowcur">{curJpy > 0 ? format(curJpy) : '—'}</div>
                {changePct != null ? (
                  <div className="cv-pf-rowchg" style={{ color: cu ? UP : DOWN }}>
                    {cu ? '▲' : '▼'} {cu ? '+' : ''}{changePct.toFixed(1)}%
                    <span className="cv-pf-rowbasis">{basisJpy != null ? '매입' : '전일'}</span>
                  </div>
                ) : (
                  <div className="cv-pf-rowchg" style={{ color: 'rgba(255,255,255,.3)' }}>—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="cv-pf-foot">스니덩크 최근 체결 중앙값 기준 · 관심카드 제외 · 어제(KST 정각) 대비</div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="cv-pf-kpi">
      <div className="cv-pf-kpi-l">{label}</div>
      <div className="cv-pf-kpi-v" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="cv-pf-kpi-s" style={color ? { color } : undefined}>{sub}</div>}
    </div>
  );
}

function Mover({
  row,
  dir,
  format,
}: {
  row: { c: CardRow; changePct: number | null } | null;
  dir: 'up' | 'down';
  format: (j: number) => string;
}) {
  const color = dir === 'up' ? UP : DOWN;
  if (!row) return <div className="cv-pf-mover"><span className="cv-pf-mover-h" style={{ color }}>{dir === 'up' ? '▲ TOP' : '▼ TOP'}</span><span className="cv-pf-mover-n">—</span></div>;
  const name = row.c.snkrdunkName || row.c.nickname || '이름 미상';
  return (
    <div className="cv-pf-mover">
      <span className="cv-pf-mover-h" style={{ color }}>{dir === 'up' ? '▲ 상승 TOP' : '▼ 하락 TOP'}</span>
      <span className="cv-pf-mover-n">{name}</span>
      <span className="cv-pf-mover-p" style={{ color }}>
        {(row.changePct ?? 0) >= 0 ? '+' : ''}{(row.changePct ?? 0).toFixed(1)}%
      </span>
    </div>
  );
}

/** 카드별 미니 스파크라인. */
function Spark({ trend, up }: { trend: number[]; up: boolean }) {
  const pts = (trend ?? []).filter((n) => typeof n === 'number' && n > 0);
  if (pts.length < 2) return <div className="cv-pf-spark" />;
  const W = 44;
  const H = 22;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1, max - min);
  const step = W / (pts.length - 1);
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(H - 2 - ((v - min) / span) * (H - 4)).toFixed(1)}`).join(' ');
  return (
    <svg className="cv-pf-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <path d={d} fill="none" stroke={up ? UP : DOWN} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/* ───────── 인터랙티브 차트 (호버 툴팁 + 클릭 핀) ───────── */

function PortfolioChart({ history, format }: { history: HistPoint[]; format: (jpy: number) => string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);

  if (history.length < 2) {
    return <div className="cv-pf-chart-empty">일별 데이터가 2일 이상 쌓이면 차트가 표시돼요</div>;
  }

  const W = 320;
  const H = 150;
  const PAD = 6;
  const n = history.length;
  const vals = history.map((h) => h.totalJpy);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const step = (W - PAD * 2) / (n - 1);
  const xOf = (i: number) => PAD + i * step;
  const yOf = (i: number) => H - PAD - ((history[i].totalJpy - min) / span) * (H - PAD * 2);
  const line = history.map((_, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(i).toFixed(1)}`).join(' ');
  const area = `${line} L ${xOf(n - 1).toFixed(1)} ${H} L ${xOf(0).toFixed(1)} ${H} Z`;
  const overallUp = vals[n - 1] >= vals[0];
  const stroke = overallUp ? UP : DOWN;

  const active = hover ?? pinned;
  const aPrev = active != null && active > 0 ? history[active - 1].totalJpy : null;
  const aPct = active != null && aPrev && aPrev > 0 ? ((history[active].totalJpy - aPrev) / aPrev) * 100 : null;

  const idxFromClientX = (clientX: number): number => {
    const el = wrapRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(frac * (n - 1));
  };

  return (
    <div
      ref={wrapRef}
      className="cv-pf-chart"
      onMouseMove={(e) => setHover(idxFromClientX(e.clientX))}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => setPinned(idxFromClientX(e.clientX))}
      onTouchStart={(e) => { if (e.touches[0]) setPinned(idxFromClientX(e.touches[0].clientX)); }}
      onTouchMove={(e) => { if (e.touches[0]) setHover(idxFromClientX(e.touches[0].clientX)); }}
      onTouchEnd={() => setHover(null)}
    >
      {active != null && (
        <div className="cv-pf-tip" style={{ left: `${(active / (n - 1)) * 100}%` }}>
          <div className="cv-pf-tip-date">{history[active].date}</div>
          <div className="cv-pf-tip-amt">{format(history[active].totalJpy)}</div>
          {aPct != null && (
            <div className="cv-pf-tip-pct" style={{ color: aPct >= 0 ? UP : DOWN }}>
              {aPct >= 0 ? '▲ +' : '▼ '}{aPct.toFixed(2)}%
            </div>
          )}
        </div>
      )}
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', touchAction: 'none' }}>
        <defs>
          <linearGradient id="pfFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pfFill)" stroke="none" />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
        {active != null && (
          <>
            <line x1={xOf(active)} y1={0} x2={xOf(active)} y2={H} stroke="rgba(255,255,255,.4)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={xOf(active)} cy={yOf(active)} r={4} fill="#fff" stroke={stroke} strokeWidth={2} />
          </>
        )}
      </svg>
      <div className="cv-pf-axis">
        <span>{history[0].date}</span>
        <span>{n}일 · 탭/호버 상세</span>
        <span>{history[n - 1].date}</span>
      </div>
    </div>
  );
}
