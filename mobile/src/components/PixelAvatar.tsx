import Svg, { Rect } from 'react-native-svg';
import { SPRITE_SIZE, isAvatarSpriteId, spriteRects } from '@/lib/avatarPixels';

interface Props {
  id: string;
  size?: number;
}

/**
 * 16×16 픽셀 아바타 스프라이트 — 정본 데이터는 shared/avatarPixels.ts.
 * 웹 `components/PixelAvatar.tsx` 와 같은 데이터·같은 렌더 방식(런렝스 rect).
 */
export function PixelAvatar({ id, size = 48 }: Props) {
  if (!isAvatarSpriteId(id)) return null;
  return (
    <Svg viewBox={`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`} width={size} height={size}>
      {spriteRects(id).map((r, i) => (
        <Rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
    </Svg>
  );
}
