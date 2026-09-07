import { SPRITE_SIZE, isAvatarSpriteId, spriteRects } from '@/lib/avatarPixels';

interface Props {
  id: string;
  size?: number;
  className?: string;
}

/**
 * 16×16 픽셀 아바타 스프라이트 — 정본 데이터는 shared/avatarPixels.ts.
 * 앱 `components/PixelAvatar.tsx` 와 같은 데이터·같은 렌더 방식(런렝스 rect).
 */
export function PixelAvatar({ id, size = 48, className }: Props) {
  if (!isAvatarSpriteId(id)) return null;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`}
      width={size}
      height={size}
      aria-hidden
      style={{ display: 'block', shapeRendering: 'crispEdges', imageRendering: 'pixelated' }}
    >
      {spriteRects(id).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
    </svg>
  );
}
