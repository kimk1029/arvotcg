'use client';

import { useState } from 'react';
import {
  compositionByCard,
  compositionByGame,
  compositionByGrade,
  compositionBySeries,
  compositionBySource,
  concentration,
  stackLayout,
  topMovers,
  VIZ_DOWN,
  VIZ_UP,
  type VizCard,
  type VizSlice,
} from '../../../shared/portfolioViz';

/**
 * 포트폴리오 인포그래픽 — 웹. 앱 mobile/src/components/portfolio/PortfolioInfographics.tsx 와 페어.
 * 집계·색·배치는 전부 정본 shared/portfolioViz.ts. 여기는 그리기만 한다.
 *
 * 폼 선택 근거(dataviz):
 *  · 비중 = 크기 비교 + 정체성 → 누적 가로바 + 직접 라벨 범례 (작은 화면에서 도넛보다 읽기 쉽다)
 *  · 손익 = 극성(+/−) → 0 기준 발산형 바, 상태색만 사용
 *  · 집중도 = 단일 헤드라인 수치 → 차트가 아니라 스탯 + 미터
 */

interface Props {
  cards: VizCard[];
  format: (jpy: number) => string;
}

const LABEL = 'rgba(255,255,255,.55)';
const MUTED = 'rgba(255,255,255,.34)';
const INK = 'rgba(255,255,255,.92)';
const PANEL = 'rgba(255,255,255,.04)';
const LINE = 'rgba(255,255,255,.08)';

export function PortfolioInfographics({ cards, format }: Props) {
  const byCard = compositionByCard(cards, 5);
  const byGrade = compositionByGrade(cards, 4);
  const byGame = compositionByGame(cards, 4);
  const bySource = compositionBySource(cards);
  const bySeries = compositionBySeries(cards, 5);
  const movers = topMovers(cards, 5);
  const conc = concentration(cards);
  const hasValue = byCard.length > 0;

  if (!hasValue) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 20 }}>
      <Section title="자산 구성" sub="평가액 비중 · 상위 5종">
        <StackBlock slices={byCard} format={format} />
        <Meters conc={conc} />
      </Section>

      <Section title="분류별 구성" sub="등급 · 작품 · 취득 경로">
        <MiniStack label="등급" slices={byGrade} format={format} />
        <MiniStack label="작품" slices={byGame} format={format} />
        <MiniStack label="취득" slices={bySource} format={format} />
        {bySeries.length > 1 && <MiniStack label="시리즈" slices={bySeries} format={format} />}
      </Section>

      {(movers.gainers.length > 0 || movers.losers.length > 0) && (
        <Section title="손익 상·하위" sub="등락률 기준 · 좌우 같은 척도">
          <Diverging movers={movers} format={format} />
        </Section>
      )}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--f1)', fontSize: 14, fontWeight: 800, color: INK, letterSpacing: 0.6 }}>
          {title}
        </h3>
        {sub && <span style={{ fontFamily: 'var(--f1)', fontSize: 11, color: MUTED }}>{sub}</span>}
      </div>
      <div
        style={{
          background: PANEL,
          border: `1px solid ${LINE}`,
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {children}
      </div>
    </section>
  );
}

/* ── 누적 가로바 + 직접 라벨 범례 ───────────────────────────────── */

const BAR_W = 320;
const BAR_H = 26;

function StackBlock({ slices, format }: { slices: VizSlice[]; format: (n: number) => string }) {
  const [hot, setHot] = useState<string | null>(null);
  const segs = stackLayout(slices, BAR_W, 2);
  const active = slices.find((s) => s.key === hot) ?? null;

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <svg width="100%" height={BAR_H} viewBox={`0 0 ${BAR_W} ${BAR_H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          {segs.map(({ slice, x, w }) => (
            <rect
              key={slice.key}
              x={x}
              y={0}
              width={w}
              height={BAR_H}
              rx={3}
              fill={slice.color}
              opacity={hot && hot !== slice.key ? 0.42 : 1}
              onMouseEnter={() => setHot(slice.key)}
              onMouseLeave={() => setHot(null)}
              style={{ cursor: 'default' }}
            >
              <title>{`${slice.label} · ${format(slice.value)} (${slice.pct.toFixed(1)}%)`}</title>
            </rect>
          ))}
        </svg>
        {active && (
          <div
            style={{
              marginTop: 8,
              fontFamily: 'var(--f1)',
              fontSize: 12,
              color: INK,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Swatch color={active.color} />
            {active.label} · {format(active.value)} ({active.pct.toFixed(1)}%)
          </div>
        )}
      </div>
      {/* 범례 = 직접 라벨. 색만으로 정체성을 전달하지 않는다. */}
      <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {slices.map((s) => (
          <li
            key={s.key}
            onMouseEnter={() => setHot(s.key)}
            onMouseLeave={() => setHot(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: hot && hot !== s.key ? 0.5 : 1 }}
          >
            <Swatch color={s.color} />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'var(--f1)',
                fontSize: 13,
                color: LABEL,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.label}
            </span>
            <span style={{ fontFamily: 'var(--f1)', fontSize: 13, fontWeight: 800, color: INK, flex: 'none' }}>
              {format(s.value)}
            </span>
            <span style={{ fontFamily: 'var(--f1)', fontSize: 12, color: MUTED, width: 44, textAlign: 'right', flex: 'none' }}>
              {s.pct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flex: 'none' }} />;
}

/* ── 분류별 미니 누적바 ─────────────────────────────────────────── */

const MINI_H = 12;

function MiniStack({ label, slices, format }: { label: string; slices: VizSlice[]; format: (n: number) => string }) {
  if (slices.length === 0) return null;
  const segs = stackLayout(slices, BAR_W, 2);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--f1)', fontSize: 12, fontWeight: 800, color: LABEL, letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontFamily: 'var(--f1)', fontSize: 11, color: MUTED }}>{slices.length}종</span>
      </div>
      <svg width="100%" height={MINI_H} viewBox={`0 0 ${BAR_W} ${MINI_H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {segs.map(({ slice, x, w }) => (
          <rect key={slice.key} x={x} y={0} width={w} height={MINI_H} rx={2} fill={slice.color}>
            <title>{`${slice.label} · ${format(slice.value)} (${slice.pct.toFixed(1)}%)`}</title>
          </rect>
        ))}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginTop: 7 }}>
        {slices.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--f1)', fontSize: 12, color: LABEL }}>
            <Swatch color={s.color} />
            {s.label}
            <em style={{ fontStyle: 'normal', color: MUTED }}>{s.pct.toFixed(0)}%</em>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── 집중도 미터 ────────────────────────────────────────────────── */

function Meters({ conc }: { conc: { top1: number; top3: number } }) {
  return (
    <div style={{ display: 'flex', gap: 14, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
      <Meter label="상위 1종 비중" pct={conc.top1} />
      <Meter label="상위 3종 비중" pct={conc.top3} />
    </div>
  );
}

function Meter({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 11, color: MUTED }}>{label}</div>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 18, fontWeight: 900, color: INK, marginTop: 3 }}>
        {clamped.toFixed(1)}%
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.08)', marginTop: 6, overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, height: '100%', background: VIZ_UP, borderRadius: 3 }} />
      </div>
    </div>
  );
}

/* ── 손익 발산형 바 ─────────────────────────────────────────────── */

function Diverging({
  movers,
  format,
}: {
  movers: ReturnType<typeof topMovers>;
  format: (n: number) => string;
}) {
  const rows = [...movers.gainers, ...movers.losers];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {rows.map(({ card, pct, ratio }) => {
        const up = pct >= 0;
        return (
          <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 96,
                flex: 'none',
                fontFamily: 'var(--f1)',
                fontSize: 12,
                color: LABEL,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={card.name}
            >
              {card.name}
            </span>
            {/* 0 기준선을 가운데 두고 좌(하락)/우(상승)로 뻗는다. */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', height: 14 }}>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                {!up && (
                  <div style={{ width: `${ratio * 100}%`, height: 10, background: VIZ_DOWN, borderRadius: '3px 0 0 3px' }} />
                )}
              </div>
              <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,.22)', flex: 'none' }} />
              <div style={{ flex: 1, display: 'flex' }}>
                {up && (
                  <div style={{ width: `${ratio * 100}%`, height: 10, background: VIZ_UP, borderRadius: '0 3px 3px 0' }} />
                )}
              </div>
            </div>
            <span
              style={{
                width: 58,
                flex: 'none',
                textAlign: 'right',
                fontFamily: 'var(--f1)',
                fontSize: 13,
                fontWeight: 800,
                color: up ? VIZ_UP : VIZ_DOWN,
              }}
            >
              {up ? '+' : ''}
              {pct.toFixed(1)}%
            </span>
            <span style={{ width: 62, flex: 'none', textAlign: 'right', fontFamily: 'var(--f1)', fontSize: 12, color: MUTED }}>
              {format(card.valueJpy)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
