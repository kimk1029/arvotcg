import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { RAINBOW_CYCLE, frameRings, frameThickness } from '@/lib/avatarPixels';
import { isAvatarId } from '@/data/shopCatalog';
import { PixelAvatar } from './PixelAvatar';
import { PixelBackground } from './PixelBackground';

interface Props {
  avatar?: string | null;
  bg?: string | null;
  frame?: string | null;
  /** 안쪽(배경+아바타) 한 변 크기. 테두리는 이 바깥쪽에 더해진다 — 웹 box-shadow 방식과 동일. */
  size?: number;
  fallback?: string;
  /** 안쪽 모서리 반경. 테두리 링도 같은 반경을 따른다. */
  radius?: number;
}

/**
 * 아바타 × 배경 × 테두리 합성 프로필 — 웹 `components/ComposedAvatar.tsx` 와 페어.
 * 링 색·두께는 shared/avatarPixels.ts(FRAME_RINGS)가 정본(웹 .frm-* CSS 와 같은 배색).
 */
export function ComposedAvatar({ avatar, bg, frame, size = 44, fallback = '🐣', radius = 0 }: Props) {
  const rings = frameRings(frame);
  const isRainbow = frame === 'rainbow';
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isRainbow) return;
    const t = setInterval(() => setTick((v) => (v + 1) % RAINBOW_CYCLE.length), 330);
    return () => clearInterval(t);
  }, [isRainbow]);

  const hasSprite = isAvatarId(avatar ?? '');
  let node: ReactNode = (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <PixelBackground id={bg} width={size} height={size} />
      {hasSprite ? (
        <PixelAvatar id={avatar as string} size={Math.floor(size * 0.82)} />
      ) : (
        <Text style={{ fontSize: Math.floor(size * 0.5), lineHeight: Math.floor(size * 0.62) }}>
          {avatar && avatar.length <= 4 ? avatar : fallback}
        </Text>
      )}
    </View>
  );

  // 안쪽→바깥쪽 순으로 감싼다 (rings 는 바깥→안쪽 순 정의).
  let r = radius;
  for (let i = rings.length - 1; i >= 0; i -= 1) {
    const ring = rings[i];
    const color = isRainbow && i === 1 ? RAINBOW_CYCLE[tick] : ring.color;
    r += ring.width;
    node = (
      <View style={{ borderWidth: ring.width, borderColor: color, borderRadius: r }}>
        {node}
      </View>
    );
  }

  const total = size + frameThickness(frame) * 2;
  return <View style={{ width: total, height: total }}>{node}</View>;
}
