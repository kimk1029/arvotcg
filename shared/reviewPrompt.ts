/**
 * 앱 후기(스토어 리뷰) 요청 — 웹·앱 공통 정본.
 *
 * - 스토어 링크: Android 는 Play 앱 페이지(리뷰 작성 화면 직행 파라미터가 없다),
 *   iOS 는 App Store 리뷰 작성 화면 직행(action=write-review).
 * - 요청 시점: 3번째 방문(실행)에 한 번. '나중에'면 7일 뒤 다시(최대 3회), '남겼어요'면 다시 묻지 않는다.
 *   보상(포인트)은 두 스토어 정책상 금지라 없다.
 * - 앱 WebView·인앱 리뷰 API 의 폴백도 이 링크를 쓴다.
 */

export const ANDROID_PACKAGE = 'com.arvotcg.app';
export const IOS_APP_ID = '6799868587';

export const STORE_REVIEW_URL = {
  android: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&showAllReviews=true`,
  ios: `https://apps.apple.com/kr/app/id${IOS_APP_ID}?action=write-review`,
} as const;

export type StorePlatform = keyof typeof STORE_REVIEW_URL;

/** UA 로 스토어 플랫폼 판정. 데스크톱 등 판정 불가면 null. */
export function storePlatformFromUa(ua: string | null | undefined): StorePlatform | null {
  const u = (ua ?? '').toLowerCase();
  if (/iphone|ipad|ipod/.test(u)) return 'ios';
  if (/android/.test(u)) return 'android';
  return null;
}

/** 스토어 페이지 URL 인가 — 앱 WebView 가 안에서 열지 않고 OS(스토어 앱)로 넘겨야 하는 주소. */
export function isStoreUrl(url: string): boolean {
  return /^https?:\/\/(play\.google\.com\/store\/|apps\.apple\.com\/)/i.test(url) || /^market:\/\//i.test(url);
}

export const REVIEW_PROMPT_VISIT = 3;
export const REVIEW_PROMPT_RETRY_DAYS = 7;
export const REVIEW_PROMPT_MAX_ASKS = 3;

export interface ReviewPromptState {
  /** 누적 방문(실행) 횟수. */
  visits: number;
  /** 물어본 횟수. */
  asks: number;
  /** 'done' = 후기 남김(다시 안 묻는다) · 'later' = 나중에 · null = 아직. */
  status: 'done' | 'later' | null;
  /** 마지막으로 물어본 시각(ms). */
  askedAt: number | null;
}

export const INITIAL_REVIEW_STATE: ReviewPromptState = { visits: 0, asks: 0, status: null, askedAt: null };

/** 이번 방문에 후기 요청창을 띄울지. */
export function shouldAskReview(s: ReviewPromptState, now = Date.now()): boolean {
  if (s.status === 'done') return false;
  if (s.visits < REVIEW_PROMPT_VISIT) return false;
  if (s.asks >= REVIEW_PROMPT_MAX_ASKS) return false;
  if (s.status === 'later' && s.askedAt != null) {
    return now - s.askedAt >= REVIEW_PROMPT_RETRY_DAYS * 86_400_000;
  }
  return s.asks === 0;
}

export function markAsked(s: ReviewPromptState, now = Date.now()): ReviewPromptState {
  return { ...s, asks: s.asks + 1, askedAt: now };
}
