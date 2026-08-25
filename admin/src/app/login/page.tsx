'use client';

/** 어드민 로그인 — Basic Auth 브라우저 팝업 대체. 성공 시 세션 쿠키 발급 후 대시보드로. */
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (r.ok) {
        router.replace('/');
        router.refresh();
        return;
      }
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error ?? '로그인에 실패했습니다.');
    } catch {
      setError('서버에 연결할 수 없습니다.');
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
          <input
            className="login-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="login-label">
          비밀번호
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="login-error">{error}</div> : null}
        <button className="login-btn" type="submit" disabled={busy || !username || !password}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}
