import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  size?: number;
}

/**
 * 단색 브랜드 오브 (IP 몬스터볼 아트 대체) — 잉크 외곽선 + 브랜드 그린 구체 +
 * 골드 스파클. 스피너 회전용이라 별도 광택 없음.
 */
export function SmoothBall({ size = 48 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="30" fill="#1A1A2E" />
      <Circle cx="32" cy="32" r="26" fill="#129782" />
      <Path d="M 36 22 L 42 32 L 36 42 L 30 32 Z" fill="#FFD23F" />
    </Svg>
  );
}
