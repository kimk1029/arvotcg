// 웹·모바일 공유 단일 소스 — 슬라이드 내용·게이트 판정은 [[/shared/onboarding.ts]] 에.
// 이 파일은 앱 저장소(kvStore) 래퍼 + re-export shim.
export * from '../../../shared/onboarding';
import { useEffect, useState } from 'react';
import { ONBOARDING_SEEN_KEY, ONBOARDING_SEEN_VALUE } from '../../../shared/onboarding';
import { getString, setString } from './kvStore';

const listeners = new Set<() => void>();

/** 온보딩을 끝까지(또는 '로그인' 링크로) 본 적 있는지. */
export function isOnboardingSeen(): boolean {
  return getString(ONBOARDING_SEEN_KEY) === ONBOARDING_SEEN_VALUE;
}

export function markOnboardingSeen(): void {
  setString(ONBOARDING_SEEN_KEY, ONBOARDING_SEEN_VALUE);
  for (const fn of listeners) fn();
}

/** 열람 플래그 구독 훅 — 온보딩 완료 즉시 게이트가 리렌더되도록. */
export function useOnboardingSeen(): boolean {
  const [seen, setSeen] = useState(() => isOnboardingSeen());
  useEffect(() => {
    const fn = () => setSeen(isOnboardingSeen());
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return seen;
}
