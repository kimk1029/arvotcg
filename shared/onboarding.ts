/**
 * 온보딩 + 로그인 진입 게이트 — 웹·앱 공통 정본.
 *
 * 앱을 처음 열면(온보딩을 본 적 없으면) 온보딩 4장을 먼저 보여주고, 그 뒤 로그인이
 * 없으면 로그인 화면으로 보낸다. 로그인해야 앱을 쓸 수 있다 (2026-09-08 정책).
 *
 *  · 온보딩 미열람 + 로그인됨   → 온보딩 → '시작하기' → 앱
 *  · 온보딩 미열람 + 로그인 안됨 → 온보딩 → '시작하기' → 로그인 → 앱
 *  · 온보딩 열람  + 로그인 안됨 → 로그인
 *  · 온보딩 열람  + 로그인됨   → 앱
 *
 * '열람' 플래그는 기기 로컬(웹 localStorage / 앱 kvStore) — 로그아웃해도 온보딩은
 * 다시 안 보이고 로그인만 요구한다.
 *
 * 플랫폼 예외(2026-09-08 사용자 지시): 웹은 온보딩을 띄우지 않는다 — 웹 첫 방문은 바로
 * 로그인 게이트. 온보딩 페이지(/onboarding) 자체는 남겨 직접 열면 볼 수 있다.
 */

/** 온보딩 열람 플래그 키 (웹 localStorage · 앱 kvStore 동일). */
export const ONBOARDING_SEEN_KEY = 'pf30:onboardingSeen';
export const ONBOARDING_SEEN_VALUE = '1';

export interface OnboardingSlide {
  id: 'portfolio' | 'collection' | 'box' | 'community';
  /** 작은 대문자 라벨 (예: MY PORTFOLIO). */
  eyebrow: string;
  /** 두 줄 제목 — 줄바꿈은 '\n'. */
  title: string;
  /** 두 줄 설명 — 줄바꿈은 '\n'. */
  desc: string;
  /** 슬라이드 강조색 (라벨·활성 도트·CTA 배경). */
  accent: string;
  /** CTA 그림자색 (rgba). */
  accentShadow: string;
  /** 일러스트 뒤 원형 글로우 (안쪽·바깥 색). */
  glow: [string, string];
}

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    id: 'portfolio',
    eyebrow: 'MY PORTFOLIO',
    title: '내 카드를 모아서\n시세 변동률 확인',
    desc: '보유 카드를 한곳에 모아두면\n전체 평가액과 변동률을 바로 볼 수 있어요.',
    accent: '#FF7A00',
    accentShadow: 'rgba(255,122,0,.34)',
    glow: ['#FFE6CC', '#FFF6EE'],
  },
  {
    id: 'collection',
    eyebrow: 'MY COLLECTION',
    title: '스캔 한 번으로\n컬렉션 자동 등록',
    desc: '세트코드·카드번호를 직접 입력하거나\n카메라로 스캔해 바로 추가하세요.',
    accent: '#6a3aff',
    accentShadow: 'rgba(106,58,255,.32)',
    glow: ['#E7E2FF', '#F5F3FF'],
  },
  {
    id: 'box',
    eyebrow: 'BOX & TCG INDEX',
    title: '카드박스별 히트카드\n탐색과 TCG 인덱스',
    desc: '박스마다 어떤 히트카드가 나오는지 살펴보고\n시장 전체 흐름은 TCG 인덱스로 확인하세요.',
    accent: '#3B7BF6',
    accentShadow: 'rgba(59,123,246,.32)',
    glow: ['#DCEBFF', '#F2F7FF'],
  },
  {
    id: 'community',
    eyebrow: 'COMMUNITY & SHOP',
    title: '회원 간 소통부터\n카드샵 정보까지',
    desc: '커뮤니티에서 트레이너들과 정보를 나누고,\n주변 카드샵 후기와 위치까지 확인하세요.',
    accent: '#2BB673',
    accentShadow: 'rgba(43,182,115,.32)',
    glow: ['#DCF3E6', '#F1FBF5'],
  },
];

export const ONBOARDING_CTA_NEXT = '다음';
export const ONBOARDING_CTA_START = 'ARVO TCG 시작하기';
export const ONBOARDING_SKIP = '건너뛰기';
export const ONBOARDING_HAVE_ACCOUNT = '이미 계정이 있으신가요?';
export const ONBOARDING_LOGIN = '로그인';
/** 비활성 도트 색. */
export const ONBOARDING_DOT_OFF = '#E5E5EA';

/** 온보딩 '시작하기' 뒤 갈 곳 — 로그인돼 있으면 앱, 아니면 로그인. */
export function onboardingNextRoute(authed: boolean): '/' | '/login' {
  return authed ? '/' : '/login';
}

export type EntryGateTarget = 'onboarding' | 'login' | null;

/**
 * 게이트를 적용하지 않는 경로 접두사 — 게이트 목적지 자체, OAuth 진행 화면,
 * 약관·개인정보처리방침(로그인 전에도 읽을 수 있어야 함), 계정삭제 안내, 어드민.
 */
export const ENTRY_GATE_EXEMPT_PREFIXES: readonly string[] = [
  '/onboarding',
  '/login',
  '/oauth',
  '/auth',
  '/legal',
  '/terms',
  '/privacy',
  '/account-deletion',
  '/admin',
];

export function isEntryGateExempt(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ENTRY_GATE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`));
}

/**
 * 현재 상태에서 보내야 할 게이트 화면. null 이면 통과.
 * 면제 경로에서는 항상 null.
 */
export function resolveEntryGate(input: {
  authed: boolean;
  onboardingSeen: boolean;
  pathname: string | null | undefined;
  /** 'web' 은 온보딩 단계를 건너뛴다(웹 예외). */
  platform: 'web' | 'app';
}): EntryGateTarget {
  if (isEntryGateExempt(input.pathname)) return null;
  if (input.platform === 'app' && !input.onboardingSeen) return 'onboarding';
  if (!input.authed) return 'login';
  return null;
}
