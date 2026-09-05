'use client';

import { signIn } from '@/lib/session';
import { PixelBall } from './PixelBall';
import { ProviderLogo } from './ProviderLogo';
import { AppBar } from './ui/AppBar';
import { StatusBar } from './ui/StatusBar';

interface Props {
  title?: string;
  message?: string;
  /** 로그인 완료 후 돌아올 경로 */
  callbackUrl?: string;
}

export function LoginRequired({
  title = '로그인이 필요해요',
  message = '제보 · 거래 · 피드 작성은 로그인 후 이용 가능합니다',
  callbackUrl = '/',
}: Props) {
  return (
    <>
      <StatusBar />
      <AppBar title={title} showBack />
      <div className="sect" style={{ marginTop: 24, textAlign: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            padding: '28px 16px',
          }}
        >
          <PixelBall size={60} />
          <div
            style={{
              fontFamily: 'var(--f1)',
              fontSize: 14,
              letterSpacing: 1,
              lineHeight: 1.8,
            }}
          >
            로그인 해주세요
          </div>
          <div
            style={{
              fontFamily: 'var(--f1)',
              fontSize: 10,
              color: 'var(--ink3)',
              lineHeight: 1.8,
            }}
          >
            {message}
          </div>
        </div>

        <div className="login-btns" style={{ position: 'relative', padding: '0 8px' }}>
          <button
            type="button"
            className="login-btn login-btn-google"
            onClick={() => signIn('google', callbackUrl)}
          >
            <div className="login-btn-icon"><ProviderLogo provider="google" /></div>
            <div className="login-btn-txt">
              <div className="login-btn-name">구글로 시작하기</div>
              <div className="login-btn-desc">Google 계정으로 간편 로그인</div>
            </div>
          </button>
          <button
            type="button"
            className="login-btn login-btn-kakao"
            onClick={() => signIn('kakao', callbackUrl)}
          >
            <div className="login-btn-icon"><ProviderLogo provider="kakao" /></div>
            <div className="login-btn-txt">
              <div className="login-btn-name">카카오로 시작하기</div>
              <div className="login-btn-desc">카카오 계정으로 간편 로그인</div>
            </div>
          </button>
          {/* 네이버 — 현재 비활성(준비 중). 순서상 맨 아래. */}
          <button
            type="button"
            className="login-btn login-btn-naver login-btn-off"
            disabled
            aria-disabled="true"
          >
            <div className="login-btn-icon"><ProviderLogo provider="naver" /></div>
            <div className="login-btn-txt">
              <div className="login-btn-name">네이버로 시작하기</div>
              <div className="login-btn-desc">준비 중입니다</div>
            </div>
          </button>
        </div>
      </div>
      <div className="bggap" />
    </>
  );
}
