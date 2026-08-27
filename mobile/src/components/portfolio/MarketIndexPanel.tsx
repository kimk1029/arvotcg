import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  MARKET_INDEX_RANGES,
  lineGeometry,
  nearestIndex,
  pctChangeOver,
  sliceRange,
  type MarketIndexSeries,
} from '../../../../shared/marketIndex';
import { VIZ_DOWN, VIZ_SERIES, VIZ_UP } from '../../../../shared/portfolioViz';

/**
 * 시장 지표(TCG 인덱스) 패널 — 앱. 웹 src/components/portfolio/MarketIndexPanel.tsx 와 페어.
 * 데이터는 /api/market-index (포켓몬 = S&Poké 500 외부, 원피스 = ARVO OP200 서버 계산).
 * 지수별 소형 다중 차트 + 공유 기간 탭 + 터치 크로스헤어. 기하는 shared lineGeometry 정본.
 */

interface Props {
  series: MarketIndexSeries[];
  fontFamily?: string;
}

const LABEL = 'rgba(255,255,255,0.55)';
const MUTED = 'rgba(255,255,255,0.34)';
const INK = 'rgba(255,255,255,0.92)';
const PANEL = 'rgba(255,255,255,0.04)';
const LINE = 'rgba(255,255,255,0.08)';

const SERIES_COLOR: Record<string, string> = {
  pokemon: VIZ_SERIES[0],
  onepiece: VIZ_SERIES[1],
};

const W = 320;
const H = 120;

function ts(size: number, weight: '400' | '700' | '800' | '900', color: string, ff?: string) {
  return { fontSize: size, fontWeight: weight, color, fontFamily: ff } as const;
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function fmtIdx(v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function MarketIndexPanel({ series, fontFamily }: Props) {
  const [rangeIdx, setRangeIdx] = useState(2); // 6개월
  if (series.length === 0) return null;
  const days = MARKET_INDEX_RANGES[rangeIdx].days;
  const ff = fontFamily;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 }}>
          <Text style={ts(14, '800', INK, ff)}>시장 지표</Text>
          <Text style={ts(11, '400', MUTED, ff)} numberOfLines={1}>
            TCG 전체 시장 인덱스
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: 3 }}>
          {MARKET_INDEX_RANGES.map((r, i) => {
            const on = i === rangeIdx;
            return (
              <Pressable
                key={r.days}
                onPress={() => setRangeIdx(i)}
                hitSlop={4}
                style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: on ? 'rgba(255,255,255,0.16)' : 'transparent' }}
              >
                <Text style={ts(11, '800', on ? INK : MUTED, ff)}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 12 }}>
        {series.map((s) => (
          <IndexCard key={s.key} s={s} days={days} ff={ff} />
        ))}
      </View>
    </View>
  );
}

function Chip({ label, v, ff }: { label: string; v: number | null; ff?: string }) {
  const c = v == null ? MUTED : v >= 0 ? VIZ_UP : VIZ_DOWN;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <Text style={ts(10, '400', MUTED, ff)}>{label}</Text>
      <Text style={ts(12, '800', c, ff)}>{fmtPct(v)}</Text>
    </View>
  );
}

function IndexCard({ s, days, ff }: { s: MarketIndexSeries; days: number; ff?: string }) {
  const color = SERIES_COLOR[s.key] ?? VIZ_SERIES[0];
  const pts = useMemo(() => sliceRange(s.points, days), [s.points, days]);
  const geo = useMemo(() => lineGeometry(pts, W, H, 6), [pts]);
  const rangePct = pctChangeOver(pts, days > 0 ? days : 100_000);
  const [active, setActive] = useState<number | null>(null);
  const [chartW, setChartW] = useState(W);

  const onLayout = (e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width || W);
  const pick = (x: number) => setActive(nearestIndex(geo, x / chartW, W));

  const ap = active != null ? pts[active] : null;
  const aPrev = active != null && active > 0 ? pts[active - 1] : null;
  const aPct = ap && aPrev && aPrev.value > 0 ? ((ap.value - aPrev.value) / aPrev.value) * 100 : null;
  const gid = `mi-${s.key}`;
  const tipLeft = active != null && geo.xy[active] ? (geo.xy[active][0] / W) * chartW : 0;

  return (
    <View style={{ backgroundColor: PANEL, borderWidth: 1, borderColor: LINE, borderRadius: 12, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
          <Text style={ts(13, '800', INK, ff)}>{s.label}</Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999 }}>
            <Text style={ts(10, '800', INK, ff)}>{s.indexName}</Text>
          </View>
        </View>
        <Text style={ts(10, '400', MUTED, ff)}>{s.asOf} 기준</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <Text style={[ts(26, '900', INK, ff), { letterSpacing: -0.5 }]}>{fmtIdx(s.value)}</Text>
        <View style={{ flexDirection: 'row', gap: 12, paddingBottom: 3, flexWrap: 'wrap' }}>
          <Chip label="1일" v={s.change1d} ff={ff} />
          <Chip label="7일" v={s.change7d} ff={ff} />
          <Chip label="30일" v={s.change30d} ff={ff} />
          <Chip label="기간" v={rangePct} ff={ff} />
        </View>
      </View>

      <View
        onLayout={onLayout}
        style={{ marginTop: 10, position: 'relative' }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
      >
        {ap ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, zIndex: 2,
              left: Math.max(0, Math.min(chartW - 120, tipLeft - 60)), width: 120,
              backgroundColor: 'rgba(8,13,24,0.94)', borderWidth: 1, borderColor: LINE, borderRadius: 8,
              paddingVertical: 6, paddingHorizontal: 9, alignItems: 'center',
            }}
          >
            <Text style={ts(10, '400', MUTED, ff)}>{ap.date}</Text>
            <Text style={ts(13, '900', INK, ff)}>{fmtIdx(ap.value)}</Text>
            {aPct != null ? <Text style={ts(11, '800', aPct >= 0 ? VIZ_UP : VIZ_DOWN, ff)}>{fmtPct(aPct)}</Text> : null}
          </View>
        ) : null}
        {/* 명시 높이 — RN Fabric 안드로이드에서 SVG 높이 NaN 측정 회피 */}
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <Line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          ))}
          {geo.areaPath ? <Path d={geo.areaPath} fill={`url(#${gid})`} /> : null}
          {geo.linePath ? <Path d={geo.linePath} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /> : null}
          {ap && active != null ? (
            <>
              <Line x1={geo.xy[active][0]} x2={geo.xy[active][0]} y1={0} y2={H} stroke="rgba(255,255,255,0.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <Circle cx={geo.xy[active][0]} cy={geo.xy[active][1]} r={4} fill={color} stroke="#0C1426" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </>
          ) : null}
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={ts(10, '400', MUTED, ff)}>{pts[0]?.date ?? ''}</Text>
          <Text style={ts(10, '400', MUTED, ff)}>{pts[pts.length - 1]?.date ?? ''}</Text>
        </View>
      </View>

      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE, gap: 4 }}>
        <Text style={ts(10, '400', LABEL, ff)}>{s.basketLabel} · 기준일 = 1,000</Text>
        <Pressable onPress={() => Linking.openURL(s.sourceUrl).catch(() => undefined)} hitSlop={4}>
          <Text style={[ts(10, '400', MUTED, ff), { textDecorationLine: 'underline' }]}>{s.source}</Text>
        </Pressable>
        {s.breadth ? (
          <Text style={ts(10, '400', MUTED, ff)}>
            구성 종목 전일 대비 — 상승 <Text style={ts(10, '800', VIZ_UP, ff)}>{s.breadth.advancing}</Text> · 하락{' '}
            <Text style={ts(10, '800', VIZ_DOWN, ff)}>{s.breadth.declining}</Text> · 보합 {s.breadth.unchanged}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
