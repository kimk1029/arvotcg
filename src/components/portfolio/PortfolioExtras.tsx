'use client';

import { useMemo, useRef, useState } from 'react';
import {
  acquisitionTimeline,
  alignAndRebase,
  gradingUpside,
  profitHistogram,
  rebaseTo100,
  ringArcs,
  valueHistogram,
  winStats,
  VIZ_DOWN,
  VIZ_OTHER,
  VIZ_SERIES,
  VIZ_UP,
  type GradingUpside,
  type VizAcquisition,
  type VizBar,
  type VizCard,
  type VizSlice,
} from '../../../shared/portfolioViz';
import { multiLineGeometry, type MarketIndexPoint, type MarketIndexSeries } from '../../../shared/marketIndex';

/**
 * 포트폴리오 확장 인포그래픽 — 웹. 앱 mobile/src/components/portfolio/PortfolioExtras.tsx 와 페어.
 * 집계·기하는 전부 정본(shared/portfolioViz.ts, shared/marketIndex.ts). 여기는 그리기만.
 *
 *  · CompareChart      내 자산 vs 시장 지수 — 구간 첫날 = 100 재기준(공통 축 허용 조건).
 *  · InsightTiles      승률·평균/중앙 손익률·PSA10 환산 업사이드·최고 평가일 대비.
 *  · RingComposition   자산 구성 링(가운데 총액) — 조각 ≤6, 직접 라벨 범례는 옆 누적바가 담당.
 *  · Histograms        손익률 분포 · 가격대 분포 (막대).
 *  · AcquisitionBars   월별 취득 건수·매입액 (최근 12개월).
 *  · GradingUpsideCard 비등급 보유분 raw 총액 vs PSA10 환산 총액.
 */

const LABEL = 'rgba(255,255,255,.55)';
const MUTED = 'rgba(255,255,255,.34)';
const INK = 'rgba(255,255,255,.92)';
const PANEL = 'rgba(255,255,255,.04)';
const LINE = 'rgba(255,255,255,.08)';
const F = 'var(--f1)';

export function Section({ title, sub, children, right }: { title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0, fontFamily: F, fontSize: 14, fontWeight: 800, color: INK, letterSpacing: 0.6 }}>{title}</h3>
          {sub && <span style={{ fontFamily: F, fontSize: 11, color: MUTED }}>{sub}</span>}
        </div>
        {right}
      </div>
      <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

/* ── 내 자산 vs 시장 ─────────────────────────────────────────────── */

const CW = 320;
const CH = 150;
const COMPARE_COLORS: Record<string, string> = { mine: '#FFD23F', pokemon: VIZ_SERIES[0], onepiece: VIZ_SERIES[1] };

export function CompareChart({
  history,
  market,
  format,
}: {
  /** 내 자산 히스토리(선택 구간, 오래된→최신). */
  history: Array<{ date: string; totalJpy: number }>;
  market: MarketIndexSeries[];
  format: (jpy: number) => string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const mine = useMemo(() => rebaseTo100(history.map((h) => ({ date: h.date, value: h.totalJpy }))), [history]);
  const lines = useMemo(() => {
    if (mine.length < 2) return [];
    const from = mine[0].date;
    const to = mine[mine.length - 1].date;
    const out: Array<{ key: string; label: string; points: MarketIndexPoint[] }> = [{ key: 'mine', label: '내 자산', points: mine }];
    for (const s of market) {
      const pts = alignAndRebase(s.points, from, to);
      if (pts.length >= 2) out.push({ key: s.key, label: s.label.replace(' TCG 지수', ''), points: pts });
    }
    return out;
  }, [mine, market]);
  const geo = useMemo(() => multiLineGeometry(lines, CW, CH, 6), [lines]);
  if (lines.length === 0) {
    return <div style={{ fontFamily: F, fontSize: 12, color: MUTED, textAlign: 'center', padding: '18px 0' }}>일별 자산 데이터가 2일 이상 쌓이면 시장과 비교해 드려요</div>;
  }
  // 호버: 내 자산 선의 가장 가까운 포인트 날짜를 기준으로 각 선의 같은 날짜(또는 직전) 값을 찾는다.
  const idxFromClientX = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * CW;
    const xs = geo.lines[0]?.xy ?? [];
    let best = 0;
    let bd = Infinity;
    xs.forEach(([px], i) => {
      const d = Math.abs(px - x);
      if (d < bd) { bd = d; best = i; }
    });
    return xs.length ? best : null;
  };
  const hDate = hover != null ? lines[0].points[hover]?.date : null;
  const valueAt = (pts: MarketIndexPoint[], date: string) => {
    let v: number | null = null;
    for (const p of pts) { if (p.date <= date) v = p.value; else break; }
    return v;
  };
  const hx = hover != null ? geo.lines[0].xy[hover]?.[0] : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
        {lines.map((l) => {
          const last = l.points[l.points.length - 1].value - 100;
          return (
            <span key={l.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: F, fontSize: 12, color: LABEL }}>
              <span style={{ width: 14, height: 3, borderRadius: 2, background: COMPARE_COLORS[l.key] ?? VIZ_OTHER }} />
              {l.label}
              <b style={{ color: last >= 0 ? VIZ_UP : VIZ_DOWN }}>{pct(last)}</b>
            </span>
          );
        })}
      </div>
      <div
        ref={wrapRef}
        style={{ position: 'relative' }}
        onMouseMove={(e) => setHover(idxFromClientX(e.clientX))}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => { if (e.touches[0]) setHover(idxFromClientX(e.touches[0].clientX)); }}
        onTouchMove={(e) => { if (e.touches[0]) setHover(idxFromClientX(e.touches[0].clientX)); }}
        onTouchEnd={() => setHover(null)}
      >
        {hDate && hx != null && (
          <div style={{ position: 'absolute', top: 0, left: `${(hx / CW) * 100}%`, transform: 'translateX(-50%)', background: 'rgba(8,13,24,.94)', border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 9px', fontFamily: F, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2 }}>
            <div style={{ fontSize: 10, color: MUTED }}>{hDate}</div>
            {lines.map((l) => {
              const v = valueAt(l.points, hDate);
              return (
                <div key={l.key} style={{ fontSize: 11, fontWeight: 800, color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: COMPARE_COLORS[l.key] ?? VIZ_OTHER }} />
                  {l.label} {v == null ? '—' : pct(v - 100)}
                  {l.key === 'mine' && hover != null && history[hover] ? <em style={{ fontStyle: 'normal', color: MUTED, fontWeight: 400 }}>· {format(history[hover].totalJpy)}</em> : null}
                </div>
              );
            })}
          </div>
        )}
        <svg width="100%" height={CH} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          {/* 100 기준선 */}
          {geo.max > geo.min && (() => {
            const y = 6 + (1 - (100 - geo.min) / (geo.max - geo.min)) * (CH - 12);
            return <line x1={0} x2={CW} y1={y} y2={y} stroke="rgba(255,255,255,.18)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />;
          })()}
          {geo.lines.map((l) => (
            <path key={l.key} d={l.path} fill="none" stroke={COMPARE_COLORS[l.key] ?? VIZ_OTHER} strokeWidth={l.key === 'mine' ? 2.5 : 2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hx != null && <line x1={hx} x2={hx} y1={0} y2={CH} stroke="rgba(255,255,255,.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 10, color: MUTED, marginTop: 4 }}>
          <span>{lines[0].points[0].date}</span>
          <span>구간 시작 = 100</span>
          <span>{lines[0].points[lines[0].points.length - 1].date}</span>
        </div>
      </div>
    </div>
  );
}

/* ── 인사이트 타일 ──────────────────────────────────────────────── */

export function InsightTiles({
  cards,
  upside,
  history,
  format,
}: {
  cards: VizCard[];
  upside: GradingUpside | null;
  history: Array<{ date: string; totalJpy: number }>;
  format: (jpy: number) => string;
}) {
  const ws = winStats(cards);
  const ath = history.reduce<{ date: string; totalJpy: number } | null>((a, h) => (!a || h.totalJpy > a.totalJpy ? h : a), null);
  const last = history[history.length - 1];
  const fromAth = ath && last && ath.totalJpy > 0 ? ((last.totalJpy - ath.totalJpy) / ath.totalJpy) * 100 : null;
  const tiles: Array<{ label: string; value: string; sub?: string; color?: string }> = [
    { label: '승률', value: ws ? `${ws.winRate.toFixed(0)}%` : '—', sub: ws ? `${ws.n}종 중 상승` : undefined, color: ws && ws.winRate >= 50 ? VIZ_UP : undefined },
    { label: '평균 손익률', value: ws ? pct(ws.avgPct) : '—', sub: ws ? `중앙값 ${pct(ws.medianPct)}` : undefined, color: ws ? (ws.avgPct >= 0 ? VIZ_UP : VIZ_DOWN) : undefined },
    { label: 'PSA10 환산 업사이드', value: upside ? pct(upside.pct, 0) : '—', sub: upside ? `${upside.n}종 · ${format(upside.diffJpy)}` : '비등급 카드 없음', color: upside ? '#A78BFA' : undefined },
    { label: '최고 평가일 대비', value: fromAth == null ? '—' : fromAth > -0.05 ? '최고가' : pct(fromAth), sub: ath ? `${ath.date} ${format(ath.totalJpy)}` : undefined, color: fromAth != null ? (fromAth >= 0 ? VIZ_UP : VIZ_DOWN) : undefined },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      {tiles.map((t) => (
        <div key={t.label} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontFamily: F, fontSize: 11, color: MUTED }}>{t.label}</div>
          <div style={{ fontFamily: F, fontSize: 20, fontWeight: 900, color: t.color ?? INK, marginTop: 4, letterSpacing: -0.3 }}>{t.value}</div>
          {t.sub && <div style={{ fontFamily: F, fontSize: 10, color: LABEL, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── 자산 구성 링 ───────────────────────────────────────────────── */

export function RingComposition({ slices, total, format }: { slices: VizSlice[]; total: number; format: (jpy: number) => string }) {
  const arcs = useMemo(() => ringArcs(slices, 60, 60, 56, 38, 2), [slices]);
  const [hot, setHot] = useState<string | null>(null);
  const active = slices.find((s) => s.key === hot);
  if (arcs.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ flex: 'none' }}>
        {arcs.map(({ slice, d }) => (
          <path key={slice.key} d={d} fill={slice.color} opacity={hot && hot !== slice.key ? 0.4 : 1} onMouseEnter={() => setHot(slice.key)} onMouseLeave={() => setHot(null)}>
            <title>{`${slice.label} · ${format(slice.value)} (${slice.pct.toFixed(1)}%)`}</title>
          </path>
        ))}
        <text x={60} y={56} textAnchor="middle" fontFamily="var(--f1)" fontSize={9} fill={MUTED}>{active ? active.label.slice(0, 10) : '총 평가액'}</text>
        <text x={60} y={71} textAnchor="middle" fontFamily="var(--f1)" fontSize={12} fontWeight={900} fill={INK}>{active ? `${active.pct.toFixed(1)}%` : format(total)}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s) => (
          <div key={s.key} onMouseEnter={() => setHot(s.key)} onMouseLeave={() => setHot(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: hot && hot !== s.key ? 0.5 : 1 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: 'none' }} />
            <span style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: 12, color: LABEL, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, color: INK, flex: 'none' }}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 히스토그램 (세로 막대) ────────────────────────────────────── */

export function BarHistogram({ title, bars, unit = '종', format }: { title: string; bars: VizBar[]; unit?: string; format?: (n: number) => string }) {
  const total = bars.reduce((a, b) => a + b.value, 0);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, color: LABEL }}>{title}</span>
        <span style={{ fontFamily: F, fontSize: 11, color: MUTED }}>{total}{unit}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 84 }}>
        {bars.map((b) => (
          <div key={b.key} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }} title={`${b.label} · ${b.value}${unit}${b.extra != null && format ? ` · ${format(b.extra)}` : ''}`}>
            <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, color: b.value > 0 ? INK : MUTED }}>{b.value > 0 ? b.value : ''}</span>
            <div style={{ width: '100%', height: `${Math.max(b.value > 0 ? 4 : 2, b.ratio * 60)}px`, background: b.value > 0 ? b.color : 'rgba(255,255,255,.08)', borderRadius: '4px 4px 0 0' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
        {bars.map((b) => (
          <span key={b.key} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontFamily: F, fontSize: 9, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

export function Histograms({ cards }: { cards: VizCard[] }) {
  const p = useMemo(() => profitHistogram(cards), [cards]);
  const v = useMemo(() => valueHistogram(cards), [cards]);
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      <BarHistogram title="손익률 분포" bars={p} />
      <BarHistogram title="가격대 분포 (¥)" bars={v} />
    </div>
  );
}

/* ── 월별 취득 ─────────────────────────────────────────────────── */

export function AcquisitionBars({ rows, format }: { rows: VizAcquisition[]; format: (jpy: number) => string }) {
  const bars = useMemo(() => acquisitionTimeline(rows, 12), [rows]);
  if (bars.length === 0) return null;
  const spend = bars.reduce((a, b) => a + (b.extra ?? 0), 0);
  const n = bars.reduce((a, b) => a + b.value, 0);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, color: LABEL }}>최근 12개월 취득</span>
        <span style={{ fontFamily: F, fontSize: 11, color: MUTED }}>{n}장 · {format(spend)}</span>
      </div>
      <BarHistogram title="" bars={bars} unit="장" format={format} />
    </div>
  );
}

/* ── 그레이딩 잠재가치 ─────────────────────────────────────────── */

export function GradingUpsideCard({ upside, format }: { upside: GradingUpside | null; format: (jpy: number) => string }) {
  if (!upside) return null;
  const max = Math.max(upside.rawJpy, upside.psa10Jpy, 1);
  const Row = ({ label, v, color }: { label: string; v: number; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 64, flex: 'none', fontFamily: F, fontSize: 11, color: LABEL }}>{label}</span>
      <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${(v / max) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ width: 84, flex: 'none', textAlign: 'right', fontFamily: F, fontSize: 12, fontWeight: 800, color: INK }}>{format(v)}</span>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Row label="현재 (RAW)" v={upside.rawJpy} color={VIZ_SERIES[2]} />
      <Row label="PSA10 환산" v={upside.psa10Jpy} color="#A78BFA" />
      <div style={{ fontFamily: F, fontSize: 11, color: MUTED }}>
        비등급 {upside.n}종을 전부 PSA10 으로 그레이딩했을 때의 시세 합 — 차이 <b style={{ color: upside.diffJpy >= 0 ? VIZ_UP : VIZ_DOWN }}>{pct(upside.pct, 0)} ({format(upside.diffJpy)})</b>. 그레이딩 비용·등급 실패 위험은 반영하지 않은 참고값.
      </div>
    </div>
  );
}

/** 편의: 카드 배열에서 upside 입력 만들기(웹·앱 동일 매핑). */
export function upsideFromCards(rows: Array<{ graded: boolean; qty: number; priceSingleJpy: number; pricePsa10Jpy: number }>): GradingUpside | null {
  return gradingUpside(rows.map((r) => ({ graded: r.graded, qty: r.qty, singleJpy: r.priceSingleJpy, psa10Jpy: r.pricePsa10Jpy })));
}
