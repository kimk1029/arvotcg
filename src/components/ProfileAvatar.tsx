import { isAvatarId, type AvatarId } from '@/lib/avatars';
import { PixelAvatar } from './PixelAvatar';

interface Props {
  id?: AvatarId | string | null;
  size?: number;
  fallback?: string;
}

/**
 * 프로필 아바타 — 카탈로그 id 면 16×16 픽셀 캐릭터(shared/avatarPixels.ts)를,
 * 그 외(이모지·레거시 문자열)는 텍스트로 렌더.
 * IP 이미지(도트 스프라이트 gif)는 사용 금지로 제거(2026-07) — 지금은 오리지널 픽셀 데이터.
 * 앱 `components/ProfileAvatar.tsx` 와 페어.
 */
export function ProfileAvatar({ id, size = 60, fallback = '🐣' }: Props) {
  if (!isAvatarId(id ?? '')) {
    return (
      <span style={{ fontSize: Math.floor(size * 0.7), lineHeight: 1 }}>
        {id && id.length <= 4 ? id : fallback}
      </span>
    );
  }
  return <PixelAvatar id={id as AvatarId} size={size} />;
}
