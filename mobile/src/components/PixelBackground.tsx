import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import { BG_VIEW_H, BG_VIEW_W, backgroundScene } from '@/lib/avatarPixels';

interface Props {
  id: string | null | undefined;
  width: number;
  height: number;
}

/**
 * 프로필 아바타 뒤 픽셀 배경 — 신 데이터는 shared/avatarPixels.ts(BACKGROUND_SCENES).
 * 웹 `components/PixelBackground.tsx` 와 동일 데이터. preserveAspectRatio none 으로 꽉 채움.
 */
export function PixelBackground({ id, width, height }: Props) {
  return (
    <Svg
      viewBox={`0 0 ${BG_VIEW_W} ${BG_VIEW_H}`}
      preserveAspectRatio="none"
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {backgroundScene(id).map((s, i) =>
        s.t === 'r' ? (
          <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.f} />
        ) : s.t === 'c' ? (
          <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.f} />
        ) : (
          <Polygon key={i} points={s.pts} fill={s.f} />
        ),
      )}
    </Svg>
  );
}
