import { useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
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
} from '../../../../shared/portfolioViz';

/**
 * 포트폴리오 인포그래픽 — 앱. 웹 src/components/portfolio/PortfolioInfographics.tsx 와 페어.
 * 집계·색·배치는 전부 정본 shared/portfolioViz.ts. 여기는 그리기만 한다.
 *
 * 포트폴리오는 전 테마 공통 다크 보드라 색을 테마 토큰이 아니라 보드 기준 고정값으로
 * 쓴다(웹 .cv-pf-board 와 동일 조건) — 팔레트도 그 표면에서 검증됐다.
 */

interface Props {
  cards: VizCard[];
  format: (jpy: number) => string;
  /** 픽셀 테마는 도트 폰트, 클린/다크는 시스템 폰트를 쓰도록 상위에서 전달. */
  fontFamily?: string;
}

const LABEL = 'rgba(255,255,255,0.55)';
const MUTED = 'rgba(255,255,255,0.34)';
const INK = 'rgba(255,255,255,0.92)';
const PANEL = 'rgba(255,255,255,0.04)';
const LINE = 'rgba(255,255,255,0.08)';

const BAR_W = 320;
const BAR_H = 26;
const MINI_H = 12;

export function PortfolioInfographics({ cards, format, fontFamily }: Props) {
  const byCard = compositionByCard(cards, 5);
  const byGrade = compositionByGrade(cards, 4);
  const byGame = compositionByGame(cards, 4);
  const bySource = compositionBySource(cards);
  const bySeries = compositionBySeries(cards, 5);
  const movers = topMovers(cards, 5);
  const conc = concentration(cards);

  if (byCard.length === 0) return null;
  const ff = fontFamily;

  return (
    <View style={{ gap: 18 }}>
      <Section title="자산 구성" sub="평가액 비중 · 상위 5종" ff={ff}>
        <StackBlock slices={byCard} format={format} ff={ff} />
        <Meters conc={conc} ff={ff} />
      </Section>

      <Section title="분류별 구성" sub="등급 · 작품 · 취득 경로" ff={ff}>
        <MiniStack label="등급" slices={byGrade} ff={ff} />
        <MiniStack label="작품" slices={byGame} ff={ff} />
        <MiniStack label="취득" slices={bySource} ff={ff} />
        {bySeries.length > 1 ? <MiniStack label="시리즈" slices={bySeries} ff={ff} /> : null}
      </Section>

      {movers.gainers.length > 0 || movers.losers.length > 0 ? (
        <Section title="손익 상·하위" sub="등락률 기준 · 좌우 같은 척도" ff={ff}>
          <Diverging movers={movers} format={format} ff={ff} />
        </Section>
      ) : null}
    </View>
  );
}

function ts(size: number, weight: '400' | '700' | '800' | '900', color: string, ff?: string) {
  return { fontSize: size, fontWeight: weight, color, fontFamily: ff } as const;
}

function Section({
  title,
  sub,
  ff,
  children,
}: {
  title: string;
  sub?: string;
  ff?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <Text style={ts(12, '800', INK, ff)}>{title}</Text>
        {sub ? <Text style={ts(9, '400', MUTED, ff)}>{sub}</Text> : null}
      </View>
      <View
        style={{
          backgroundColor: PANEL,
          borderWidth: 1,
          borderColor: LINE,
          borderRadius: 12,
          padding: 14,
          gap: 12,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Swatch({ color }: { color: string }) {
  return <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />;
}

/* ── 누적 가로바 + 직접 라벨 범례 ───────────────────────────────── */

function StackBlock({ slices, format, ff }: { slices: VizSlice[]; format: (n: number) => string; ff?: string }) {
  const [hot, setHot] = useState<string | null>(null);
  const segs = stackLayout(slices, BAR_W, 2);
  const active = slices.find((s) => s.key === hot) ?? null;

  return (
    <View>
      <Svg width="100%" height={BAR_H} viewBox={`0 0 ${BAR_W} ${BAR_H}`} preserveAspectRatio="none">
        {segs.map(({ slice, x, w }) => (
          <Rect
            key={slice.key}
            x={x}
            y={0}
            width={w}
            height={BAR_H}
            rx={3}
            fill={slice.color}
            opacity={hot && hot !== slice.key ? 0.42 : 1}
            onPress={() => setHot((p) => (p === slice.key ? null : slice.key))}
          />
        ))}
      </Svg>
      {active ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Swatch color={active.color} />
          <Text style={ts(10, '700', INK, ff)} numberOfLines={1}>
            {active.label} · {format(active.value)} ({active.pct.toFixed(1)}%)
          </Text>
        </View>
      ) : null}
      {/* 범례 = 직접 라벨. 색만으로 정체성을 전달하지 않는다. */}
      <View style={{ gap: 7, marginTop: 12 }}>
        {slices.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setHot((p) => (p === s.key ? null : s.key))}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              opacity: hot && hot !== s.key ? 0.5 : 1,
            }}
          >
            <Swatch color={s.color} />
            <Text style={[ts(11, '400', LABEL, ff), { flex: 1 }]} numberOfLines={1}>
              {s.label}
            </Text>
            <Text style={ts(11, '800', INK, ff)}>{format(s.value)}</Text>
            <Text style={[ts(10, '400', MUTED, ff), { width: 44, textAlign: 'right' }]}>
              {s.pct.toFixed(1)}%
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ── 분류별 미니 누적바 ─────────────────────────────────────────── */

function MiniStack({ label, slices, ff }: { label: string; slices: VizSlice[]; ff?: string }) {
  if (slices.length === 0) return null;
  const segs = stackLayout(slices, BAR_W, 2);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={ts(10, '800', LABEL, ff)}>{label}</Text>
        <Text style={ts(9, '400', MUTED, ff)}>{slices.length}종</Text>
      </View>
      <Svg width="100%" height={MINI_H} viewBox={`0 0 ${BAR_W} ${MINI_H}`} preserveAspectRatio="none">
        {segs.map(({ slice, x, w }) => (
          <Rect key={slice.key} x={x} y={0} width={w} height={MINI_H} rx={2} fill={slice.color} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
        {slices.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 7 }}>
            <Swatch color={s.color} />
            <Text style={ts(10, '400', LABEL, ff)}>{s.label}</Text>
            <Text style={ts(10, '400', MUTED, ff)}>{s.pct.toFixed(0)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── 집중도 미터 ────────────────────────────────────────────────── */

function Meters({ conc, ff }: { conc: { top1: number; top3: number }; ff?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 12 }}>
      <Meter label="상위 1종 비중" pct={conc.top1} ff={ff} />
      <Meter label="상위 3종 비중" pct={conc.top3} ff={ff} />
    </View>
  );
}

function Meter({ label, pct, ff }: { label: string; pct: number; ff?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ flex: 1 }}>
      <Text style={ts(9, '400', MUTED, ff)}>{label}</Text>
      <Text style={[ts(15, '900', INK, ff), { marginTop: 3 }]}>{clamped.toFixed(1)}%</Text>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 6, overflow: 'hidden' }}>
        <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: VIZ_UP, borderRadius: 3 }} />
      </View>
    </View>
  );
}

/* ── 손익 발산형 바 ─────────────────────────────────────────────── */

function Diverging({
  movers,
  format,
  ff,
}: {
  movers: ReturnType<typeof topMovers>;
  format: (n: number) => string;
  ff?: string;
}) {
  const rows = [...movers.gainers, ...movers.losers];
  return (
    <View style={{ gap: 9 }}>
      {rows.map(({ card, pct, ratio }) => {
        const up = pct >= 0;
        return (
          <View key={card.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[ts(10, '400', LABEL, ff), { width: 84 }]} numberOfLines={1}>
              {card.name}
            </Text>
            {/* 0 기준선을 가운데 두고 좌(하락)/우(상승)로 뻗는다. */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 14 }}>
              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
                {!up ? (
                  <View
                    style={{
                      width: `${ratio * 100}%`,
                      height: 10,
                      backgroundColor: VIZ_DOWN,
                      borderTopLeftRadius: 3,
                      borderBottomLeftRadius: 3,
                    }}
                  />
                ) : null}
              </View>
              <View style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              <View style={{ flex: 1, flexDirection: 'row' }}>
                {up ? (
                  <View
                    style={{
                      width: `${ratio * 100}%`,
                      height: 10,
                      backgroundColor: VIZ_UP,
                      borderTopRightRadius: 3,
                      borderBottomRightRadius: 3,
                    }}
                  />
                ) : null}
              </View>
            </View>
            <Text style={[ts(11, '800', up ? VIZ_UP : VIZ_DOWN, ff), { width: 54, textAlign: 'right' }]}>
              {up ? '+' : ''}
              {pct.toFixed(1)}%
            </Text>
            <Text style={[ts(10, '400', MUTED, ff), { width: 58, textAlign: 'right' }]} numberOfLines={1}>
              {format(card.valueJpy)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
