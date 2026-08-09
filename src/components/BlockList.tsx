'use client';

import { useState } from 'react';

export interface BlockedUser {
  userId: string;
  name: string;
  avatarId: string | null;
  createdAt: string;
}

/**
 * 차단한 사용자 목록 + 해제 — /my/blocks 본문. 앱 mobile/app/my/blocks.tsx 와 페어.
 * 해제하면 즉시 목록에서 제거 (서버 필터도 다음 조회부터 풀림).
 */
export function BlockList({ initialBlocks }: { initialBlocks: BlockedUser[] }) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [busyId, setBusyId] = useState<string | null>(null);

  const unblock = async (userId: string, name: string) => {
    if (busyId) return;
    if (!window.confirm(`${name}님 차단을 해제할까요?\n해제하면 이 사용자의 글이 다시 보여요.`)) return;
    setBusyId(userId);
    try {
      const r = await fetch(`/api/me/blocks/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('unblock failed');
      setBlocks((prev) => prev.filter((b) => b.userId !== userId));
    } catch {
      window.alert('차단 해제에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusyId(null);
    }
  };

  if (blocks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '52px 20px', color: 'var(--ink3)', fontSize: 13.5, lineHeight: 1.7 }}>
        차단한 사용자가 없어요.
        <br />
        게시글·댓글의 ⋯ 메뉴에서 사용자를 차단할 수 있어요.
      </div>
    );
  }

  return (
    <div className="sect" style={{ padding: '8px 16px' }}>
      {blocks.map((b) => (
        <div
          key={b.userId}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 4px', borderBottom: '1px solid var(--border)' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {b.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
              {new Date(b.createdAt).toLocaleDateString('ko-KR')} 차단
            </div>
          </div>
          <button
            type="button"
            disabled={busyId === b.userId}
            onClick={() => unblock(b.userId, b.name)}
            style={{ flex: 'none', fontSize: 12.5, fontWeight: 800, color: 'var(--ink2)', background: 'var(--pap2)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', opacity: busyId === b.userId ? 0.5 : 1 }}
          >
            차단 해제
          </button>
        </div>
      ))}
    </div>
  );
}
