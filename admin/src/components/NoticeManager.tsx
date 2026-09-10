'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NOTICE_TAGS, type NoticeTag } from '@/lib/notices';

export interface NoticeData {
  id: number;
  title: string;
  body: string;
  tag: string | null;
  pinned: boolean;
  published: boolean;
  publishedAt: string;
  createdAt: string;
}

type Draft = Omit<NoticeData, 'id' | 'createdAt'> & { id: number | null };

const TAG_LABEL: Record<NoticeTag, string> = {
  update: 'UPDATE (기능/데이터 변경)',
  event: 'EVENT (이벤트/오픈)',
  maintenance: '점검 (서비스 중단)',
};

const TAG_CHIP: Record<NoticeTag, string> = {
  update: '#10B981',
  event: '#EF4444',
  maintenance: '#1E293B',
};

function todayKst(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function emptyDraft(): Draft {
  return { id: null, title: '', body: '', tag: null, pinned: false, published: true, publishedAt: todayKst() };
}

export function NoticeManager({ initialNotices }: { initialNotices: NoticeData[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const startEdit = (n: NoticeData) => { setEditingId(n.id); setDraft({ ...n }); setMsg(null); };
  const startNew = () => { setEditingId('new'); setDraft(emptyDraft()); setMsg(null); };
  const cancel = () => { setEditingId(null); setDraft(emptyDraft()); };

  const save = async () => {
    setBusy(true); setMsg(null);
    const isNew = editingId === 'new';
    const url = isNew ? '/api/notices' : `/api/notices/${draft.id}`;
    const payload = {
      title: draft.title,
      body: draft.body,
      tag: draft.tag || null,
      pinned: draft.pinned,
      published: draft.published,
      publishedAt: draft.publishedAt,
    };
    try {
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: isNew ? '등록됨' : '저장됨' });
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '저장 실패' });
    } finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!confirm('이 공지를 삭제할까요? 되돌릴 수 없습니다.')) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/notices/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: '삭제됨' });
      if (editingId === id) cancel();
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '삭제 실패' });
    } finally { setBusy(false); }
  };

  const patch = async (id: number, data: Record<string, unknown>, failText: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/notices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : failText });
    } finally { setBusy(false); }
  };

  const seed = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/notices/seed', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: `${body.created ?? 0}건 불러옴` });
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '불러오기 실패' });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msg && (
        <div style={{
          padding: '9px 12px', borderRadius: 6, fontSize: 12,
          background: msg.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
          color: msg.type === 'ok' ? '#047857' : '#B91C1C',
        }}>
          {msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#64748B' }}>총 {initialNotices.length}개</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {initialNotices.length === 0 && (
            <button type="button" onClick={seed} disabled={busy} style={smBtn('#64748B')}>
              기존 공지 2건 불러오기
            </button>
          )}
          <button type="button" onClick={startNew} disabled={busy || editingId !== null} style={primaryBtn}>
            + 공지 작성
          </button>
        </div>
      </div>

      {editingId === 'new' && (
        <section className="card">
          <h2>새 공지</h2>
          <NoticeForm draft={draft} setDraft={setDraft} />
          <FormActions onSave={save} onCancel={cancel} busy={busy} />
        </section>
      )}

      {initialNotices.map((n) => {
        const isEditing = editingId === n.id;
        const tag = n.tag && (NOTICE_TAGS as readonly string[]).includes(n.tag) ? (n.tag as NoticeTag) : null;
        return (
          <section key={n.id} className="card" style={{ opacity: n.published ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {n.pinned && <span style={{ ...chip, background: '#F59E0B' }}>📌 고정</span>}
                <span style={{ ...chip, background: n.published ? '#10B981' : '#94A3B8' }}>
                  {n.published ? '공개' : '비공개'}
                </span>
                {tag && <span style={{ ...chip, background: TAG_CHIP[tag] }}>{tag.toUpperCase()}</span>}
                <span style={{ fontSize: 11, color: '#94A3B8' }}>{n.publishedAt}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => patch(n.id, { pinned: !n.pinned }, '고정 변경 실패')} disabled={busy} style={smBtn('#F59E0B')}>
                  {n.pinned ? '고정 해제' : '고정'}
                </button>
                <button type="button" onClick={() => patch(n.id, { published: !n.published }, '상태 변경 실패')} disabled={busy} style={smBtn('#64748B')}>
                  {n.published ? '숨김' : '공개'}
                </button>
                <button type="button" onClick={() => (isEditing ? cancel() : startEdit(n))} disabled={busy || (editingId !== null && !isEditing)} style={smBtn('#3B82F6')}>
                  {isEditing ? '닫기' : '수정'}
                </button>
                <button type="button" onClick={() => remove(n.id)} disabled={busy} style={smBtn('#EF4444')}>
                  삭제
                </button>
              </div>
            </div>

            <div style={{ fontSize: 12, lineHeight: 1.6, marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{n.title}</div>
              <div style={{ color: '#475569', whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {n.body}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: '#94A3B8' }}>
                등록 {n.createdAt.slice(0, 10)} · 웹:{' '}
                <a href="https://www.arvotcg.com/my/notices" target="_blank" rel="noreferrer">
                  arvotcg.com/my/notices
                </a>
              </div>
            </div>

            {isEditing && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #E2E8F0' }}>
                <NoticeForm draft={draft} setDraft={setDraft} />
                <FormActions onSave={save} onCancel={cancel} busy={busy} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FormActions({ onSave, onCancel, busy }: { onSave: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
      <button type="button" onClick={onSave} disabled={busy} style={primaryBtn}>
        {busy ? '저장 중…' : '저장'}
      </button>
      <button type="button" onClick={onCancel} disabled={busy} style={smBtn('#64748B')}>
        취소
      </button>
    </div>
  );
}

function NoticeForm({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 150px 1fr', gap: 12 }}>
        <Field label="태그 배지">
          <select value={draft.tag ?? ''} onChange={(e) => setDraft({ ...draft, tag: e.target.value || null })} style={inp}>
            <option value="">없음</option>
            {NOTICE_TAGS.map((t) => (
              <option key={t} value={t}>{TAG_LABEL[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="발행일 (목록 표시·정렬)">
          <input type="date" value={draft.publishedAt} onChange={(e) => setDraft({ ...draft, publishedAt: e.target.value })} style={inp} />
        </Field>
        <Field label="제목">
          <input type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={inp} />
        </Field>
      </div>
      <Field label="본문 (줄바꿈 ⏎ 그대로 노출)">
        <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={6} style={{ ...inp, resize: 'vertical' }} />
      </Field>
      <div style={{ display: 'flex', gap: 18 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} />
          목록 상단 고정
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />
          공개 (웹·앱 노출)
        </label>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 9px', fontSize: 13, color: '#1A1A1A',
  background: '#fff', border: '1px solid #CBD5E1', borderRadius: 6, outline: 'none', boxSizing: 'border-box',
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#fff',
  background: '#3B82F6', border: 'none', borderRadius: 6, cursor: 'pointer',
};
function smBtn(bg: string): React.CSSProperties {
  return { padding: '5px 10px', fontSize: 12, color: '#fff', background: bg, border: 'none', borderRadius: 6, cursor: 'pointer' };
}
const chip: React.CSSProperties = {
  fontSize: 11, padding: '3px 7px', borderRadius: 4, background: '#1E293B', color: '#fff', lineHeight: 1,
};
