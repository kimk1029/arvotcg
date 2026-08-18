'use client';

import Link from 'next/link';
import { useInventory } from './InventoryProvider';
import { PixelBackground } from './PixelBackground';
import { ProfileAvatar } from './ProfileAvatar';
import { useUnread } from './UnreadProvider';

/**
 * AppBar 오른쪽 자리에 들어가는 미니 프로필 (34×34).
 * 내 현재 인벤토리 (아바타 × 배경 × 테두리) 합성, 탭시 /my 이동.
 */
export function AppBarProfile() {
  const { avatar, bg, frame, isLoggedIn } = useInventory();
  const { count } = useUnread();

  if (!isLoggedIn) {
    return (
      <Link href="/my" className="appbar-right" aria-label="로그인">
        👤
      </Link>
    );
  }

  return (
    <Link
      href="/my"
      aria-label="마이페이지"
      className={`appbar-right frm-${frame}`}
      style={{
        position: 'relative',
        padding: 0,
        overflow: 'visible',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <PixelBackground id={bg} />
        <div style={{ position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center' }}>
          <ProfileAvatar id={avatar} size={28} />
        </div>
      </div>
      {count > 0 && <span className="unread-dot" />}
    </Link>
  );
}
