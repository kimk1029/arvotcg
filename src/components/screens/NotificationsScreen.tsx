'use client';

/**
 * 알림 목록 — 포인트 적립·회수·레벨업 (PointLog 원장 기반, /api/me/notifications).
 * 진입 시 seen 처리 → 헤더/드로어의 미확인 배지가 사라진다. 앱과 동일 구성.
 */
import { useEffect, useState } from 'react';
import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { POINT_REASON_EMOJI, POINT_REASON_LABELS } from '@/lib/rewards';

export interface NotificationRow {
  id: number;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
  unseen: boolean;
  levelUp: { from: number; to: number; title: string } | null;
}

export function relTime(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins <= 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export function NotificationsScreen() {
  const [rows, setRows] = useState<NotificationRow[] | null>(null);

  useEffect(() => {
    fetch('/api/me/notifications', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((j: { data: NotificationRow[] }) => setRows(j.data ?? []))
      .catch(() => setRows([]));
    // 목록을 연 것으로 간주 — 미확인 배지 리셋.
    fetch('/api/me/notifications/seen', { method: 'POST', credentials: 'include' }).catch(() => {});
  }, []);

  return (
    <>
      <StatusBar />
      <AppBar title="알림" showBack backHref="/" />
      <div style={{ height: 14 }} />

      {rows === null ? (
        <div style={{ margin: '30px auto', textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)' }}>
          불러오는 중...
        </div>
      ) : rows.length === 0 ? (
        <div style={{ margin: '30px var(--gap)', padding: '28px 14px', background: 'var(--white)', textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--ink2)', borderRadius: 12 }}>
          아직 알림이 없어요.
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink3)' }}>
            출석 체크·커뮤니티 글쓰기·거래로 포인트를 모으면 여기에 쌓여요.
          </div>
        </div>
      ) : (
        <div style={{ margin: '0 var(--gap) 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((n) => {
            const earn = n.delta > 0;
            return (
              <div
                key={n.id}
                style={{
                  background: 'var(--white)', borderRadius: 12, padding: '12px 14px',
                  borderLeft: n.unseen ? '3px solid var(--gold)' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22, width: 28, textAlign: 'center', flex: 'none' }}>
                    {POINT_REASON_EMOJI[n.reason] ?? '🪙'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
                      {POINT_REASON_LABELS[n.reason] ?? n.reason}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>
                      {relTime(n.createdAt)} · 잔액 {n.balanceAfter.toLocaleString()}P
                    </div>
                  </div>
                  <span style={{ fontSize: 14.5, fontWeight: 900, flex: 'none', color: earn ? 'var(--grn)' : 'var(--red)' }}>
                    {earn ? '+' : ''}{n.delta.toLocaleString()}P
                  </span>
                </div>
                {n.levelUp ? (
                  <div
                    style={{
                      marginTop: 10, padding: '8px 12px', borderRadius: 10,
                      background: 'var(--pap2)', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🎉</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>
                      LV.{n.levelUp.to} 달성! <span style={{ color: 'var(--gold)' }}>{n.levelUp.title}</span>
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
