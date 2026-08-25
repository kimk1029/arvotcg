/**
 * 도넛 차트 (SVG, 서버 컴포넌트) — 상태 분포 시각화용.
 * 중앙에 합계, 오른쪽에 범례(색·라벨·값).
 */

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices,
  centerLabel,
  size = 132,
}: {
  slices: DonutSlice[];
  centerLabel?: string;
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = size / 2;
  const r = R * 0.62; // 도넛 두께
  const C = 2 * Math.PI * ((R + r) / 2);
  const stroke = R - r;

  if (total === 0) {
    return <div className="muted" style={{ padding: 20, textAlign: 'center' }}>데이터 없음</div>;
  }

  let acc = 0;
  const midR = (R + r) / 2;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${R} ${R})`}>
          {slices.filter((s) => s.value > 0).map((s) => {
            const frac = s.value / total;
            const dash = frac * C;
            const offset = -acc * C;
            acc += frac;
            return (
              <circle
                key={s.label}
                cx={R}
                cy={R}
                r={midR}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </g>
        <text x={R} y={R - 4} textAnchor="middle" fontSize={size * 0.17} fontWeight={800} fill="#0F172A">
          {total.toLocaleString()}
        </text>
        {centerLabel ? (
          <text x={R} y={R + size * 0.12} textAnchor="middle" fontSize={size * 0.082} fill="#64748B">
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <div className="donut-legend">
        {slices.map((s) => (
          <div className="row" key={s.label}>
            <span className="sw" style={{ background: s.color }} />
            <span>{s.label}</span>
            <b>{s.value.toLocaleString()}</b>
            <span className="muted">({total ? Math.round((s.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
