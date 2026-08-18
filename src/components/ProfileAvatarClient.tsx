'use client';

import { useState } from 'react';
import { AvatarPicker } from './AvatarPicker';
import { useInventory } from './InventoryProvider';
import { PixelBackground } from './PixelBackground';
import { ProfileAvatar } from './ProfileAvatar';

export function ProfileAvatarClient({
  size = 88,
  allowEdit = true,
}: {
  size?: number;
  allowEdit?: boolean;
}) {
  const inv = useInventory();
  const [open, setOpen] = useState(false);
  const content = (
    <div
      className={`prof-wrap frm-${inv.frame}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <PixelBackground id={inv.bg} />
      <ProfileAvatar id={inv.avatar} size={Math.floor(size * 0.8)} />
    </div>
  );
  return (
    <>
      {allowEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="프로필 캐릭터 변경"
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-block',
          }}
        >
          {content}
        </button>
      ) : (
        content
      )}
      {open && (
        <AvatarPicker
          inv={inv}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
