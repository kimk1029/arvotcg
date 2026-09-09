'use client';

import { Fragment, useState } from 'react';

export interface BugReportRow {
  id: number;
  title: string;
  content: string;
  platform: string | null;
  appVersion: string | null;
  contact: string | null;
  status: string;
  createdAt: string;
  reporter: string | null;
  reporterEmail: string | null;
  reporterId: string | null;
}

const PLATFORM_LABEL: Record<string, string> = { web: '💻 웹', ios: ' iOS', android: '🤖 AOS' };

/** 버그 제보 목록 — 행을 누르면 내용 펼침, 상태(미처리/완료) 토글. */
export function BugReportTable({ rows }: { rows: BugReportRow[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [statusMap, setStatusMap] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const toggleStatus = async (r: BugReportRow) => {
    const cur = statusMap[r.id] ?? r.status;
    const next = cur === 'done' ? 'open' : 'done';
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/bug-reports/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatusMap((m) => ({ ...m, [r.id]: next }));
    } catch {
      window.alert('상태 변경에 실패했어요.');
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0) return <div className="empty">접수된 제보가 없습니다.</div>;

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>#</th>
          <th>제목</th>
          <th>제보자</th>
          <th>환경</th>
          <th>버전</th>
          <th>연락처</th>
          <th>상태</th>
          <th>접수</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const status = statusMap[r.id] ?? r.status;
          const open = openId === r.id;
          return (
            <Fragment key={r.id}>
              <tr onClick={() => setOpenId(open ? null : r.id)} style={{ cursor: 'pointer' }}>
                <td className="mono muted">{r.id}</td>
                <td style={{ fontWeight: 700 }}>{r.title}</td>
                <td>
                  {r.reporter ?? <span className="muted">탈퇴</span>}
                  {r.reporterEmail && <div className="mono muted" style={{ fontSize: 10 }}>{r.reporterEmail}</div>}
                </td>
                <td>{r.platform ? PLATFORM_LABEL[r.platform] ?? r.platform : <span className="muted">-</span>}</td>
                <td className="mono muted" style={{ fontSize: 11 }}>{r.appVersion ?? '-'}</td>
                <td className="mono" style={{ fontSize: 11 }}>{r.contact ?? <span className="muted">-</span>}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    disabled={busyId === r.id}
                    onClick={(e) => { e.stopPropagation(); void toggleStatus(r); }}
                    style={status === 'done' ? { background: '#129782', borderColor: '#129782', color: '#fff' } : undefined}
                  >
                    {busyId === r.id ? '…' : status === 'done' ? '✅ 완료' : '미처리'}
                  </button>
                </td>
                <td className="mono muted">{r.createdAt}</td>
              </tr>
              {open && (
                <tr>
                  <td colSpan={8} style={{ background: '#F8FAFC', whiteSpace: 'pre-wrap', lineHeight: 1.7, padding: '12px 14px' }}>
                    {r.content}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
