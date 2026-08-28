'use client';

import { useState } from 'react';
import { UserDetailModal } from './UserDetailModal';

interface Row {
  id: string;
  name: string;
  email: string | null;
  avatarId: string;
  points: number;
  /** 'web' | 'ios' | 'android' | 'mobile'(구버전 앱, OS 미상) | null(컬럼 도입 전 가입 — apple_ id 는 iOS 로 추정) */
  signupPlatform: string | null;
  /** 어드민 권한 — 부여 시 소셜 로그인으로 어드민 사이트 접근 가능. */
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  counts: {
    feeds: number; trades: number; bookmarks: number;
    sentMessages: number; receivedMessages: number; oripaTickets: number;
    userCards: number;
  };
}

/** 가입 경로 배지 — 기록 없으면(레거시) Apple id 만 iOS 로 추정, 나머지는 미상. */
function PlatformBadge({ platform, userId }: { platform: string | null; userId: string }) {
  const p = platform ?? (userId.startsWith('apple_') ? 'ios' : null);
  if (p === 'ios') {
    return <span className="tag" style={{ background: '#F1F5F9', color: '#0F172A' }}> iOS</span>;
  }
  if (p === 'android') {
    return <span className="tag" style={{ background: '#ECFDF5', color: '#047857' }}>🤖 AOS</span>;
  }
  if (p === 'mobile') {
    return <span className="tag" style={{ background: '#EFF6FF', color: '#1D4ED8' }} title="1.1.1 이전 앱 가입 — OS 미기록">📱 앱</span>;
  }
  if (p === 'web') {
    return <span className="tag" style={{ background: '#F0FDF4', color: '#166534' }}>💻 웹</span>;
  }
  return <span className="tag" title="가입경로 기록 도입 이전 회원">—</span>;
}

function fmt(d: string | null | undefined): string {
  if (!d) return '-';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

export function UsersTable({ rows }: { rows: Row[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // 권한 토글 결과를 즉시 반영 (서버 응답 성공 시에만 확정).
  const [adminMap, setAdminMap] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleAdmin = async (u: Row) => {
    const current = adminMap[u.id] ?? u.isAdmin;
    const next = !current;
    const who = u.email ?? u.name ?? u.id;
    const ok = window.confirm(
      next
        ? `${who} 님에게 관리자 권한을 부여할까요?\n소셜 로그인으로 어드민 사이트에 접근할 수 있게 됩니다.`
        : `${who} 님의 관리자 권한을 해제할까요?`,
    );
    if (!ok) return;
    setBusyId(u.id);
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(u.id)}/admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: next }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setAdminMap((m) => ({ ...m, [u.id]: next }));
    } catch {
      window.alert('권한 변경에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0) return <div className="empty">검색 결과가 없습니다.</div>;

  return (
    <>
      <table className="tbl">
        <thead>
          <tr>
            <th>UID</th>
            <th>이름</th>
            <th>이메일</th>
            <th>가입경로</th>
            <th>관리자</th>
            <th>아바타</th>
            <th style={{ textAlign: 'right' }}>포인트</th>
            <th style={{ textAlign: 'right' }}>컬렉션</th>
            <th style={{ textAlign: 'right' }}>피드</th>
            <th style={{ textAlign: 'right' }}>거래</th>
            <th style={{ textAlign: 'right' }}>찜</th>
            <th style={{ textAlign: 'right' }}>쪽지</th>
            <th style={{ textAlign: 'right' }}>오리파</th>
            <th>가입</th>
            <th>마지막 활동</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td className="mono" style={{ fontSize: 10, color: '#64748B', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.id}>
                {u.id.slice(0, 12)}
              </td>
              <td>{u.name}</td>
              <td className="mono" style={{ fontSize: 11 }}>{u.email ?? <span className="muted">-</span>}</td>
              <td><PlatformBadge platform={u.signupPlatform} userId={u.id} /></td>
              <td>
                {/* 권한 부여 시 이 계정으로 소셜 로그인해 어드민에 들어올 수 있다 */}
                <button
                  type="button"
                  className="btn"
                  disabled={busyId === u.id}
                  onClick={() => toggleAdmin(u)}
                  title={(adminMap[u.id] ?? u.isAdmin) ? '클릭하면 권한 해제' : '클릭하면 권한 부여'}
                  style={
                    (adminMap[u.id] ?? u.isAdmin)
                      ? { background: '#129782', borderColor: '#129782', color: '#fff' }
                      : undefined
                  }
                >
                  {busyId === u.id ? '…' : (adminMap[u.id] ?? u.isAdmin) ? '🔑 관리자' : '일반'}
                </button>
              </td>
              <td className="mono">{u.avatarId}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{u.points.toLocaleString()}</td>
              <td className="mono" style={{ textAlign: 'right', fontWeight: u.counts.userCards > 0 ? 700 : 400 }}>{u.counts.userCards}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{u.counts.feeds}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{u.counts.trades}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{u.counts.bookmarks}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{u.counts.sentMessages + u.counts.receivedMessages}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{u.counts.oripaTickets}</td>
              <td className="mono muted">{fmt(u.createdAt)}</td>
              <td className="mono muted">{fmt(u.updatedAt)}</td>
              <td>
                <button type="button" className="btn" onClick={() => setOpenId(u.id)}>상세</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {openId && <UserDetailModal userId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
