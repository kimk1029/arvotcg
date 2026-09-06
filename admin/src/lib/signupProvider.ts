/**
 * 가입 SNS(provider) 표시 유틸.
 * DB users.signupProvider 가 정본. 컬럼 도입(2026-09-06) 전 회원은 deploy.yml pre-migrate 가
 * id 패턴으로 백필하지만, 백필 전 화면·신규 환경을 위해 같은 규칙으로 추정한다.
 *   apple_<sub> = apple · 숫자 ≤12자리 = kakao · 숫자 ≥15자리 = google(sub 21자리) · 나머지 = naver
 */
export type SignupProvider = 'google' | 'kakao' | 'naver' | 'apple';

export function inferSignupProvider(userId: string): SignupProvider | null {
  if (userId.startsWith('system')) return null;
  if (userId.startsWith('apple_')) return 'apple';
  if (/^[0-9]{1,12}$/.test(userId)) return 'kakao';
  if (/^[0-9]{15,}$/.test(userId)) return 'google';
  return 'naver';
}

/** 저장값 우선, 없으면 id 로 추정. 반환 [provider, 추정 여부] */
export function resolveSignupProvider(
  stored: string | null | undefined,
  userId: string,
): [SignupProvider | null, boolean] {
  if (stored === 'google' || stored === 'kakao' || stored === 'naver' || stored === 'apple') {
    return [stored, false];
  }
  return [inferSignupProvider(userId), true];
}

export const PROVIDER_LABEL: Record<SignupProvider, string> = {
  google: '구글',
  kakao: '카카오',
  naver: '네이버',
  apple: '애플',
};

export const PROVIDER_STYLE: Record<SignupProvider, { background: string; color: string }> = {
  google: { background: '#FEF2F2', color: '#B91C1C' },
  kakao: { background: '#FEF9C3', color: '#713F12' },
  naver: { background: '#DCFCE7', color: '#166534' },
  apple: { background: '#F1F5F9', color: '#0F172A' },
};

export const PLATFORM_LABEL: Record<string, string> = {
  web: '웹',
  ios: 'iOS',
  android: 'Android',
  mobile: '앱(구버전)',
};
