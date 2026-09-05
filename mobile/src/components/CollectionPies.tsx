/**
 * 내 자산 '자산 구성' — 카드 종류(작품)별 · 등급별 평가액 비중 파이차트 2개.
 *
 * 집계·기하·색은 전부 정본 /shared/portfolioViz.ts (compositionByGame /
 * compositionByGrade / pieSlices / pieLabels / VIZ_SERIES). 웹
 * src/components/portfolio/CollectionPies 와 페어 — 같은 숫자·같은 배치를 그린다.
 *
 * 배치: 두 블록을 가로 한 줄로 세우고, 각 블록은 제목 → 파이 → 범례 세로 스택.
 * 비중(%)은 조각 안에 직접 얹는다.
 *
 * 색만으로 항목을 구분하지 않는다: 범례에 색칩 + 이름 + 금액을 붙이고 조각 안에 %
 * 를 얹는다(팔레트 대비 WARN 슬롯의 완화 조건). 조각이 좁아 안쪽 라벨을 못 다는
 * 항목은 범례 이름 뒤에 (n%) 로 보완한다.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { PixelText } from '@/components/PixelText';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import type { MyCardRow } from '@/lib/myApi';
import { parseCardStatics } from '../../../shared/cardStatics';
import {
  compositionByGame,
  compositionByGrade,
  pieLabels,
  pieSlices,
  VIZ_ON_SLICE,
  type VizCard,
  type VizSlice,
} from '../../../shared/portfolioViz';

const R = 48;
const BOX = 112; // 2*R + 여백 (조각 사이 간격이 잘리지 않게)
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
        {/* 두 블록 가로 한 줄 — 각 블록이 폭을 반씩 나눠 갖는다. */}
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
          <PieBlock title="카드 종류" sub="작품별 평가액 비중" slices={byGame} format={format} />
          {byGrade.length > 0 ? (
            <PieBlock title="등급 구성" sub="RAW · PSA 등급별" slices={byGrade} format={format} />
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
  const labels = pieLabels(slices, C, C, R);
  const labeled = new Set(labels.map((l) => l.slice.key));

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <PixelText variant="ko" size={12} weight="bold" color={tc.ink}>{title}</PixelText>
      <PixelText variant="ko" size={9} color={tc.ink3} numberOfLines={1} style={{ marginTop: 2 }}>
        {sub}
      </PixelText>

      <Svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} style={{ alignSelf: 'center', marginVertical: 10 }}>
        {full ? (
          <Circle cx={C} cy={C} r={R} fill={full.color} />
        ) : (
          arcs.map(({ slice, d }) => <Path key={slice.key} d={d} fill={slice.color} />)
        )}
        {/* 비중(%)은 조각 안에 직접. 잉크는 6색 전부 대비 4.6:1 이상인 단일 값. */}
        {labels.map((l) => (
          <SvgText
            key={l.slice.key}
            x={l.x}
            y={l.y}
            fill={VIZ_ON_SLICE}
            fontSize={11}
            fontWeight="bold"
            textAnchor="middle"
            alignmentBaseline="central"
          >
            {l.text}
          </SvgText>
        ))}
      </Svg>

      {/* 직접 라벨 범례 — 색칩 + 이름 + 금액. 안쪽 라벨을 못 단 조각만 이름 뒤에 (n%). */}
      <View style={{ gap: 7 }}>
        {slices.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
            <PixelText variant="ko" size={11} weight="bold" color={tc.ink} numberOfLines={1} style={{ flex: 1 }}>
              {labeled.has(s.key) ? s.label : `${s.label} (${Math.round(s.pct)}%)`}
            </PixelText>
            <PixelText variant={txt} size={9} color={tc.ink3} numberOfLines={1}>
              {format(s.value)}
            </PixelText>
          </View>
        ))}
      </View>
    </View>
  );
}
