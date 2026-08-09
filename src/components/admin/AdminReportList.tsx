'use client';

import { useState } from 'react';

/**
 * 어드민 신고 목록 — 상태 탭(접수/조치됨/기각/전체) + 행별 조치 버튼.
 * 조치: 콘텐츠 삭제(대상 행 삭제 + 동일 대상 신고 일괄 resolved) / 기각 / 다시 열기.
 * 하단에 최근 차단 현황(참고용) 표시.
 */

export interface AdminReportRow {
  id: number;
  targetType: string;
  targetId: string;
  reason: string;
  detail: string | null;
  snapshot: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; name: string } | null;
  targetUser: { id: string; name: string } | null;
}

export interface AdminBlockRow {
  id: number;
  createdAt: string;
  blocker: { id: string; name: string } | null;
  blocked: { id: string; name: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  trade: '거래글',
  feed: '피드',
  feedComment: '피드 댓글',
  eventPost: '이벤트 글',
  eventPostComment: '이벤트 댓글',
};

const STATUS_TABS = [
  { key: 'open', lb: '접수' },
  { key: 'resolved', lb: '조치됨' },
  { key: 'dismissed', lb: '기각' },
  { key: 'all', lb: '전체' },
] as const;

const STATUS_LABEL: Record<string, string> = { open: '접수', resolved: '조치됨', dismissed: '기각' };
const STATUS_COLOR: Record<string, string> = { open: '#F5333F', resolved: '#12B76A', dismissed: '#8E8E93' };

export function AdminReportList({
  initialReports,
  initialCounts,
  blocks,
}: {
  initialReports: AdminReportRow[];
  initialCounts: Record<string, number>;
  blocks: AdminBlockRow[];
}) {
  const [tab, setTab] = useState<string>('open');
  const [reports, setReports] = useState(initialReports);
  const [counts, setCounts] = useState(initialCounts);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async (status: string) => {
    setTab(status);
    try {
      const r = await fetch(`/api/admin/reports?status=${status}`, { credentials: 'include', cache: 'no-store' });
      const j = (await r.json()) as { data?: AdminReportRow[]; counts?: Record<string, number> };
      setReports(j.data ?? []);
      setCounts(j.counts ?? {});
    } catch {
      window.alert('목록을 불러오지 못했어요.');
    }
  };

  const patchStatus = async (id: number, status: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error();
      await load(tab);
    } catch {
      window.alert('상태 변경에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  const removeTarget = async (row: AdminReportRow) => {
    if (busyId) return;
    const label = TYPE_LABEL[row.targetType] ?? row.targetType;
    if (!window.confirm(`신고된 ${label} #${row.targetId} 콘텐츠를 삭제할까요?\n삭제 후 같은 대상의 모든 접수 신고가 '조치됨' 처리됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
    setBusyId(row.id);
    try {
      const r = await fetch(`/api/admin/reports/${row.id}/target`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error();
      await load(tab);
    } catch {
      window.alert('콘텐츠 삭제에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  const btn: React.CSSProperties = {
    fontSize: 11.5, fontWeight: 800, borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
    border: '1px solid var(--border)', background: 'var(--pap2)', color: 'var(--ink2)',
  };

  return (
    <div className="sect" style={{ padding: '0 16px' }}>
      {/* 상태 탭 */}
      <div style={{ display: 'flex', gap: 6, padding: '4px 0 12px' }}>
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => load(t.key)}
            style={{
              ...btn,
              background: tab === t.key ? 'var(--ink)' : 'var(--pap2)',
              color: tab === t.key ? '#fff' : 'var(--ink2)',
            }}
          >
            {t.lb}
            {t.key !== 'all' && counts[t.key] != null ? ` ${counts[t.key]}` : ''}
          </button>
        ))}
      </div>

      {reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink3)', fontSize: 13 }}>
          해당 상태의 신고가 없어요.
        </div>
      ) : (
        reports.map((r) => (
          <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', marginBottom: 10, background: 'var(--pap)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: STATUS_COLOR[r.status] ?? '#8E8E93', borderRadius: 6, padding: '2px 7px' }}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>
                {TYPE_LABEL[r.targetType] ?? r.targetType} #{r.targetId}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{new Date(r.createdAt).toLocaleString('ko-KR')}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 7 }}>
              사유: <b>{r.reason}</b>
              {r.detail && <span style={{ color: 'var(--ink2)' }}> — {r.detail}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 4 }}>
              신고자 {r.reporter?.name ?? '탈퇴'} · 작성자 {r.targetUser?.name ?? '(익명/탈퇴)'}
            </div>
            {r.snapshot && (
              <div style={{ fontSize: 12, color: 'var(--ink2)', background: 'var(--pap2)', borderRadius: 8, padding: '8px 10px', marginTop: 8, lineHeight: 1.55, wordBreak: 'break-word' }}>
                {r.snapshot}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {r.status === 'open' ? (
                <>
                  <button type="button" style={{ ...btn, background: '#F5333F', borderColor: '#F5333F', color: '#fff' }} disabled={busyId === r.id} onClick={() => removeTarget(r)}>
                    콘텐츠 삭제 (조치)
                  </button>
                  <button type="button" style={btn} disabled={busyId === r.id} onClick={() => patchStatus(r.id, 'dismissed')}>
                    문제 없음 (기각)
                  </button>
                </>
              ) : (
                <button type="button" style={btn} disabled={busyId === r.id} onClick={() => patchStatus(r.id, 'open')}>
                  다시 열기
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {/* 차단 현황 (참고) */}
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', padding: '18px 0 8px' }}>최근 차단 현황 (최근 100건)</div>
      {blocks.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--ink3)', paddingBottom: 16 }}>차단 내역이 없어요.</div>
      ) : (
        blocks.map((b) => (
          <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--ink2)', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{b.blocker?.name ?? '탈퇴'}</span>
            <span>→</span>
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{b.blocked?.name ?? '탈퇴'}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--ink3)', fontSize: 11 }}>{new Date(b.createdAt).toLocaleDateString('ko-KR')}</span>
          </div>
        ))
      )}
    </div>
  );
}
