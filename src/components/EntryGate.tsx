'use client';

/**
 * 진입 게이트 — 로그인 안 됐으면 /login 으로 보낸다.
 * 판정 규칙 정본은 shared/onboarding.ts (앱 EntryGate 와 동일). 웹은 온보딩 단계를
 * 건너뛴다(platform: 'web', 2026-09-08 사용자 지시) — 앱만 첫 실행에 온보딩을 띄운다.
 *
 *  · 앱 WebView도 서버에서 토큰을 검증·쿠키 교환한 뒤 동일한 세션 검사를 받는다.
 *  · 열어둔 화면에서 세션이 끊겨 API 가 401 을 주는 경우도 [[authRedirect]] 가 로그인으로 보낸다.
 *  · 세션 판정(/auth/me) 이 끝나기 전엔 SSR 콘텐츠를 그대로 두고, 미로그인이 확정되면 보낸다.
 *  · 리다이렉트 대기 중엔 전면 오버레이로 본 화면을 가려 깜빡임을 막는다.
 */
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isOnboardingSeen, resolveEntryGate, type EntryGateTarget } from '@/lib/onboarding';
import { installUnauthorizedRedirect } from '@/lib/authRedirect';
import { useSession } from '@/lib/session';

export function EntryGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const [target, setTarget] = useState<EntryGateTarget>(null);

  // 화면을 열어둔 채 세션이 끊긴 경우도 로그인으로 — 401 감시는 한 번만 설치한다.
  useEffect(() => { installUnauthorizedRedirect(); }, []);

  useEffect(() => {
    const seen = isOnboardingSeen();
    // 세션 미확정 상태에선 '로그인' 게이트를 걸지 않는다(온보딩 게이트는 로컬 플래그만 보므로 즉시).
    const authed = status !== 'unauthenticated';
    const next = resolveEntryGate({ authed, onboardingSeen: seen, pathname, platform: 'web' });
    setTarget(next);
    if (next === 'onboarding') router.replace('/onboarding');
    else if (next === 'login') router.replace(`/login?callbackUrl=${encodeURIComponent(pathname || '/')}`);
  }, [pathname, status, router]);

  if (!target) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: target === 'onboarding' ? '#ffffff' : 'var(--paper)',
      }}
    />
  );
}
