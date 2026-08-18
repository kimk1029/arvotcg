import Svg, { Rect } from 'react-native-svg';

interface Props {
  size?: number;
}

// 브랜드 픽셀 마크 — TCG 카드 한 장 (테두리 잉크 + 브랜드 그린 면 + 골드 스파클).
// IP(몬스터볼) 도트 아트 대체.
const RECTS: Array<[number, number, number, number, string]> = [
  [2, 0, 6, 1, '#1A1A2E'],
  [2, 1, 1, 8, '#1A1A2E'],
  [7, 1, 1, 8, '#1A1A2E'],
  [2, 9, 6, 1, '#1A1A2E'],
  [3, 1, 4, 8, '#129782'],
  [3, 1, 1, 2, '#3DBBA4'],
  [4, 3, 1, 1, '#FFD23F'],
  [3, 4, 3, 1, '#FFD23F'],
  [4, 5, 1, 1, '#FFD23F'],
];

export function PixelBall({ size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      {RECTS.map(([x, y, w, h, fill], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
    </Svg>
  );
}
