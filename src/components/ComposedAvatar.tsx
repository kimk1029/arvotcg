import { PixelBackground } from './PixelBackground';
import { ProfileAvatar } from './ProfileAvatar';
import { isBackgroundId, isFrameId, type BackgroundId, type FrameId } from '@/lib/shop';

interface Props {
  avatar?: string | null;
  bg?: string | null;
  frame?: string | null;
  size?: number;
  fallback?: string;
}

/**
 * 아바타 × 배경 × 테두리 합성 프로필 이미지.
 * 서버·클라이언트 어디서든 사용 가능한 순수 컴포넌트.
 */
export function ComposedAvatar({
  avatar,
  bg,
  frame,
  size = 44,
  fallback = '🐣',
}: Props) {
  const bgId: BackgroundId = isBackgroundId(bg) ? (bg as BackgroundId) : 'default';
  const frameId: FrameId = isFrameId(frame) ? (frame as FrameId) : 'none';
  return (
    <div
      className={`prof-wrap frm-${frameId}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <PixelBackground id={bgId} />
      <ProfileAvatar id={avatar} size={Math.floor(size * 0.82)} fallback={fallback} />
    </div>
  );
}
