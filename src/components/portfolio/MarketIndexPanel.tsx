'use client';

import { useMemo, useRef, useState } from 'react';
import {
  MARKET_INDEX_CHIPS,
  MARKET_INDEX_RANGES,
  lineGeometry,
  nearestIndex,
  pctChangeOver,
  sliceRange,
  type MarketIndexSeries,
} from '../../../shared/marketIndex';
import { VIZ_DOWN, VIZ_SERIES, VIZ_UP } from '../../../shared/portfolioViz';

/**
 * 시장 지표(TCG 인덱스) 패널 — 웹. 앱 mobile/src/components/portfolio/MarketIndexPanel.tsx 와 페어.
 * 데이터는 /api/market-index (포켓몬 = S&Poké 500 외부, 원피스 = ARVO OP200 서버 계산).
 *
 * 지수마다 기준값(1000)이 같아도 바스켓이 달라 한 축에 겹쳐 그리지 않는다 — 소형 다중(small
 * multiples) 한 장씩. 기간 탭은 공유. 선 위 호버/터치 크로스헤어로 날짜·값·전일 대비 표시.
 */

interface Props {
  series: MarketIndexSeries[];
}

const LABEL = 'rgba(255,255,255,.55)';
const MUTED = 'rgba(255,255,255,.34)';
const INK = 'rgba(255,255,255,.92)';
const PANEL = 'rgba(255,255,255,.04)';
const LINE = 'rgba(255,255,255,.08)';

const SERIES_COLOR: Record<string, string> = {
  pokemon: VIZ_SERIES[0],
  onepiece: VIZ_SERIES[1],
  yugioh: VIZ_SERIES[2],
};

export function MarketIndexPanel({ series }: Props) {
  const [rangeIdx, setRangeIdx] = useState(2); // 6개월
  // 게임 선택 칩 — 포켓몬·원피스·유희왕 중 하나. 응답에 있는 게임만 활성.
  const [gameKey, setGameKey] = useState<string | null>(null);
  if (series.length === 0) return null;
  const days = MARKET_INDEX_RANGES[rangeIdx].days;
  const available = MARKET_INDEX_CHIPS.filter((c) => series.some((s) => s.key === c.key));
  const activeKey = gameKey && series.some((s) => s.key === gameKey) ? gameKey : available[0]?.key ?? series[0].key;
  const shown = series.filter((s) => s.key === activeKey);

  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--f1)', fontSize: 14, fontWeight: 800, color: INK, letterSpacing: 0.6 }}>
            시장 지표
          </h3>
          <span style={{ fontFamily: 'var(--f1)', fontSize: 11, color: MUTED }}>TCG 전체 시장 인덱스 · 내 자산과 비교</span>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.06)', borderRadius: 999, padding: 3 }}>
          {MARKET_INDEX_RANGES.map((r, i) => {
            const on = i === rangeIdx;
            return (
              <button
                key={r.days}
                type="button"
                onClick={() => setRangeIdx(i)}
                style={{
                  border: 'none', cursor: 'pointer', borderRadius: 999, padding: '5px 11px',
                  fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800,
                  background: on ? 'rgba(255,255,255,.16)' : 'transparent',
                  color: on ? INK : MUTED,
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {available.map((c) => {
          const on = c.key === activeKey;
          const col = SERIES_COLOR[c.key] ?? VIZ_SERIES[0];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setGameKey(c.key)}
              style={{
                cursor: 'pointer', borderRadius: 999, padding: '7px 14px',
                border: `1.5px solid ${on ? col : 'rgba(255,255,255,.14)'}`,
                background: on ? col : 'transparent',
                fontFamily: 'var(--f1)', fontSize: 12, fontWeight: 800,
                color: on ? '#fff' : LABEL,
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.map((s) => (
          <IndexCard key={s.key} s={s} days={days} />
        ))}
      </div>
    </section>
  );
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function Chip({ label, v }: { label: string; v: number | null }) {
  const c = v == null ? MUTED : v >= 0 ? VIZ_UP : VIZ_DOWN;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontFamily: 'var(--f1)' }}>
      <span style={{ fontSize: 10, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: c }}>{fmtPct(v)}</span>
    </span>
  );
}

const W = 320;
const H = 120;

function IndexCard({ s, days }: { s: MarketIndexSeries; days: number }) {
  const color = SERIES_COLOR[s.key] ?? VIZ_SERIES[0];
  const pts = useMemo(() => sliceRange(s.points, days), [s.points, days]);
  const geo = useMemo(() => lineGeometry(pts, W, H, 6), [pts]);
  const rangePct = pctChangeOver(pts, days > 0 ? days : 100_000);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = hover ?? pinned;

  const idxFromClientX = (clientX: number): number => {
    const el = wrapRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return nearestIndex(geo, (clientX - r.left) / r.width, W);
  };
  const ap = active != null ? pts[active] : null;
  const aPrev = active != null && active > 0 ? pts[active - 1] : null;
  const aPct = ap && aPrev && aPrev.value > 0 ? ((ap.value - aPrev.value) / aPrev.value) * 100 : null;
  const gid = `mi-${s.key}`;

  return (
    <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flex: 'none' }} />
          <span style={{ fontFamily: 'var(--f1)', fontSize: 13, fontWeight: 800, color: INK }}>{s.label}</span>
          <span style={{ fontFamily: 'var(--f1)', fontSize: 10, fontWeight: 800, color: INK, background: 'rgba(255,255,255,.1)', padding: '2px 7px', borderRadius: 999 }}>
            {s.indexName}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--f1)', fontSize: 10, color: MUTED }}>{s.asOf} 기준</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--f1)', fontSize: 26, fontWeight: 900, color: INK, letterSpacing: -0.5, lineHeight: 1 }}>
          {s.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <div style={{ display: 'flex', gap: 12, paddingBottom: 3, flexWrap: 'wrap' }}>
          <Chip label="1일" v={s.change1d} />
          <Chip label="7일" v={s.change7d} />
          <Chip label="30일" v={s.change30d} />
          <Chip label="기간" v={rangePct} />
        </div>
      </div>

      <div
        ref={wrapRef}
        style={{ position: 'relative', marginTop: 10, touchAction: 'pan-y' }}
        onMouseMove={(e) => setHover(idxFromClientX(e.clientX))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => setPinned((p) => (p === idxFromClientX(e.clientX) ? null : idxFromClientX(e.clientX)))}
        onTouchStart={(e) => { if (e.touches[0]) setPinned(idxFromClientX(e.touches[0].clientX)); }}
        onTouchMove={(e) => { if (e.touches[0]) setHover(idxFromClientX(e.touches[0].clientX)); }}
        onTouchEnd={() => setHover(null)}
      >
        {ap && (
          <div
            style={{
              position: 'absolute', top: 0, transform: 'translateX(-50%)', pointerEvents: 'none',
              left: `${(geo.xy[active!][0] / W) * 100}%`,
              background: 'rgba(8,13,24,.94)', border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 9px',
              fontFamily: 'var(--f1)', whiteSpace: 'nowrap', zIndex: 2,
            }}
          >
            <div style={{ fontSize: 10, color: MUTED }}>{ap.date}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>{ap.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            {aPct != null && <div style={{ fontSize: 11, fontWeight: 800, color: aPct >= 0 ? VIZ_UP : VIZ_DOWN }}>{fmtPct(aPct)}</div>}
          </div>
        )}
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={0.28} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* 그리드(뒤로 물러난 톤) */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,.06)" strokeWidth={1} />
          ))}
          {geo.areaPath && <path d={geo.areaPath} fill={`url(#${gid})`} />}
          {geo.linePath && <path d={geo.linePath} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />}
          {ap && active != null && (
            <>
              <line x1={geo.xy[active][0]} x2={geo.xy[active][0]} y1={0} y2={H} stroke="rgba(255,255,255,.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <circle cx={geo.xy[active][0]} cy={geo.xy[active][1]} r={4} fill={color} stroke="#0C1426" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--f1)', fontSize: 10, color: MUTED, marginTop: 4 }}>
          <span>{pts[0]?.date ?? ''}</span>
          <span>{pts[pts.length - 1]?.date ?? ''}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LINE}`, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--f1)', fontSize: 10, color: LABEL }}>{s.basketLabel} · 기준일 = 1,000</span>
        <a href={s.sourceUrl} target="_blank" rel="noreferrer noopener" style={{ fontFamily: 'var(--f1)', fontSize: 10, color: MUTED, textDecoration: 'underline' }}>
          {s.source}
        </a>
      </div>
      {s.breadth && (
        <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: MUTED, marginTop: 6 }}>
          구성 종목 전일 대비 — 상승 <b style={{ color: VIZ_UP }}>{s.breadth.advancing}</b> · 하락 <b style={{ color: VIZ_DOWN }}>{s.breadth.declining}</b> · 보합 {s.breadth.unchanged}
        </div>
      )}
    </div>
  );
}
