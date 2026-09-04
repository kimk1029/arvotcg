'use client';

/**
 * 내 자산 '자산 구성' — 카드 종류(작품)별 · 등급별 평가액 비중 파이차트 2개.
 *
 * 집계·기하·색은 전부 정본 /shared/portfolioViz.ts (compositionByGame /
 * compositionByGrade / pieSlices / VIZ_SERIES). 앱 mobile/src/components/CollectionPies 와
 * 페어 — 두 화면이 같은 숫자·같은 배치를 그린다.
 *
 * 색만으로 항목을 구분하지 않는다: 조각마다 범례에 색칩 + 이름 + 비중(%) + 금액을
 * 직접 라벨로 붙인다(팔레트 대비 WARN 슬롯의 완화 조건).
 */
import type { CSSProperties } from 'react';
import { Panel } from '@/components/ui/Panel';
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

export function CollectionPies({ cards, format }: { cards: VizCard[]; format: (jpy: number) => string }) {
  const byGame = compositionByGame(cards, 4);
  const byGrade = compositionByGrade(cards, 4);
  if (byGame.length === 0 && byGrade.length === 0) return null;

  return (
    <div style={{ padding: '0 var(--gap) 18px' }}>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>
        자산 구성
      </div>
      <Panel style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <PieBlock title="카드 종류" sub="작품별 평가액 비중" slices={byGame} format={format} />
        {byGrade.length > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--pap3)' }} />
            <PieBlock title="등급 구성" sub="RAW · PSA 등급별 비중" slices={byGrade} format={format} />
          </>
        )}
      </Panel>
    </div>
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
  if (slices.length === 0) return null;
  const { arcs, full } = pieSlices(slices, C, C, R);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--f1)', fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{title}</span>
        <span style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>{sub}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} style={{ flex: 'none' }} role="img" aria-label={title}>
          {full ? (
            <circle cx={C} cy={C} r={R} fill={full.color} />
          ) : (
            arcs.map(({ slice, d }) => <path key={slice.key} d={d} fill={slice.color} />)
          )}
        </svg>
        {/* 직접 라벨 범례 — 색칩 + 이름 + %. 색만으로 구분되는 항목이 없게. */}
        <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slices.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...swatch, background: s.color }} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--f1)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.label}
              </span>
              <span style={{ flex: 'none', fontFamily: 'var(--f1)', fontSize: 12, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                {s.pct.toFixed(1)}%
              </span>
              <span style={{ flex: 'none', fontFamily: 'var(--f1)', fontSize: 10.5, color: 'var(--ink3)', fontWeight: 600, minWidth: 62, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {format(s.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const swatch: CSSProperties = {
  flex: 'none',
  width: 10,
  height: 10,
  borderRadius: 3,
};
