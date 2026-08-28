'use client';

import { useEffect, useState } from 'react';
import { ReportMenu } from '@/components/ReportMenu';
import { ensureUgcTerms } from '@/components/UgcTermsGate';

interface EventComment {
  id: number;
  text: string;
  authorId?: string | null;
  authorName: string;
  createdAt: string;
}

/**
 * 이벤트 글 댓글 — 피드 댓글(FeedRow)과 동일한 미니멀 구성.
 * 목록은 마운트 시 로드, 작성은 로그인 필수(401 → 안내 문구).
 */
export function EventComments({ postId }: { postId: number }) {
  const [comments, setComments] = useState<EventComment[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/events/${postId}/comments`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j: { data?: EventComment[] }) => {
        if (alive) setComments(j.data ?? []);
      })
      .catch(() => {
        if (alive) setComments([]);
      });
    return () => {
      alive = false;
    };
  }, [postId]);

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    if (!(await ensureUgcTerms())) return; // 커뮤니티 이용규칙 동의 게이트
    setSending(true);
    setHint(null);
    try {
      const r = await fetch(`/api/events/${postId}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      if (r.status === 401) {
        setHint('댓글을 쓰려면 로그인해주세요');
        return;
      }
      if (!r.ok) {
        setHint('등록에 실패했어요. 잠시 후 다시 시도해주세요');
        return;
      }
      const j = (await r.json()) as { data: EventComment };
      setComments((prev) => [...(prev ?? []), j.data]);
      setText('');
    } catch {
      setHint('등록에 실패했어요. 잠시 후 다시 시도해주세요');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div
        style={{
          fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)',
          letterSpacing: 0.2, marginBottom: 7,
        }}
      >
        댓글 {comments ? comments.length : '…'}
      </div>
      {comments && comments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 9 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'baseline', minWidth: 0 }}>
              <span style={{ fontFamily: 'var(--f1)', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {c.authorName}
              </span>
              <span style={{ fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--ink2)', lineHeight: 1.6, wordBreak: 'break-word', flex: 1, minWidth: 0 }}>
                {c.text}
              </span>
              <ReportMenu targetType="eventPostComment" targetId={c.id} authorId={c.authorId} authorName={c.authorName} size={13} />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          value={text}
          maxLength={300}
          placeholder="댓글 달기…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          style={{
            flex: 1, minWidth: 0, padding: '9px 14px',
            background: 'var(--pap2)', border: 'none', borderRadius: 999,
            fontFamily: 'var(--f1)', fontSize: 12, outline: 'none',
            boxShadow: 'none', color: 'var(--ink)',
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || !text.trim()}
          style={{
            flexShrink: 0, padding: '6px 2px',
            background: 'none', border: 'none',
            color: 'var(--blu)', fontFamily: 'var(--f1)',
            fontSize: 12, fontWeight: 700,
            opacity: sending || !text.trim() ? 0.4 : 1,
            cursor: 'pointer',
          }}
        >
          등록
        </button>
      </div>
      {hint && (
        <div style={{ marginTop: 6, fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--red)' }}>
          {hint}
        </div>
      )}
    </div>
  );
}
