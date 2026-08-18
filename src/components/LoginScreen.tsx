'use client';

import { signIn } from '@/lib/session';
import { useState } from 'react';
import { PixelBall } from './PixelBall';
import { ProviderLogo } from './ProviderLogo';

interface Props {
  /** 로그인 후 돌아갈 경로. 기본값 / */
  callbackUrl?: string;
  /** "로그인 없이 둘러보기" 숨김 (마이페이지 로그인 유도 카드 등에서) */
  hideSkip?: boolean;
  onSkip?: () => void;
}

type Provider = 'kakao' | 'naver' | 'google';

export function LoginScreen({ callbackUrl = '/', hideSkip, onSkip }: Props) {
  const [pending, setPending] = useState<Provider | null>(null);

  const go = (provider: Provider) => {
    if (pending) return;
    setPending(provider);
    // signIn 이 브라우저를 OAuth URL 로 navigate 시킴 → 이 페이지는 곧 언마운트됨.
    // 혹시 오류로 언마운트 전에 돌아오면 pending 해제해주기 위해 timeout 만 보험.
    signIn(provider, callbackUrl);
    setTimeout(() => setPending(null), 10_000);
  };

  const spinning = (p: Provider) => pending === p;

  return (
    <div className="login-screen">
      {pending && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,.55)',
            display: 'grid',
            placeItems: 'center',
            animation: 'pf-fade-in 150ms linear',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div
              className="pf-pokeball-spinner"
              style={{
                width: 56,
                height: 56,
                animation: 'pf-ball-spin 0.7s linear infinite',
              }}
            />
            <div style={{ color: 'var(--yel)', fontFamily: 'var(--f1)', fontSize: 10, letterSpacing: 1 }}>
              {pending === 'kakao' && '카카오 로그인 창 여는 중...'}
              {pending === 'naver' && '네이버 로그인 창 여는 중...'}
              {pending === 'google' && '구글 로그인 창 여는 중...'}
            </div>
          </div>
        </div>
      )}

      <div className="login-logo-wrap">
        <PixelBall size={72} />
        <div className="login-title">
          아르보TCG
          <br />
          한정 프로모
        </div>
        <div className="login-sub">
          성수 현장 실시간 정보 허브
          <br />
          로그인하고 제보 · 거래에 참여하세요
        </div>
      </div>
      <div className="login-divider">── 소셜 로그인 ──</div>
      <div className="login-btns">
        <button
          type="button"
          className="login-btn login-btn-kakao"
          onClick={() => go('kakao')}
          disabled={!!pending}
        >
          <div className="login-btn-icon">{spinning('kakao') ? <Spin /> : <ProviderLogo provider="kakao" />}</div>
          <div className="login-btn-txt">
            <div className="login-btn-name">카카오로 시작하기</div>
            <div className="login-btn-desc">카카오 계정으로 간편 로그인</div>
          </div>
        </button>
        <button
          type="button"
          className="login-btn login-btn-naver"
          onClick={() => go('naver')}
          disabled={!!pending}
        >
          <div className="login-btn-icon">{spinning('naver') ? <Spin /> : <ProviderLogo provider="naver" />}</div>
          <div className="login-btn-txt">
            <div className="login-btn-name">네이버로 시작하기</div>
            <div className="login-btn-desc">네이버 계정으로 간편 로그인</div>
          </div>
        </button>
        <button
          type="button"
          className="login-btn login-btn-google"
          onClick={() => go('google')}
          disabled={!!pending}
        >
          <div className="login-btn-icon">{spinning('google') ? <Spin /> : <ProviderLogo provider="google" />}</div>
          <div className="login-btn-txt">
            <div className="login-btn-name">구글로 시작하기</div>
            <div className="login-btn-desc">Google 계정으로 간편 로그인</div>
          </div>
        </button>
      </div>
      {!hideSkip && (
        <button type="button" className="login-skip" onClick={onSkip} disabled={!!pending}>
          로그인 없이 둘러보기 →
        </button>
      )}
      <div
        style={{
          position: 'relative',
          marginTop: 14,
          padding: '0 12px',
          fontFamily: 'var(--f1)',
          fontSize: 8,
          lineHeight: 1.8,
          color: 'rgba(255,255,255,.55)',
          textAlign: 'center',
          letterSpacing: 0.3,
        }}
      >
        로그인 시{' '}
        <a
          href="/terms"
          style={{ color: 'var(--yel)', textDecoration: 'underline' }}
        >
          이용약관
        </a>
        {' · '}
        <a
          href="/privacy"
          style={{ color: 'var(--yel)', textDecoration: 'underline' }}
        >
          개인정보처리방침
        </a>
        에 동의한 것으로 간주됩니다
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: 10,
          padding: '0 6px',
          fontFamily: 'var(--f1)',
          fontSize: 8,
          lineHeight: 1.7,
          color: 'rgba(255,255,255,.35)',
          textAlign: 'center',
          letterSpacing: 0.3,
        }}
      >
        Pokémon © Nintendo · Game Freak · The Pokémon Company
      </div>
    </div>
  );
}

function Spin() {
  return (
    <span
      aria-hidden
      className="pf-pokeball-spinner pf-pokeball-spinner--sm"
      style={{ animationDuration: '0.6s' }}
    />
  );
}
