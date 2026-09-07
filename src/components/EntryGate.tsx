'use client';

/**
 * 진입 게이트 — 온보딩 미열람이면 /onboarding, 로그인 안 됐으면 /login 으로 보낸다.
 * 판정 규칙 정본은 shared/onboarding.ts (앱 EntryGate 와 동일).
 *
 *  · 앱 인앱 WebView(임베드)는 앱이 이미 게이트를 통과한 뒤 여는 화면이므로 제외.
 *  · 세션 판정(/auth/me) 이 끝나기 전엔 SSR 콘텐츠를 그대로 두고, 미로그인이 확정되면 보낸다.
 *  · 리다이렉트 대기 중엔 전면 오버레이로 본 화면을 가려 깜빡임을 막는다.
 */
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isEmbedded } from '@/lib/embed';
import { isOnboardingSeen, resolveEntryGate, type EntryGateTarget } from '@/lib/onboarding';
import { useSession } from '@/lib/session';

export function EntryGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const [target, setTarget] = useState<EntryGateTarget>(null);

  useEffect(() => {
    if (isEmbedded()) {
      setTarget(null);
      return;
    }
    const seen = isOnboardingSeen();
    // 세션 미확정 상태에선 '로그인' 게이트를 걸지 않는다(온보딩 게이트는 로컬 플래그만 보므로 즉시).
    const authed = status !== 'unauthenticated';
    const next = resolveEntryGate({ authed, onboardingSeen: seen, pathname });
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
