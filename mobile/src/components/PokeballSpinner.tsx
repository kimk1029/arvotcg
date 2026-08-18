/**
 * 브랜드 오브 — 라디얼 그라디언트 입체 구슬 (IP 몬스터볼 아트 대체).
 *   • 브랜드 그린 구체 (밝은 톱-하이라이트 → 어두운 가장자리)
 *   • 골드 스파클 + 좌상단 광택 하이라이트 (specular gloss)
 * 컴포넌트명은 사용처 호환을 위해 유지.
 */
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

interface Props {
  size?: number;
}

const INK = '#1A1A2E';
const TEAL_LIGHT = '#3DBBA4';
const TEAL = '#129782';
const TEAL_DARK = '#0B5F52';
const GOLD = '#FFD23F';

export function PokeballSpinner({ size = 44 }: Props) {
  const r = size / 2;
  const ring = Math.max(2, Math.round(size * 0.07));
  const innerR = r - ring / 2;
  const sparkle = size * 0.1;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="orbShade" cx="35%" cy="32%" r="80%">
          <Stop offset="0%" stopColor={TEAL_LIGHT} />
          <Stop offset="55%" stopColor={TEAL} />
          <Stop offset="100%" stopColor={TEAL_DARK} />
        </RadialGradient>
        <RadialGradient id="orbGloss" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <Stop offset="60%" stopColor="rgba(255,255,255,0.25)" />
          <Stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </RadialGradient>
      </Defs>

      {/* 외곽 잉크 원 + 구체 */}
      <Circle cx={r} cy={r} r={r} fill={INK} />
      <Circle cx={r} cy={r} r={innerR} fill="url(#orbShade)" />

      {/* 골드 스파클 (다이아) — 중앙보다 살짝 우하단 */}
      <Path
        d={`M ${r + sparkle * 0.6} ${r - sparkle * 1.4} l ${sparkle} ${sparkle * 1.4} l ${-sparkle} ${sparkle * 1.4} l ${-sparkle} ${-sparkle * 1.4} Z`}
        fill={GOLD}
      />

      {/* 좌상단 광택 */}
      <Ellipse cx={r * 0.55} cy={r * 0.55} rx={r * 0.42} ry={r * 0.28} fill="url(#orbGloss)" />
    </Svg>
  );
}
