// 웹·모바일 공유 단일 소스 — 슬라이드 내용·게이트 판정은 [[/shared/onboarding.ts]] 에.
// 이 파일은 브라우저 localStorage 래퍼 + re-export shim.
export * from '../../shared/onboarding';
import { ONBOARDING_SEEN_KEY, ONBOARDING_SEEN_VALUE } from '../../shared/onboarding';

/** 온보딩을 끝까지(또는 '로그인' 링크로) 본 적 있는지. SSR 에선 false. */
export function isOnboardingSeen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ONBOARDING_SEEN_KEY) === ONBOARDING_SEEN_VALUE;
  } catch {
    return false;
  }
}

export function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, ONBOARDING_SEEN_VALUE);
  } catch {
    // 저장 불가(프라이빗 모드 등) — 세션 동안만 통과
  }
}
