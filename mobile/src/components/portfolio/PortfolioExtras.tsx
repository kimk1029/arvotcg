import { useMemo, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
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
} from '../../../../shared/portfolioViz';
import { multiLineGeometry, type MarketIndexPoint, type MarketIndexSeries } from '../../../../shared/marketIndex';

/**
 * 포트폴리오 확장 인포그래픽 — 앱. 웹 src/components/portfolio/PortfolioExtras.tsx 와 페어.
 * 집계·기하는 정본(shared). 섹션 구성·순서·라벨은 웹과 동일.
 */

const LABEL = 'rgba(255,255,255,0.55)';
const MUTED = 'rgba(255,255,255,0.34)';
const INK = 'rgba(255,255,255,0.92)';
const PANEL = 'rgba(255,255,255,0.04)';
const LINE = 'rgba(255,255,255,0.08)';

function ts(size: number, weight: '400' | '700' | '800' | '900', color: string, ff?: string) {
  return { fontSize: size, fontWeight: weight, color, fontFamily: ff } as const;
}
function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

export function Section({ title, sub, children, ff }: { title: string; sub?: string; children: React.ReactNode; ff?: string }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <Text style={ts(14, '800', INK, ff)}>{title}</Text>
        {sub ? <Text style={ts(11, '400', MUTED, ff)} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <View style={{ backgroundColor: PANEL, borderWidth: 1, borderColor: LINE, borderRadius: 12, padding: 14, gap: 12 }}>{children}</View>
    </View>
  );
}

/* ── 내 자산 vs 시장 ─────────────────────────────────────────────── */

const CW = 320;
const CH = 150;
const COMPARE_COLORS: Record<string, string> = { mine: '#FFD23F', pokemon: VIZ_SERIES[0], onepiece: VIZ_SERIES[1] };

export function CompareChart({
  history,
  market,
  format,
  ff,
}: {
  history: Array<{ date: string; totalJpy: number }>;
  market: MarketIndexSeries[];
  format: (jpy: number) => string;
  ff?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [w, setW] = useState(CW);
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
    return (
      <Text style={[ts(12, '400', MUTED, ff), { textAlign: 'center', paddingVertical: 18 }]}>일별 자산 데이터가 2일 이상 쌓이면 시장과 비교해 드려요</Text>
    );
  }
  const pick = (x: number) => {
    const xs = geo.lines[0]?.xy ?? [];
    const px = (x / w) * CW;
    let best = 0;
    let bd = Infinity;
    xs.forEach(([qx], i) => { const d = Math.abs(qx - px); if (d < bd) { bd = d; best = i; } });
    setHover(xs.length ? best : null);
  };
  const hDate = hover != null ? lines[0].points[hover]?.date : null;
  const valueAt = (pts: MarketIndexPoint[], date: string) => {
    let v: number | null = null;
    for (const p of pts) { if (p.date <= date) v = p.value; else break; }
    return v;
  };
  const hx = hover != null ? geo.lines[0].xy[hover]?.[0] : null;
  const y100 = geo.max > geo.min ? 6 + (1 - (100 - geo.min) / (geo.max - geo.min)) * (CH - 12) : null;
  const tipLeft = hx != null ? (hx / CW) * w : 0;

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8 }}>
        {lines.map((l) => {
          const last = l.points[l.points.length - 1].value - 100;
          return (
            <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: COMPARE_COLORS[l.key] ?? VIZ_OTHER }} />
              <Text style={ts(12, '400', LABEL, ff)}>{l.label}</Text>
              <Text style={ts(12, '800', last >= 0 ? VIZ_UP : VIZ_DOWN, ff)}>{pct(last)}</Text>
            </View>
          );
        })}
      </View>
      <View
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width || CW)}
        style={{ position: 'relative' }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        onResponderRelease={() => setHover(null)}
        onResponderTerminate={() => setHover(null)}
      >
        {hDate ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, zIndex: 2, left: Math.max(0, Math.min(w - 150, tipLeft - 75)), width: 150, backgroundColor: 'rgba(8,13,24,0.94)', borderWidth: 1, borderColor: LINE, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 9, gap: 2 }}>
            <Text style={ts(10, '400', MUTED, ff)}>{hDate}</Text>
            {lines.map((l) => {
              const v = valueAt(l.points, hDate);
              return (
                <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COMPARE_COLORS[l.key] ?? VIZ_OTHER }} />
                  <Text style={ts(11, '800', INK, ff)}>
                    {l.label} {v == null ? '—' : pct(v - 100)}
                    {l.key === 'mine' && hover != null && history[hover] ? <Text style={ts(10, '400', MUTED, ff)}> · {format(history[hover].totalJpy)}</Text> : null}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
        <Svg width="100%" height={CH} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none">
          {y100 != null ? <Line x1={0} x2={CW} y1={y100} y2={y100} stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
          {geo.lines.map((l) => (
            <Path key={l.key} d={l.path} fill="none" stroke={COMPARE_COLORS[l.key] ?? VIZ_OTHER} strokeWidth={l.key === 'mine' ? 2.5 : 2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hx != null ? <Line x1={hx} x2={hx} y1={0} y2={CH} stroke="rgba(255,255,255,0.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={ts(10, '400', MUTED, ff)}>{lines[0].points[0].date}</Text>
          <Text style={ts(10, '400', MUTED, ff)}>구간 시작 = 100</Text>
          <Text style={ts(10, '400', MUTED, ff)}>{lines[0].points[lines[0].points.length - 1].date}</Text>
        </View>
      </View>
    </View>
  );
}

/* ── 인사이트 타일 ──────────────────────────────────────────────── */

export function InsightTiles({
  cards,
  upside,
  history,
  format,
  ff,
}: {
  cards: VizCard[];
  upside: GradingUpside | null;
  history: Array<{ date: string; totalJpy: number }>;
  format: (jpy: number) => string;
  ff?: string;
}) {
  const ws = winStats(cards);
  const ath = history.reduce<{ date: string; totalJpy: number } | null>((a, h) => (!a || h.totalJpy > a.totalJpy ? h : a), null);
  const last = history[history.length - 1];
  const fromAth = ath && last && ath.totalJpy > 0 ? ((last.totalJpy - ath.totalJpy) / ath.totalJpy) * 100 : null;
  const tiles: Array<{ label: string; value: string; sub?: string; color?: string }> = [
    { label: '승률', value: ws ? `${ws.winRate.toFixed(0)}%` : '—', sub: ws ? `${ws.n}종 중 상승` : undefined, color: ws && ws.winRate >= 50 ? VIZ_UP : undefined },
    { label: '평균 손익률', value: ws ? pct(ws.avgPct) : '—', sub: ws ? `중앙값 ${pct(ws.medianPct)}` : undefined, color: ws ? (ws.avgPct >= 0 ? VIZ_UP : VIZ_DOWN) : undefined },
    { label: 'PSA10 환산 업사이드', value: upside ? pct(upside.pct, 0) : '—', sub: upside ? `${upside.n}종 · ${format(upside.diffJpy)}` : '비등급 카드 없음', color: upside ? '#A78BFA' : undefined },
    { label: '최고 평가일 대비', value: fromAth != null ? pct(fromAth) : '—', sub: ath ? `${ath.date} ${format(ath.totalJpy)}` : undefined, color: fromAth != null ? (fromAth >= 0 ? VIZ_UP : VIZ_DOWN) : undefined },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {tiles.map((t) => (
        <View key={t.label} style={{ width: '48.5%', backgroundColor: PANEL, borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Text style={ts(11, '400', MUTED, ff)} numberOfLines={1}>{t.label}</Text>
          <Text style={[ts(20, '900', t.color ?? INK, ff), { marginTop: 4, letterSpacing: -0.3 }]} numberOfLines={1}>{t.value}</Text>
          {t.sub ? <Text style={[ts(10, '400', LABEL, ff), { marginTop: 3 }]} numberOfLines={1}>{t.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/* ── 자산 구성 링 ───────────────────────────────────────────────── */

export function RingComposition({ slices, total, format, ff }: { slices: VizSlice[]; total: number; format: (jpy: number) => string; ff?: string }) {
  const arcs = useMemo(() => ringArcs(slices, 60, 60, 56, 38, 2), [slices]);
  const [hot, setHot] = useState<string | null>(null);
  const active = slices.find((s) => s.key === hot);
  if (arcs.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        {arcs.map(({ slice, d }) => (
          <Path key={slice.key} d={d} fill={slice.color} opacity={hot && hot !== slice.key ? 0.4 : 1} onPress={() => setHot((p) => (p === slice.key ? null : slice.key))} />
        ))}
        <SvgText x={60} y={56} textAnchor="middle" fontSize={9} fill={MUTED}>{active ? active.label.slice(0, 10) : '총 평가액'}</SvgText>
        <SvgText x={60} y={71} textAnchor="middle" fontSize={12} fontWeight="900" fill={INK}>{active ? `${active.pct.toFixed(1)}%` : format(total)}</SvgText>
      </Svg>
      <View style={{ flex: 1, gap: 6 }}>
        {slices.map((s) => (
          <Pressable key={s.key} onPress={() => setHot((p) => (p === s.key ? null : s.key))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: hot && hot !== s.key ? 0.5 : 1 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
            <Text style={[ts(12, '400', LABEL, ff), { flex: 1 }]} numberOfLines={1}>{s.label}</Text>
            <Text style={ts(12, '800', INK, ff)}>{s.pct.toFixed(1)}%</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ── 히스토그램 (세로 막대) ────────────────────────────────────── */

export function BarHistogram({ title, bars, unit = '종', ff }: { title: string; bars: VizBar[]; unit?: string; ff?: string }) {
  const total = bars.reduce((a, b) => a + b.value, 0);
  return (
    <View style={{ flex: 1, minWidth: 140 }}>
      {title ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <Text style={ts(12, '800', LABEL, ff)}>{title}</Text>
          <Text style={ts(11, '400', MUTED, ff)}>{total}{unit}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 84 }}>
        {bars.map((b) => (
          <View key={b.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
            <Text style={ts(10, '800', b.value > 0 ? INK : MUTED, ff)}>{b.value > 0 ? String(b.value) : ''}</Text>
            <View style={{ width: '100%', height: Math.max(b.value > 0 ? 4 : 2, b.ratio * 60), backgroundColor: b.value > 0 ? b.color : 'rgba(255,255,255,0.08)', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
        {bars.map((b) => (
          <Text key={b.key} style={[ts(9, '400', MUTED, ff), { flex: 1, textAlign: 'center' }]} numberOfLines={1}>{b.label}</Text>
        ))}
      </View>
    </View>
  );
}

export function Histograms({ cards, ff }: { cards: VizCard[]; ff?: string }) {
  const p = useMemo(() => profitHistogram(cards), [cards]);
  const v = useMemo(() => valueHistogram(cards), [cards]);
  return (
    <View style={{ gap: 18 }}>
      <BarHistogram title="손익률 분포" bars={p} ff={ff} />
      <BarHistogram title="가격대 분포 (¥)" bars={v} ff={ff} />
    </View>
  );
}

/* ── 월별 취득 ─────────────────────────────────────────────────── */

export function AcquisitionBars({ rows, format, ff }: { rows: VizAcquisition[]; format: (jpy: number) => string; ff?: string }) {
  const bars = useMemo(() => acquisitionTimeline(rows, 12), [rows]);
  if (bars.length === 0) return null;
  const spend = bars.reduce((a, b) => a + (b.extra ?? 0), 0);
  const n = bars.reduce((a, b) => a + b.value, 0);
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Text style={ts(12, '800', LABEL, ff)}>최근 12개월 취득</Text>
        <Text style={ts(11, '400', MUTED, ff)}>{n}장 · {format(spend)}</Text>
      </View>
      <BarHistogram title="" bars={bars} unit="장" ff={ff} />
    </View>
  );
}

/* ── 그레이딩 잠재가치 ─────────────────────────────────────────── */

export function GradingUpsideCard({ upside, format, ff }: { upside: GradingUpside | null; format: (jpy: number) => string; ff?: string }) {
  if (!upside) return null;
  const max = Math.max(upside.rawJpy, upside.psa10Jpy, 1);
  const Row = ({ label, v, color }: { label: string; v: number; color: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={[ts(11, '400', LABEL, ff), { width: 70 }]}>{label}</Text>
      <View style={{ flex: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${(v / max) * 100}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text style={[ts(12, '800', INK, ff), { width: 84, textAlign: 'right' }]} numberOfLines={1}>{format(v)}</Text>
    </View>
  );
  return (
    <View style={{ gap: 8 }}>
      <Row label="현재 (RAW)" v={upside.rawJpy} color={VIZ_SERIES[2]} />
      <Row label="PSA10 환산" v={upside.psa10Jpy} color="#A78BFA" />
      <Text style={[ts(11, '400', MUTED, ff), { lineHeight: 16 }]}>
        비등급 {upside.n}종을 전부 PSA10 으로 그레이딩했을 때의 시세 합 — 차이{' '}
        <Text style={ts(11, '800', upside.diffJpy >= 0 ? VIZ_UP : VIZ_DOWN, ff)}>{pct(upside.pct, 0)} ({format(upside.diffJpy)})</Text>. 그레이딩 비용·등급 실패 위험은 반영하지 않은 참고값.
      </Text>
    </View>
  );
}

/** 편의: 카드 배열에서 upside 입력 만들기(웹·앱 동일 매핑). */
export function upsideFromCards(rows: Array<{ graded: boolean; qty: number; priceSingleJpy: number; pricePsa10Jpy: number }>): GradingUpside | null {
  return gradingUpside(rows.map((r) => ({ graded: r.graded, qty: r.qty, singleJpy: r.priceSingleJpy, psa10Jpy: r.pricePsa10Jpy })));
}
