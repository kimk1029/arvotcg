'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * 커뮤니티 글 목록 — 체크박스 다중 선택 삭제 + 전체 초기화.
 * 삭제는 DELETE /api/feeds ({ ids } | { all: true }) 한 곳으로 모은다.
 */

export interface FeedRow {
  id: number;
  text: string;
  category: string | null;
  author: string | null;
  createdAt: string;
}

export function FeedBulkTable({ rows, total }: { rows: FeedRow[]; total: number }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const selected = rows.filter((r) => checked[r.id]).map((r) => r.id);
  const allOnPage = rows.length > 0 && selected.length === rows.length;

  const toggleAll = () => {
    if (allOnPage) return setChecked({});
    const next: Record<number, boolean> = {};
    for (const r of rows) next[r.id] = true;
    setChecked(next);
  };

  const run = async (payload: { ids: number[] } | { all: true }, confirmText: string) => {
    if (!confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/feeds', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { count?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setChecked({});
      setMsg({ type: 'ok', text: `${body.count ?? 0}건 삭제됨` });
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '삭제 실패' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {msg && (
        <div
          style={{
            padding: '9px 12px', borderRadius: 6, fontSize: 12, marginBottom: 10,
            background: msg.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
            color: msg.type === 'ok' ? '#047857' : '#B91C1C',
          }}
        >
          {msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy || selected.length === 0}
          onClick={() => run({ ids: selected }, `선택한 ${selected.length}건을 삭제할까요? 되돌릴 수 없습니다.`)}
        >
          선택 삭제 {selected.length > 0 ? `(${selected.length})` : ''}
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy || total === 0}
          onClick={() =>
            run(
              { all: true },
              `커뮤니티 글 전체(${total.toLocaleString()}건)를 삭제합니다.\n댓글·북마크도 함께 사라지며 되돌릴 수 없습니다.\n\n정말 초기화할까요?`,
            )
          }
        >
          ⚠ 커뮤니티 글 전체 초기화
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty">결과 없음</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="이 페이지 전체 선택" />
              </th>
              <th>#</th>
              <th>분류</th>
              <th>본문</th>
              <th>작성자</th>
              <th>시각</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} style={{ background: checked[f.id] ? '#EFF6FF' : undefined }}>
                <td>
                  <input
                    type="checkbox"
                    checked={!!checked[f.id]}
                    onChange={(e) => setChecked((c) => ({ ...c, [f.id]: e.target.checked }))}
                    aria-label={`글 ${f.id} 선택`}
                  />
                </td>
                <td className="mono">{f.id}</td>
                <td className="muted">{f.category ?? '—'}</td>
                <td>{f.text}</td>
                <td>{f.author ?? <span className="muted">(탈퇴/익명)</span>}</td>
                <td className="mono muted">{f.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
