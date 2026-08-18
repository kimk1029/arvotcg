'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { InventoryCtxValue } from './InventoryProvider';
import { ProfileAvatar } from './ProfileAvatar';
import { AVATARS, getAvatarMeta, type AvatarId } from '@/lib/avatars';
import { MY_PROFILE } from '@/lib/data';

interface Props {
  inv: InventoryCtxValue;
  onClose: () => void;
}

/** 현재 유저 레벨 — mock (MyProfile.level). 추후 서버값으로 교체. */
const USER_LEVEL = MY_PROFILE.level;

export function AvatarPicker({ inv, onClose }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<AvatarId | null>(null);

  const handleClick = async (id: AvatarId) => {
    if (pendingId) return; // 이미 처리 중 — 중복 클릭 차단
    const meta = getAvatarMeta(id);
    const owned = inv.avatarOwned.includes(id);

    if (owned) {
      if (id === inv.avatar) {
        onClose();
        return;
      }
      setPendingId(id);
      const r = await inv.pickAvatar(id);
      setPendingId(null);
      if (r.ok) {
        onClose();
      } else {
        setMsg(r.msg ?? '변경 실패');
        setTimeout(() => setMsg(null), 1400);
      }
      return;
    }

    if (meta.mode === 'level') {
      if (USER_LEVEL < (meta.level ?? 99)) {
        setMsg(`LV.${meta.level} 필요`);
        setTimeout(() => setMsg(null), 1400);
        return;
      }
      setPendingId(id);
      const r = await inv.buyAvatar(id, 0);
      setPendingId(null);
      if (r.ok) onClose();
      return;
    }

    if (meta.mode === 'shop' && meta.price !== undefined) {
      setPendingId(id);
      const r = await inv.buyAvatar(id, meta.price);
      setPendingId(null);
      if (!r.ok) {
        setMsg(r.msg ?? '구매 실패');
        setTimeout(() => setMsg(null), 1400);
        return;
      }
      setMsg(`✓ ${meta.name} 획득!`);
      setTimeout(() => {
        setMsg(null);
        onClose();
      }, 900);
    }
  };

  return (
    <div className="avatar-overlay" onClick={onClose}>
      <div className="avatar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="avatar-modal-head">
          <span>프로필 캐릭터</span>
          <button type="button" onClick={onClose} aria-label="닫기" className="avatar-close">
            ✕
          </button>
        </div>

        <div className="avatar-modal-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>탭해서 선택 · 잠금은 조건 달성/구매 시 해제</span>
          <span style={{ color: 'var(--red)', fontWeight: 600 }}>🪙 {inv.points.toLocaleString()}P</span>
        </div>

        {msg && (
          <div
            style={{
              margin: '4px 0',
              padding: '8px 10px',
              background: 'var(--ink)',
              color: 'var(--yel)',
              fontFamily: 'var(--f1)',
              fontSize: 10,
              letterSpacing: 0.5,
              textAlign: 'center',
              boxShadow: '3px 3px 0 var(--yel-dk)',
            }}
          >
            {msg}
          </div>
        )}

        <div className="avatar-grid">
          {AVATARS.map((a) => {
            const owned = inv.avatarOwned.includes(a.id);
            const isCurrent = a.id === inv.avatar;
            const isLevelLocked = a.mode === 'level' && !owned && USER_LEVEL < (a.level ?? 99);
            const isShop = a.mode === 'shop' && !owned;
            const isPending = pendingId === a.id;
            const isAnyPending = pendingId !== null;
            return (
              <button
                key={a.id}
                type="button"
                className={[
                  'avatar-tile',
                  isLevelLocked ? 'locked' : '',
                  isCurrent ? 'active' : '',
                  isPending ? 'pending' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleClick(a.id)}
                disabled={isLevelLocked || isAnyPending}
                aria-busy={isPending}
                aria-label={a.name}
              >
                <div className="avatar-tile-img">
                  <ProfileAvatar id={a.id} size={70} />
                </div>
                <div className="avatar-tile-name">{a.name}</div>
                {a.tag && <div className={`avatar-tile-tag tag-${a.tag}`}>{a.tag.toUpperCase()}</div>}
                {isShop && (
                  <div className="avatar-tile-price">
                    🪙 {(a.price ?? 0).toLocaleString()}
                  </div>
                )}
                {isLevelLocked && (
                  <div className="avatar-tile-lock">
                    <span className="lock-icon">🔒</span>
                    <span className="lock-hint">LV.{a.level} 필요</span>
                  </div>
                )}
                {isPending && (
                  <div className="avatar-tile-loading" aria-hidden>
                    <span className="pf-pokeball-spinner avatar-tile-spinner" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', padding: '4px 0 0' }}>
          <Link
            href="/my/shop"
            onClick={onClose}
            style={{
              fontFamily: 'var(--f1)',
              fontSize: 10,
              color: 'var(--ink3)',
              letterSpacing: 0.5,
              textDecoration: 'underline',
            }}
          >
            상점에서 배경·테두리 보기 ▶
          </Link>
        </div>
      </div>
    </div>
  );
}
