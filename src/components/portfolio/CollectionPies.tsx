'use client';

/**
 * 내 자산 '자산 구성' — 카드 종류(작품)별 · 등급별 평가액 비중 파이차트 2개.
 *
 * 집계·기하·색은 전부 정본 /shared/portfolioViz.ts (compositionByGame /
 * compositionByGrade / pieSlices / pieLabels / VIZ_SERIES). 앱
 * mobile/src/components/CollectionPies 와 페어 — 두 화면이 같은 숫자·같은 배치를 그린다.
 *
 * 배치: 두 블록을 가로 한 줄로 세우고(좁으면 자동 줄바꿈), 각 블록은
 * 제목 → 파이 → 범례 세로 스택. 비중(%)은 조각 안에 직접 얹는다.
 *
 * 색만으로 항목을 구분하지 않는다: 범례에 색칩 + 이름 + 금액을 직접 붙이고,
 * 조각 안에 % 를 얹는다(팔레트 대비 WARN 슬롯의 완화 조건). 조각이 좁아
 * 안쪽 라벨을 못 다는 항목은 범례 이름 뒤에 (n%) 로 보완한다.
 */
import type { CSSProperties } from 'react';
import { Panel } from '@/components/ui/Panel';
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

export function CollectionPies({ cards, format }: { cards: VizCard[]; format: (jpy: number) => string }) {
  const byGame = compositionByGame(cards, 4);
  const byGrade = compositionByGrade(cards, 4);
  if (byGame.length === 0 && byGrade.length === 0) return null;

  return (
    <div style={{ padding: '0 var(--gap) 18px' }}>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>
        자산 구성
      </div>
      <Panel style={{ padding: 16 }}>
        {/* 두 블록 가로 한 줄 — 폭이 모자라면 wrap 으로 접힌다. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <PieBlock title="카드 종류" sub="작품별 평가액 비중" slices={byGame} format={format} />
          {byGrade.length > 0 && (
            <PieBlock title="등급 구성" sub="RAW · PSA 등급별 비중" slices={byGrade} format={format} />
          )}
        </div>
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
  const labels = pieLabels(slices, C, C, R);
  const labeled = new Set(labels.map((l) => l.slice.key));

  return (
    <div style={{ flex: '1 1 150px', minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{sub}</div>

      <svg
        width={BOX}
        height={BOX}
        viewBox={`0 0 ${BOX} ${BOX}`}
        style={{ display: 'block', margin: '10px auto' }}
        role="img"
        aria-label={title}
      >
        {full ? (
          <circle cx={C} cy={C} r={R} fill={full.color} />
        ) : (
          arcs.map(({ slice, d }) => <path key={slice.key} d={d} fill={slice.color} />)
        )}
        {/* 비중(%)은 조각 안에 직접. 잉크는 6색 전부 대비 4.6:1 이상인 단일 값. */}
        {labels.map((l) => (
          <text
            key={l.slice.key}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={VIZ_ON_SLICE}
            style={{ fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800 }}
          >
            {l.text}
          </text>
        ))}
      </svg>

      {/* 직접 라벨 범례 — 색칩 + 이름 + 금액. 안쪽 라벨을 못 단 조각만 이름 뒤에 (n%). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {slices.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ ...swatch, background: s.color }} />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'var(--f1)',
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {labeled.has(s.key) ? s.label : `${s.label} (${Math.round(s.pct)}%)`}
            </span>
            <span
              style={{
                flex: 'none',
                fontFamily: 'var(--f1)',
                fontSize: 10,
                color: 'var(--ink3)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {format(s.value)}
            </span>
          </div>
        ))}
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
