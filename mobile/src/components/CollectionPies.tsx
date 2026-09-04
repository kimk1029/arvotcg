/**
 * 내 자산 '자산 구성' — 카드 종류(작품)별 · 등급별 평가액 비중 파이차트 2개.
 *
 * 집계·기하·색은 전부 정본 /shared/portfolioViz.ts (compositionByGame /
 * compositionByGrade / pieSlices / VIZ_SERIES). 웹 src/components/portfolio/CollectionPies 와
 * 페어 — 두 화면이 같은 숫자·같은 배치를 그린다.
 *
 * 색만으로 항목을 구분하지 않는다: 조각마다 범례에 색칩 + 이름 + 비중(%) + 금액을
 * 직접 라벨로 붙인다(팔레트 대비 WARN 슬롯의 완화 조건).
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { PixelText } from '@/components/PixelText';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import type { MyCardRow } from '@/lib/myApi';
import { parseCardStatics } from '../../../shared/cardStatics';
import {
  compositionByGame,
  compositionByGrade,
  pieSlices,
  type VizCard,
  type VizSlice,
} from '../../../shared/portfolioViz';

const R = 52;
const BOX = 120; // 2*R + 여백 (조각 사이 간격이 잘리지 않게)
const C = BOX / 2;

function cardName(c: MyCardRow): string {
  return c.snkrdunkName || c.nickname || '이름 미상';
}

/** 카드 한 장의 평가액(엔) — 웹 allRows.value 동일(등급 일치 currentPriceJpy × 수량). */
function rowValue(c: MyCardRow): number {
  const gradePrice =
    (c.currentPriceJpy ?? 0) > 0
      ? c.currentPriceJpy ?? 0
      : c.graded
        ? c.pricePsa10Jpy ?? 0
        : c.priceSingleJpy ?? c.snkrdunkMinPriceJpy ?? 0;
  return gradePrice > 0 ? gradePrice * Math.max(1, c.qty ?? 1) : 0;
}

export function CollectionPies({ cards, format }: { cards: MyCardRow[]; format: (jpy: number) => string }) {
  const tc = useThemeColors();

  const vizCards = useMemo<VizCard[]>(
    () =>
      cards
        .map((c) => ({ c, valueJpy: rowValue(c) }))
        .filter((r) => r.valueJpy > 0)
        .map(({ c, valueJpy }) => ({
          id: c.id,
          name: cardName(c),
          valueJpy,
          basisJpy: null,
          changePct: null,
          graded: !!c.graded,
          gradeLabel:
            c.priceBasis || (c.graded ? `${c.gradeCompany ?? 'PSA'} ${c.gradeValue ?? ''}`.trim() : 'RAW'),
          // 게임(작품)은 저장값 우선, 없으면 카드명 파싱 폴백(웹 동일 규칙).
          game: c.game || parseCardStatics(cardName(c)).game,
          series: c.series ?? null,
          selfPulled: !!c.selfPulled,
        })),
    [cards],
  );

  const byGame = compositionByGame(vizCards, 4);
  const byGrade = compositionByGrade(vizCards, 4);
  if (byGame.length === 0 && byGrade.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: space.gap, marginBottom: space.cg }}>
      <PixelText variant="ko" size={15} weight="bold" color={tc.ink} style={{ marginBottom: 10 }}>
        자산 구성
      </PixelText>
      <View style={{ backgroundColor: tc.white, borderColor: tc.pap3, borderWidth: 1, borderRadius: 14 }}>
        <View style={{ padding: 16, gap: 18 }}>
          <PieBlock title="카드 종류" sub="작품별 평가액 비중" slices={byGame} format={format} />
          {byGrade.length > 0 ? (
            <>
              <View style={{ height: 1, backgroundColor: tc.pap3 }} />
              <PieBlock title="등급 구성" sub="RAW · PSA 등급별 비중" slices={byGrade} format={format} />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function PieBlock({
  title,
  sub,
  slices,
  format,
}: {
  title: string;
  sub: string;
  slices: VizSlice[];
  format: (jpy: number) => string;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  if (slices.length === 0) return null;
  const { arcs, full } = pieSlices(slices, C, C, R);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, marginBottom: 10 }}>
        <PixelText variant="ko" size={12} weight="bold" color={tc.ink}>{title}</PixelText>
        <PixelText variant="ko" size={9} color={tc.ink3}>{sub}</PixelText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`}>
          {full ? (
            <Circle cx={C} cy={C} r={R} fill={full.color} />
          ) : (
            arcs.map(({ slice, d }) => <Path key={slice.key} d={d} fill={slice.color} />)
          )}
        </Svg>
        {/* 직접 라벨 범례 — 색칩 + 이름 + %. 색만으로 구분되는 항목이 없게. */}
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          {slices.map((s) => (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
              <PixelText variant="ko" size={11} weight="bold" color={tc.ink} numberOfLines={1} style={{ flex: 1 }}>
                {s.label}
              </PixelText>
              <PixelText variant={txt} size={11} weight="bold" color={tc.ink}>
                {`${s.pct.toFixed(1)}%`}
              </PixelText>
              <PixelText variant={txt} size={9} color={tc.ink3} numberOfLines={1}>
                {format(s.value)}
              </PixelText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
