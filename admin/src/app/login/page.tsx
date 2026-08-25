'use client';

/**
 * 어드민 로그인 — Basic Auth 브라우저 팝업 대체. 성공 시 세션 쿠키 발급 후 대시보드로.
 * 입력은 uncontrolled + FormData 로 읽는다 — 브라우저 자동완성 값이 React 상태에
 * 안 잡혀 버튼이 죽어 보이던 문제(반응 없음) 방지. 버튼은 항상 활성, 검증은 제출 시.
 */
import { useState, type FormEvent } from 'react';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const fd = new FormData(e.currentTarget);
    const username = String(fd.get('username') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    if (!username || !password) {
      setError('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setBusy(true);
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (r.ok) {
        // 클라이언트 라우터 대신 풀 리로드 — 미들웨어가 새 쿠키로 확실히 재평가.
        window.location.replace('/');
        return;
      }
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error ?? `로그인 실패 (HTTP ${r.status}) — 잠시 후 다시 시도해 주세요.`);
    } catch {
      setError('서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="login-logo">A</span>
          <div>
            <div className="login-title">ARVOTCG Admin</div>
            <div className="login-sub">운영 콘솔에 로그인하세요</div>
          </div>
        </div>
        <label className="login-label">
          아이디
          <input className="login-input" name="username" autoComplete="username" autoFocus />
        </label>
        <label className="login-label">
          비밀번호
          <input className="login-input" name="password" type="password" autoComplete="current-password" />
        </label>
        {error ? <div className="login-error">{error}</div> : null}
        <button className="login-btn" type="submit" disabled={busy}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}
