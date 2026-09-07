import type { Metadata } from 'next';
import { OnboardingScreen } from '@/components/OnboardingScreen';

export const metadata: Metadata = {
  title: '시작하기',
  description: '아르보TCG 첫 방문 안내 — 시세·컬렉션·박스 히트카드·커뮤니티.',
  robots: { index: false, follow: false },
};

/** 온보딩 — 첫 방문(온보딩 미열람) 시 EntryGate 가 여기로 보낸다. 앱 app/onboarding.tsx 페어. */
export default function Page() {
  return <OnboardingScreen />;
}
