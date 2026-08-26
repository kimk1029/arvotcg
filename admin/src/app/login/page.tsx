'use client';

/**
 * 어드민 로그인 — Basic Auth 브라우저 팝업 대체. 성공 시 세션 쿠키 발급 후 대시보드로.
 * 입력은 uncontrolled + FormData 로 읽는다 — 브라우저 자동완성 값이 React 상태에
 * 안 잡혀 버튼이 죽어 보이던 문제(반응 없음) 방지. 버튼은 항상 활성, 검증은 제출 시.
 */
import { useEffect, useState, type FormEvent } from 'react';

// 소셜 로그인 — API 서버가 OAuth 후 권한을 확인하고 /api/oauth 로 되돌려준다.
// (Apple 은 웹에서 별도 Services ID 도메인 검증이 필요해 앱 전용 — 여기선 제외)
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'https://api.arvotcg.com';
const SOCIALS = [
  { id: 'kakao', label: '카카오로 로그인', bg: '#FEE500', fg: '#3A1D00' },
  { id: 'naver', label: '네이버로 로그인', bg: '#03C75A', fg: '#FFFFFF' },
  { id: 'google', label: 'Google로 로그인', bg: '#FFFFFF', fg: '#1F1F1F' },
];

const OAUTH_ERRORS: Record<string, string> = {
  forbidden: '이 계정에는 관리자 권한이 없습니다. 관리자에게 권한 부여를 요청해 주세요.',
  invalid: '로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.',
  notoken: '로그인이 완료되지 않았습니다. 다시 시도해 주세요.',
  apidown: 'API 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
};

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 소셜 로그인 실패 사유(?error=)를 화면에 표시.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError(OAUTH_ERRORS[code] ?? `로그인에 실패했습니다. (${code})`);
  }, []);

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

        <div className="login-divider"><span>또는 소셜 계정으로</span></div>
        <div className="login-socials">
          {SOCIALS.map((s) => (
            <a
              key={s.id}
              className="login-social"
              style={{ background: s.bg, color: s.fg }}
              href={`${API_ORIGIN}/auth/${s.id}?platform=admin`}
            >
              {s.label}
            </a>
          ))}
        </div>
        <p className="login-hint">
          관리자 권한이 부여된 계정만 소셜 로그인으로 접근할 수 있어요.
        </p>
      </form>
    </div>
  );
}
