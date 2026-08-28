'use client';

import { useEffect, useState } from 'react';
import { UGC_AGREE_LABEL, UGC_RULES, UGC_TERMS_INTRO, UGC_TERMS_TITLE } from '../../shared/ugcTerms';

/**
 * 커뮤니티 이용규칙(UGC EULA) 동의 게이트 — App Store 심사 지침 1.2 요건.
 * 앱 mobile/src/components/UgcTermsGate.tsx 와 페어(같은 플로우).
 *
 * 사용: 글·댓글 POST 직전에 `if (!(await ensureUgcTerms())) return;`
 *  - 서버(GET /api/me/ugc-terms)에 동의 기록이 있으면 즉시 true (세션 내 캐시)
 *  - 없으면 <UgcTermsGateHost/>(루트 레이아웃)가 모달을 띄우고, 체크+동의 → POST → true / 닫기 → false
 *  - 비로그인(401)이면 true 를 돌려 기존 로그인 게이트(401 처리)에 맡긴다.
 */

let agreedCache: boolean | null = null;
let pending: { resolve: (ok: boolean) => void } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function fetchAgreed(): Promise<boolean | null> {
  try {
    const r = await fetch('/api/me/ugc-terms', { credentials: 'include', cache: 'no-store' });
    if (r.status === 401) return null;
    // 404 = 라우트가 아직 없는 구버전 서버 — 게이트를 건너뛰어 글쓰기를 막지 않는다.
    if (r.status === 404) return null;
    if (!r.ok) return false;
    const j = (await r.json()) as { agreed?: boolean };
    return !!j.agreed;
  } catch {
    return false;
  }
}

export async function agreeUgcTerms(): Promise<boolean> {
  try {
    const r = await fetch('/api/me/ugc-terms', { method: 'POST', credentials: 'include' });
    if (!r.ok) return false;
    agreedCache = true;
    return true;
  } catch {
    return false;
  }
}

/** 로그아웃/계정 전환 시 캐시 초기화. */
export function resetUgcTermsCache() {
  agreedCache = null;
}

export async function ensureUgcTerms(): Promise<boolean> {
  if (agreedCache === true) return true;
  const agreed = await fetchAgreed();
  if (agreed === null) return true; // 비로그인 — 로그인 게이트가 처리
  if (agreed) {
    agreedCache = true;
    return true;
  }
  if (pending) return new Promise((resolve) => listeners.add(() => resolve(agreedCache === true)));
  return new Promise<boolean>((resolve) => {
    pending = { resolve };
    notify();
  });
}

function finish(ok: boolean) {
  const p = pending;
  pending = null;
  notify();
  p?.resolve(ok);
}

export function UgcTermsGateHost() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const l = () => {
      setOpen(!!pending);
      if (!pending) setChecked(false);
    };
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);

  if (!open) return null;

  const agree = async () => {
    if (!checked || busy) return;
    setBusy(true);
    const ok = await agreeUgcTerms();
    setBusy(false);
    if (ok) finish(true);
    else window.alert('동의 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={UGC_TERMS_TITLE}
      onClick={() => finish(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', background: 'var(--pap)', color: 'var(--ink)', borderRadius: '18px 18px 0 0', padding: '20px 18px 24px', boxSizing: 'border-box' }}
      >
        <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 8 }}>{UGC_TERMS_TITLE}</div>
        <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--ink2)', marginBottom: 12 }}>{UGC_TERMS_INTRO}</div>
        <ol style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12.5, lineHeight: 1.65, color: 'var(--ink)' }}>
          {UGC_RULES.map((r) => (
            <li key={r} style={{ marginBottom: 6 }}>{r}</li>
          ))}
        </ol>
        <div style={{ fontSize: 12, marginTop: 10, color: 'var(--ink3)' }}>
          전체 조항은{' '}
          <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--ink2)', textDecoration: 'underline' }}>
            이용약관 제7조의2
          </a>
          에서 확인할 수 있습니다.
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
          <span>{UGC_AGREE_LABEL}</span>
        </label>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={() => finish(false)}
            style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--pap2)', color: 'var(--ink2)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={agree}
            disabled={!checked || busy}
            style={{ flex: 2, padding: '13px 0', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--pap)', fontWeight: 900, fontSize: 14, cursor: checked ? 'pointer' : 'default', opacity: !checked || busy ? 0.45 : 1 }}
          >
            {busy ? '처리 중…' : '동의하고 계속하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
