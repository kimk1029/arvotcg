'use client';

import { useState } from 'react';
import { UserDetailModal } from './UserDetailModal';

interface Row {
  id: string;
  name: string;
  email: string | null;
  avatarId: string;
  points: number;
  /** 'web' | 'mobile' | null(컬럼 도입 전 가입 — apple_ id 는 앱으로 추정) */
  signupPlatform: string | null;
  createdAt: string;
  updatedAt: string;
  counts: {
    feeds: number; trades: number; bookmarks: number;
    sentMessages: number; receivedMessages: number; oripaTickets: number;
    userCards: number;
  };
}

/** 가입 경로 배지 — 기록 없으면(레거시) Apple id 만 앱으로 추정, 나머지는 미상. */
function PlatformBadge({ platform, userId }: { platform: string | null; userId: string }) {
  const p = platform ?? (userId.startsWith('apple_') ? 'mobile' : null);
  if (p === 'mobile') {
    return <span className="tag" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>📱 앱</span>;
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
