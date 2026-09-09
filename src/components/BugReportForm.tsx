'use client';

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { APP_VERSION } from '../../shared/version';

/**
 * 버그 제보 폼 — 제목·내용·연락처(선택)를 서버(/api/me/bug-reports)로 보낸다.
 * 접수된 제보는 어드민 대시보드에서만 열람한다(다른 사용자에게 노출 없음).
 * 앱 mobile/app/my/bug-report.tsx 와 같은 필드·같은 엔드포인트.
 */
export function BugReportForm() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (title.trim().length < 2) return toast.error('제목을 2자 이상 입력해 주세요');
    if (content.trim().length < 5) return toast.error('내용을 5자 이상 입력해 주세요');
    setBusy(true);
    try {
      const r = await fetch('/api/me/bug-reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          contact: contact.trim() || null,
          platform: 'web',
          appVersion: APP_VERSION,
        }),
      });
      if (r.status === 401) {
        toast.error('로그인이 필요해요');
        return;
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `HTTP ${r.status}`);
      }
      setDone(true);
      setTitle('');
      setContent('');
      setContact('');
      toast.success('제보가 접수되었습니다. 감사합니다!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '전송에 실패했어요');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '4px var(--gap) 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontFamily: 'var(--f1)', fontSize: 12.5, lineHeight: 1.7, color: 'var(--ink3)', margin: 0 }}>
        앱·웹에서 발견한 오류나 이상한 점을 알려주세요. 어떤 화면에서 무엇을 했을 때 생겼는지 적어주시면
        빠르게 고칠 수 있어요. 접수된 제보는 운영자만 확인합니다.
      </p>

      <Field label="제목">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 100))}
          placeholder="예) 시세 상세에서 가격이 안 보여요"
          style={inputStyle}
        />
      </Field>

      <Field label="내용">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 4000))}
          placeholder={'어떤 화면에서 / 무엇을 눌렀을 때 / 어떻게 됐는지\n(기기·OS 버전을 함께 적어주시면 더 좋아요)'}
          rows={8}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
      </Field>

      <Field label="답장 받을 연락처 (선택)">
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value.slice(0, 120))}
          placeholder="이메일 또는 카카오 ID"
          style={inputStyle}
        />
      </Field>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        style={{
          marginTop: 4, height: 50, borderRadius: 14, border: 'none', cursor: busy ? 'default' : 'pointer',
          background: busy ? 'var(--pap3)' : 'var(--ink)', color: busy ? 'var(--ink3)' : 'var(--white)',
          fontFamily: 'var(--f1)', fontSize: 15, fontWeight: 800,
        }}
      >
        {busy ? '보내는 중…' : '제보 보내기'}
      </button>

      {done && (
        <div style={{ fontFamily: 'var(--f1)', fontSize: 12.5, fontWeight: 700, color: 'var(--grn, #2BB673)', textAlign: 'center' }}>
          접수되었습니다. 확인 후 반영할게요!
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'var(--f1)', fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--white)',
  border: '1.5px solid var(--pap3)',
  borderRadius: 12,
  padding: '11px 13px',
  fontFamily: 'var(--f1)',
  fontSize: 13.5,
  fontWeight: 600,
  color: 'var(--ink)',
  outline: 'none',
};
