/**
 * 진입 게이트 — 온보딩 미열람이면 /onboarding, 로그인 안 됐으면 /login 으로 보낸다.
 * 판정 규칙 정본은 shared/onboarding.ts (웹 EntryGate 와 동일).
 *
 * Slot(라우터)은 항상 마운트해 두고(언마운트하면 router.replace 가 동작하지 않는다),
 * 게이트가 걸린 동안엔 전면 오버레이로 본 화면을 가려 깜빡임을 막는다.
 * 스크린샷 모드(SHOT)는 계정 없이 촬영해야 하므로 게이트를 끈다.
 */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { resolveEntryGate, useOnboardingSeen } from '@/lib/onboarding';
import { useAuthed } from '@/lib/useAuthed';
import { SHOT } from '@/lib/shotMode';
import { useThemeColors } from '@/components/ThemeProvider';

export function EntryGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const authed = useAuthed();
  const seen = useOnboardingSeen();
  const c = useThemeColors();
  const target = SHOT || process.env.EXPO_PUBLIC_SHOT_ROUTE ? null : resolveEntryGate({ authed, onboardingSeen: seen, pathname });

  useEffect(() => {
    if (!target) return;
    const to = target === 'onboarding' ? '/onboarding' : '/login';
    // 라우터 마운트 직후 첫 프레임에서 replace 가 무시되는 경우가 있어 한 틱 늦춘다.
    const t = setTimeout(() => router.replace(to as never), 0);
    return () => clearTimeout(t);
  }, [target, pathname]);

  return (
    <>
      {children}
      {target ? <View pointerEvents="auto" style={[StyleSheet.absoluteFill, { backgroundColor: target === 'onboarding' ? '#ffffff' : c.pap2, zIndex: 1000 }]} /> : null}
    </>
  );
}
