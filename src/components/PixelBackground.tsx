import type { BackgroundId } from '@/lib/shop';
import { BG_VIEW_H, BG_VIEW_W, backgroundScene } from '@/lib/avatarPixels';

/**
 * 프로필 아바타 뒤에 깔리는 픽셀 배경.
 * 신 데이터는 shared/avatarPixels.ts(BACKGROUND_SCENES)가 정본 — 앱 PixelBackground 와 동일.
 * viewBox 32:20, preserveAspectRatio none 으로 컨테이너 꽉 채움.
 */
interface Props {
  id: BackgroundId | string;
}

export function PixelBackground({ id }: Props) {
  return (
    <svg
      className="pix-bg"
      viewBox={`0 0 ${BG_VIEW_W} ${BG_VIEW_H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        imageRendering: 'pixelated',
        shapeRendering: 'crispEdges',
      }}
    >
      {backgroundScene(id).map((s, i) =>
        s.t === 'r' ? (
          <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.f} />
        ) : s.t === 'c' ? (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.f} />
        ) : (
          <polygon key={i} points={s.pts} fill={s.f} />
        ),
      )}
    </svg>
  );
}
