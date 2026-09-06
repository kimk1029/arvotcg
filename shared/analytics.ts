/**
 * PostHog 제품 분석 — 웹·앱 공통 상수 (정본).
 *
 * 프로젝트 토큰은 PostHog 가 "클라이언트에 공개해도 되는 write-only 키"로 정의한 값이라
 * 소스에 기본값으로 둔다(플랫폼별 env 로 덮어쓰기 가능). 프로젝트 ID 595963, US Cloud.
 *
 * 양쪽 공통 규칙:
 *  - distinct_id = 우리 User.id (로그인 시 identify, 로그아웃 시 reset) → 웹·앱 활동이 한 사람으로 합쳐짐.
 *  - super property `platform`('web' | 'ios' | 'android') · `env`('production' | 'development') · `app_version`.
 *  - 앱 인앱 WebView(임베드)에선 웹 SDK 를 켜지 않는다 — 앱 SDK 가 이미 세는 화면을 이중 집계하지 않기 위해.
 */
export const POSTHOG_KEY_DEFAULT = 'phc_wfe5yzDaDFc42EPP7m8qcukcP2jUSTvVizWKEpmSXvB9';
export const POSTHOG_HOST_DEFAULT = 'https://us.i.posthog.com';

export type AnalyticsPlatform = 'web' | 'ios' | 'android';
export type AnalyticsEnv = 'production' | 'development';

/** identify 에 넘기는 사람 속성 — 웹·앱이 같은 키를 쓴다. */
export interface AnalyticsPerson {
  email?: string | null;
  name?: string | null;
  provider?: string | null;
}

export function personProperties(p: AnalyticsPerson): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.email) out.email = p.email;
  if (p.name) out.name = p.name;
  if (p.provider) out.provider = p.provider;
  return out;
}
