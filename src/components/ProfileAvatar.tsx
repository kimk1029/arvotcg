import { getAvatarMeta, isAvatarId, type AvatarId } from '@/lib/avatars';

interface Props {
  id?: AvatarId | string | null;
  size?: number;
  fallback?: string;
}

/**
 * 프로필 아바타 — 아바타 카탈로그(src/lib/avatars.ts)의 이모지 glyph 를 렌더.
 * IP 이미지(포켓몬 도트 스프라이트 gif)는 사용 금지로 제거(2026-07) —
 * 모바일 shopCatalog 의 glyph 표시 방식과 동일.
 */
export function ProfileAvatar({ id, size = 60, fallback = '🐣' }: Props) {
  if (!isAvatarId(id ?? '')) {
    return (
      <span style={{ fontSize: Math.floor(size * 0.7), lineHeight: 1 }}>
        {id && id.length <= 4 ? id : fallback}
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        fontSize: Math.floor(size * 0.62),
        lineHeight: 1,
      }}
    >
      {getAvatarMeta(id as AvatarId).glyph}
    </span>
  );
}
