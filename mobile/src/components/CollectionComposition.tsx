/**
 * 자산 구성 — 카드별 금액 비중(합계 100%) 도넛 + 리스트.
 * 웹 CollectionScreen cardWeights/donutSegments 와 동일 로직:
 * 평가액 = 등급 일치 시세(currentPriceJpy: PSA10/9/8→등급가, 타사→PSA10, 싱글→raw) × 수량,
 * 상위 8장 + 기타. 색 팔레트(SLICE)도 웹과 동일.
 */
import { useMemo } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { PixelText } from '@/components/PixelText';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import type { MyCardRow } from '@/lib/myApi';
import { shotSource } from '@/lib/shotMode';

interface Props {
  cards: MyCardRow[];
  priceMode: 'single' | 'psa10';
  format: (jpy: number) => string;
}

// 카드별 비중 도넛·막대 색 팔레트 — 웹 SLICE 동일.
const SLICE = ['#7C5CFC', '#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#EC4899', '#F97316'];

function cardName(c: MyCardRow): string {
  return c.snkrdunkName || c.nickname || '이름 미상';
}

/** 카드 한 장의 평가액(엔) — 웹 allRows.value 동일:
 *  등급 일치 currentPriceJpy(PSA10/9/8→등급가, 타사→PSA10, 싱글→raw) 우선. */
function rowValue(c: MyCardRow): number {
  const gradePrice =
    (c.currentPriceJpy ?? 0) > 0
      ? c.currentPriceJpy ?? 0
      : c.graded
        ? c.pricePsa10Jpy ?? 0
        : c.priceSingleJpy ?? c.snkrdunkMinPriceJpy ?? 0;
  const qty = Math.max(1, c.qty ?? 1);
  return gradePrice > 0 ? gradePrice * qty : 0;
}

interface Item {
  c: MyCardRow;
  value: number;
  qty: number;
  pct: number;
}

export function CollectionComposition({ cards, format }: Props) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();

  // 가격 비중(카드별) — 웹 cardWeights 동일: TOP8 + 기타.
  const weights = useMemo(() => {
    const priced = cards
      .map((c) => ({ c, value: rowValue(c), qty: Math.max(1, c.qty ?? 1) }))
      .filter((r) => r.value > 0);
    const total = priced.reduce((s, r) => s + r.value, 0);
    if (total <= 0) return { items: [] as Item[], restVal: 0, restCount: 0, restPct: 0 };
    const sorted = [...priced].sort((a, b) => b.value - a.value);
    const TOP = 8;
    const items: Item[] = sorted.slice(0, TOP).map((r) => ({ ...r, pct: (r.value / total) * 100 }));
    const rest = sorted.slice(TOP);
    const restVal = rest.reduce((s, r) => s + r.value, 0);
    return { items, restVal, restCount: rest.length, restPct: (restVal / total) * 100 };
  }, [cards]);

  if (weights.items.length === 0) return null;

  const segments = [
    ...weights.items.map((it, i) => ({ key: String(it.c.id), color: SLICE[i] ?? tc.ink3, pct: it.pct })),
    ...(weights.restCount > 0 ? [{ key: '_rest', color: tc.ink3, pct: weights.restPct }] : []),
  ];

  return (
    <View style={{ paddingHorizontal: space.gap, marginBottom: space.cg }}>
      <PixelText variant="ko" size={15} weight="bold" color={tc.ink} style={{ marginBottom: 10 }}>
        자산 구성
      </PixelText>
      <View style={{ backgroundColor: tc.white, borderColor: tc.pap3, borderWidth: 1, borderRadius: 14 }}>
        <View style={{ padding: 16 }}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Donut segments={segments} track={tc.pap3} />
          </View>

          <PixelText variant="ko" size={12} weight="bold" color={tc.ink} style={{ marginBottom: 12 }}>
            카드별 비중
          </PixelText>
          <View style={{ gap: 12 }}>
            {weights.items.map((it, i) => {
              const img = it.c.snkrdunkImageUrl || it.c.photoUrl || null;
              const color = SLICE[i] ?? tc.ink3;
              return (
                <View key={it.c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 5, overflow: 'hidden', backgroundColor: tc.pap2, alignItems: 'center', justifyContent: 'center' }}>
                    {img ? (
                      <Image source={shotSource(img)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <PixelText variant={txt} size={14}>🃏</PixelText>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <PixelText variant="ko" size={11} weight="bold" color={tc.ink} numberOfLines={1} style={{ flex: 1 }}>
                        {cardName(it.c)}
                      </PixelText>
                      <PixelText variant={txt} size={11} weight="bold" color={tc.ink}>
                        {it.pct.toFixed(1)}%
                      </PixelText>
                    </View>
                    {/* 비중 막대 */}
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: tc.pap3, overflow: 'hidden', marginTop: 5 }}>
                      <View style={{ width: `${Math.max(2, it.pct)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
                    </View>
                    <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 4 }}>
                      {format(it.value)}{it.qty > 1 ? ` · ${it.qty}장` : ''}
                    </PixelText>
                  </View>
                </View>
              );
            })}
            {weights.restCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 5, backgroundColor: tc.pap2, alignItems: 'center', justifyContent: 'center' }}>
                  <PixelText variant={txt} size={12} color={tc.ink3}>＋</PixelText>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <PixelText variant="ko" size={11} weight="bold" color={tc.ink3} style={{ flex: 1 }}>
                      기타 {weights.restCount}장
                    </PixelText>
                    <PixelText variant={txt} size={11} weight="bold" color={tc.ink3}>
                      {weights.restPct.toFixed(1)}%
                    </PixelText>
                  </View>
                  <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 4 }}>
                    {format(weights.restVal)}
                  </PixelText>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

/** 자산 구성 도넛 — segments[].pct 합이 100 가정(아니어도 비율대로). */
function Donut({ segments, track }: { segments: Array<{ key: string; color: string; pct: number }>; track: string }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <Svg width={104} height={104} viewBox="0 0 118 118">
      <Circle cx={59} cy={59} r={R} fill="none" stroke={track} strokeWidth={15} />
      <G rotation={-90} origin="59, 59">
        {segments.map((s) => {
          const len = (s.pct / 100) * C;
          const off = -(acc / 100) * C;
          acc += s.pct;
          return (
            <Circle
              key={s.key}
              cx={59}
              cy={59}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={15}
              strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
              strokeDashoffset={off.toFixed(2)}
            />
          );
        })}
      </G>
    </Svg>
  );
}
