import React, { useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { PixelText } from '@/components/PixelText';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { useCurrency } from '@/components/CurrencyProvider';

export interface ChartSeries {
  label: string;
  color: string;
  points: Array<[number, number]>;
}

interface Props {
  /** Single-series points (backwards-compat). When `series` is set this is ignored. */
  points?: Array<[number, number]>;
  /** Multi-series for overlay (e.g. singles + PSA10 on the same axes). */
  series?: ChartSeries[];
  unitLabel: string;
  rawCount: number;
  width?: number;
  height?: number;
}

const DAY_MS = 86_400_000;

/** Adaptive date axis label. Range-aware so the granularity matches the
 *  data span: hours when everything's on one day, MM.DD inside a year,
 *  YY.MM across years. */
function fmtDateAxis(ms: number, spanMs: number): string {
  const d = new Date(ms);
  if (spanMs < DAY_MS) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (spanMs < 365 * DAY_MS) {
    return `${month}.${day}`;
  }
  const yy = String(d.getFullYear()).slice(-2);
  return `${yy}.${month}`;
}

/** Adaptive price label — picks the unit so the label stays 3-4 chars wide
 *  regardless of card price magnitude (¥350 vs ¥850K vs ₩1.2M). */
function fmtPriceAxis(n: number, maxValue: number, sym: string): string {
  if (maxValue >= 1_000_000) {
    return `${sym}${(n / 1_000_000).toFixed(n >= 100_000_000 ? 0 : 1)}M`;
  }
  if (maxValue >= 10_000) {
    return `${sym}${Math.round(n / 1000)}K`;
  }
  return `${sym}${n.toLocaleString('en-US')}`;
}

function niceTicks(min: number, max: number, n = 4): number[] {
  if (!(max > min)) return [min];
  const range = max - min;
  const rough = range / (n - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(v);
  return out;
}

/** Snkrdunk price chart — SVG line + area, JPY Y axis, date X axis.
 *  Accepts either single-series `points` or multi-series `series` for
 *  overlay charts (e.g., singles vs PSA10). */
export function SnkrdunkPriceChart({
  points,
  series,
  unitLabel,
  rawCount,
  width = 320,
  height = 180,
}: Props) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  // 축·툴팁 가격도 통화 설정(엔/원)을 따른다 — 데이터는 JPY 원본, 표시만 환산.
  const { mode, rate } = useCurrency();
  const toDisp = (jpy: number) => (mode === 'krw' ? jpy * (rate > 0 ? rate : 9.5) : jpy);
  const sym = mode === 'krw' ? '₩' : '¥';
  // 터치 툴팁 — 손가락 X 위치(0~1, 플롯 영역 기준). 웹 MiniChart 호버와 동일 컨셉.
  const [layoutW, setLayoutW] = useState(0);
  const [touchRel, setTouchRel] = useState<number | null>(null);
  // Normalize to a series list. Single-series API maps to one red trend.
  const allSeries: ChartSeries[] = series && series.length > 0
    ? series.filter((s) => s.points.length >= 1)
    : points && points.length >= 1
    ? [{ label: '시세', color: tc.red, points }]
    : [];
  const renderable = allSeries.filter((s) => s.points.length >= 2);

  if (renderable.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center', backgroundColor: tc.pap2 }}>
        <PixelText variant={txt} size={9} color={tc.ink3}>
          시세 이력이 부족합니다
        </PixelText>
      </View>
    );
  }

  const PAD_L = 50;
  const PAD_R = 10;
  const PAD_T = 14;
  const PAD_B = renderable.length > 1 ? 36 : 28; // extra room for legend
  const innerW = width - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;

  const allXs = renderable.flatMap((s) => s.points.map((p) => p[0]));
  const allYs = renderable.flatMap((s) => s.points.map((p) => p[1]));
  const dataMinY = Math.min(...allYs);
  const dataMaxY = Math.max(...allYs);
  const yTicks = niceTicks(dataMinY, dataMaxY, 4);
  const minY = yTicks[0];
  const maxY = yTicks[yTicks.length - 1];
  const rangeY = maxY - minY || 1;
  const minX = Math.min(...allXs);
  const maxX = Math.max(...allXs);
  const rangeX = maxX - minX || 1;
  const xOf = (v: number) => PAD_L + ((v - minX) / rangeX) * innerW;
  const yOf = (v: number) => PAD_T + (1 - (v - minY) / rangeY) * innerH;

  const xTickValues = [0, 1 / 3, 2 / 3, 1].map((t) => minX + t * rangeX);

  // Per-series path strings.
  const seriesPaths = renderable.map((s) => {
    const linePath = s.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p[0]).toFixed(1)},${yOf(p[1]).toFixed(1)}`)
      .join(' ');
    const lastPt = s.points[s.points.length - 1];
    return {
      ...s,
      linePath,
      lastX: xOf(lastPt[0]),
      lastY: yOf(lastPt[1]),
    };
  });

  // 터치 위치 → 데이터 X → 시리즈별 최근접 포인트 (웹 MiniChart 호버 동일).
  const touchDataX = touchRel != null ? minX + touchRel * rangeX : null;
  const touchHits =
    touchDataX != null
      ? renderable.map((s) => {
          let best = s.points[0];
          for (const p of s.points) {
            if (Math.abs(p[0] - touchDataX) < Math.abs(best[0] - touchDataX)) best = p;
          }
          return { label: s.label, color: s.color, point: best };
        })
      : [];
  const anchor = touchHits[0]?.point ?? null; // 가이드선 기준 — 첫 시리즈 최근접점
  const anchorVX = anchor ? xOf(anchor[0]) : 0;
  const anchorLeftPx = layoutW > 0 ? (anchorVX / width) * layoutW : 0;
  const tipFlip = layoutW > 0 && anchorLeftPx > layoutW * 0.58;

  const pickTouch = (e: GestureResponderEvent) => {
    if (layoutW <= 0) return;
    const vx = (e.nativeEvent.locationX / layoutW) * width;
    setTouchRel(Math.max(0, Math.min(1, (vx - PAD_L) / innerW)));
  };

  return (
    <View>
      <View
        style={{ width: '100%', backgroundColor: tc.pap2 }}
        onLayout={(e) => setLayoutW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pickTouch}
        onResponderMove={pickTouch}
      >
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {yTicks.map((v) => {
            const y = yOf(v);
            return (
              <React.Fragment key={`y-${v}`}>
                <Line x1={PAD_L} y1={y} x2={width - PAD_R} y2={y} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
                <SvgText x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize={7} fill={tc.ink3}>
                  {fmtPriceAxis(toDisp(v), toDisp(maxY), sym)}
                </SvgText>
              </React.Fragment>
            );
          })}
          {xTickValues.map((tv, i) => {
            const x = xOf(tv);
            return (
              <React.Fragment key={`x-${i}`}>
                <Line
                  x1={x}
                  y1={PAD_T + innerH}
                  x2={x}
                  y2={PAD_T + innerH + 3}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={1}
                />
                <SvgText
                  x={x}
                  y={PAD_T + innerH + 12}
                  textAnchor={i === 0 ? 'start' : i === xTickValues.length - 1 ? 'end' : 'middle'}
                  fontSize={7}
                  fill={tc.ink3}
                >
                  {fmtDateAxis(tv, rangeX)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Plot each series as a line + end-point marker. Painted in
              order, so the LAST series wins on overlap. */}
          {seriesPaths.map((s, i) => (
            <React.Fragment key={`s-${i}`}>
              <Path d={s.linePath} stroke={s.color} strokeWidth={1.5} fill="none" />
              <Circle cx={s.lastX} cy={s.lastY} r={3} fill={s.color} />
            </React.Fragment>
          ))}

          {/* 터치 가이드선 + 데이터점 (웹 호버 동일) */}
          {anchor ? (
            <React.Fragment>
              <Line x1={anchorVX} y1={PAD_T} x2={anchorVX} y2={PAD_T + innerH} stroke={tc.ink3} strokeWidth={1} opacity={0.45} />
              {touchHits.map((h, i) => (
                <Circle key={`t-${i}`} cx={xOf(h.point[0])} cy={yOf(h.point[1])} r={4} fill={h.color} stroke={tc.white} strokeWidth={1.5} />
              ))}
            </React.Fragment>
          ) : null}

          <SvgText x={PAD_L} y={PAD_T - 4} textAnchor="start" fontSize={7} fill={tc.ink3}>
            {`가격 (${mode === 'krw' ? 'KRW' : 'JPY'})`}
          </SvgText>
          <SvgText x={width - PAD_R} y={height - 4} textAnchor="end" fontSize={7} fill={tc.ink3}>
            거래일
          </SvgText>

          {/* Legend — only when there are 2+ series. */}
          {renderable.length > 1
            ? seriesPaths.map((s, i) => {
                const x = PAD_L + i * 70;
                const y = height - 4;
                return (
                  <React.Fragment key={`legend-${i}`}>
                    <Line x1={x} y1={y - 3} x2={x + 12} y2={y - 3} stroke={s.color} strokeWidth={2} />
                    <SvgText x={x + 16} y={y} fontSize={7} fill={tc.ink3}>
                      {s.label}
                    </SvgText>
                  </React.Fragment>
                );
              })
            : null}
        </Svg>

        {/* 터치 툴팁 — 날짜 + 가격 (웹 호버 툴팁 동일) */}
        {anchor && layoutW > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 2,
              ...(tipFlip ? { right: layoutW - anchorLeftPx + 6 } : { left: anchorLeftPx + 6 }),
              backgroundColor: tc.ink,
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: 6,
            }}
          >
            <PixelText variant={txt} size={8} color={tc.white} style={{ opacity: 0.8, letterSpacing: 0.3 }}>
              {fmtDateAxis(anchor[0], rangeX)}
            </PixelText>
            {touchHits.map((h, i) => (
              <PixelText key={`tip-${i}`} variant={txt} size={10} weight="bold" color={tc.white} style={{ marginTop: 2 }}>
                {touchHits.length > 1 ? `${h.label} ` : ''}{sym}{Math.round(toDisp(h.point[1])).toLocaleString('ja-JP')}
              </PixelText>
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <PixelText variant={txt} size={8} color={tc.ink3}>
          기간: {fmtDateAxis(minX, rangeX)} ~ {fmtDateAxis(maxX, rangeX)} · {unitLabel} · 거래 {rawCount}건
        </PixelText>
        <PixelText variant={txt} size={8} color={tc.ink3}>
          최저 {sym}{Math.round(toDisp(dataMinY)).toLocaleString('ja-JP')} · 최고 {sym}{Math.round(toDisp(dataMaxY)).toLocaleString('ja-JP')}
        </PixelText>
      </View>
    </View>
  );
}
