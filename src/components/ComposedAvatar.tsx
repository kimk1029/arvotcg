import { PixelBackground } from './PixelBackground';
import { ProfileAvatar } from './ProfileAvatar';
import { isBackgroundId, isFrameId, type BackgroundId, type FrameId } from '@/lib/shop';

interface Props {
  avatar?: string | null;
  bg?: string | null;
  frame?: string | null;
  size?: number;
  fallback?: string;
  /** 모서리 반경(px). 테두리(box-shadow)도 같은 반경을 따른다. */
  radius?: number;
}

/**
 * 아바타 × 배경 × 테두리 합성 프로필 이미지.
 * 서버·클라이언트 어디서든 사용 가능한 순수 컴포넌트. 앱 `components/ComposedAvatar.tsx` 와 페어.
 */
export function ComposedAvatar({
  avatar,
  bg,
  frame,
  size = 44,
  fallback = '🐣',
  radius,
}: Props) {
  const bgId: BackgroundId = isBackgroundId(bg) ? (bg as BackgroundId) : 'default';
  const frameId: FrameId = isFrameId(frame) ? (frame as FrameId) : 'none';
  return (
    <div
      className={`prof-wrap frm-${frameId}`}
      style={{
        width: size,
        height: size,
        ...(radius != null ? { borderRadius: radius } : null),
      }}
    >
      <PixelBackground id={bgId} />
      <ProfileAvatar id={avatar} size={Math.floor(size * 0.82)} fallback={fallback} />
    </div>
  );
}
