'use client';

/**
 * 로그인 화면 — Claude Design 'ARVO 로그인' (앱 app/login.tsx 와 동일 디자인).
 * 다크 네이비 그라디언트 + 앰비언트 글로우 + 스파크, 히어로 문구, 소셜 버튼 4종.
 *  · 카카오 / 구글: 서버 OAuth (signIn).
 *  · 네이버: 준비 중 — 비활성 (서버 프로바이더 미설정).
 *  · Apple: 웹 OAuth 라우트가 없어 iOS 앱에서만 노출 (플랫폼 예외).
 * 뒤로가기 화살표는 온보딩으로. '둘러보기' 는 로그인 필수 정책으로 없음 (shared/onboarding.ts).
 */
import Link from 'next/link';
import { useState } from 'react';
import { signIn } from '@/lib/session';
import { ProviderLogo } from './ProviderLogo';

interface Props {
  /** 로그인 후 돌아갈 경로. 기본값 / */
  callbackUrl?: string;
  /** @deprecated 둘러보기 버튼이 없어져 무시된다(호환용). */
  hideSkip?: boolean;
  /** @deprecated 둘러보기 버튼이 없어져 무시된다(호환용). */
  onSkip?: () => void;
}

type Provider = 'kakao' | 'naver' | 'google';

const SPARKS: Array<{ top: number; left?: number; right?: number; size: number; color: string; dur: number; delay: number }> = [
  { top: 140, left: 52, size: 5, color: '#FFD27A', dur: 2.6, delay: 0 },
  { top: 112, right: 66, size: 4, color: '#FFD27A', dur: 3.1, delay: 0.8 },
  { top: 342, right: 44, size: 3, color: '#7CE0FF', dur: 2.2, delay: 0.4 },
  { top: 318, left: 38, size: 3, color: '#B27CFF', dur: 2.9, delay: 1.2 },
  { top: 400, left: 120, size: 3, color: '#FFD27A', dur: 3.4, delay: 0.6 },
];

export function LoginScreen({ callbackUrl = '/' }: Props) {
  const [pending, setPending] = useState<Provider | null>(null);

  const go = (provider: Provider) => {
    if (pending) return;
    setPending(provider);
    // signIn 이 브라우저를 OAuth URL 로 navigate 시킴 → 이 페이지는 곧 언마운트됨.
    // 혹시 오류로 언마운트 전에 돌아오면 pending 해제해주기 위해 timeout 만 보험.
    signIn(provider, callbackUrl);
    setTimeout(() => setPending(null), 10_000);
  };

  return (
    <div className="lg-screen">
      {/* 앰비언트 글로우 */}
      <div className="lg-glow-top" />
      <div className="lg-glow-bottom" />
      {/* 스파크 */}
      {SPARKS.map((s, n) => (
        <div
          key={n}
          className="lg-spark"
          style={{
            top: s.top,
            left: s.left,
            right: s.right,
            width: s.size,
            height: s.size,
            background: s.color,
            boxShadow: s.size > 3 || n === 2 || n === 3 ? `0 0 ${s.size * 2 + 2}px ${s.color}` : undefined,
            animation: `lgSpark ${s.dur}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}

      {pending && (
        <div aria-hidden className="lg-pending">
          <div className="lg-spinner" />
          <div style={{ color: '#FFD27A', fontSize: 12, fontWeight: 700 }}>
            {pending === 'kakao' && '카카오 로그인 창 여는 중...'}
            {pending === 'naver' && '네이버 로그인 창 여는 중...'}
            {pending === 'google' && '구글 로그인 창 여는 중...'}
          </div>
        </div>
      )}

      {/* 뒤로 (온보딩) */}
      <div className="lg-top">
        <Link href="/onboarding" aria-label="온보딩으로" className="lg-back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
        </Link>
      </div>

      {/* 히어로 */}
      <div className="lg-hero">
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>
          <span style={{ color: '#fff' }}>ARVO</span>
          <span className="lg-grad-text"> TCG</span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: -0.8, marginTop: 30, textAlign: 'center', lineHeight: 1.3 }}>
          내 컬렉션의 가치를<br />한눈에
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', fontWeight: 500, marginTop: 12, textAlign: 'center', lineHeight: 1.6 }}>
          시세 · 컬렉션 · 커뮤니티<br />간편 로그인으로 3초 만에 시작하세요
        </div>
      </div>

      {/* 소셜 버튼 */}
      <div className="lg-btns">
        <button type="button" className="lg-btn" style={{ background: '#FEE500' }} onClick={() => go('kakao')} disabled={!!pending}>
          <span className="lg-btn-ic"><ProviderLogo provider="kakao" /></span>
          <span style={{ color: '#191919' }}>카카오로 계속하기</span>
        </button>
        {/* 네이버 — 준비 중(서버 프로바이더 미설정). 디자인 자리는 유지하고 비활성. */}
        <button type="button" className="lg-btn lg-btn-off" style={{ background: '#03C75A' }} disabled aria-disabled="true">
          <span className="lg-btn-ic" style={{ color: '#fff', fontSize: 17, fontWeight: 900, lineHeight: 1 }}>N</span>
          <span style={{ color: '#fff' }}>네이버로 계속하기 · 준비 중</span>
        </button>
        <button type="button" className="lg-btn" style={{ background: '#fff' }} onClick={() => go('google')} disabled={!!pending}>
          <span className="lg-btn-ic"><ProviderLogo provider="google" /></span>
          <span style={{ color: '#16161a' }}>Google로 계속하기</span>
        </button>
        {/* Apple — 웹 OAuth 라우트 없음 → iOS 앱에서만 (플랫폼 예외). */}
      </div>

      {/* 푸터 */}
      <div className="lg-footer">
        계속하면{' '}
        <Link href="/terms" className="lg-footer-link">이용약관</Link>
        {' · '}
        <Link href="/privacy" className="lg-footer-link">개인정보 처리방침</Link>
        에 동의하게 됩니다
      </div>
    </div>
  );
}
