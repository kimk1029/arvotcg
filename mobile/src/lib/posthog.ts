/**
 * PostHog 앱 SDK — 웹 짝은 src/components/PostHogAnalytics.tsx. 공통 규칙은 shared/analytics.ts.
 *
 * - 화면 이동은 ActionTracker(usePathname) 에서 `screen()` 으로 보낸다. PostHogProvider 의 터치
 *   autocapture 는 쓰지 않는다 — 루트 responder 캡처가 Fabric iOS 에서 터치를 삼키는 사고 전례
 *   (ActionTracker 주석 참고).
 * - 로그인/로그아웃은 session 구독으로 identify / reset.
 * - 네이티브 의존: SDK 가 expo-application(1.1.4+ 바이너리)·expo-file-system(전 바이너리)을
 *   try/require 로 선택 사용. 새 네이티브 모듈은 추가하지 않았으므로 1.1.4 runtime OTA 안전.
 *   1.1.3 runtime(release/ota-1.1.3)에는 이 커밋을 체리픽하지 말 것 (expo-application 없음).
 * - 스토어 스크린샷 모드(SHOT)에선 비활성.
 */
import { Platform } from 'react-native';
import PostHog from 'posthog-react-native';
import { APP_VERSION } from '../../../shared/version';
import {
  POSTHOG_HOST_DEFAULT,
  POSTHOG_KEY_DEFAULT,
  personProperties,
  type AnalyticsPerson,
} from '../../../shared/analytics';
import { SHOT } from './shotMode';
import { getUserId, subscribeSession } from './session';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? POSTHOG_KEY_DEFAULT;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? POSTHOG_HOST_DEFAULT;

let client: PostHog | null = null;
let identifiedAs: string | null = null;
let sessionBound = false;

export function getPostHog(): PostHog | null {
  if (client) return client;
  if (SHOT || !KEY) return null;
  try {
    client = new PostHog(KEY, {
      host: HOST,
      captureAppLifecycleEvents: true, // Application Installed / Updated / Opened / Backgrounded
      flushAt: 20,
      flushInterval: 10000,
    });
    client.register({
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      env: __DEV__ ? 'development' : 'production',
      app_version: APP_VERSION,
    });
  } catch (e) {
    console.warn('[posthog] init failed', e instanceof Error ? e.message : e);
    client = null;
    return null;
  }
  bindSession();
  return client;
}

/** 세션 변경(로그인/로그아웃) ↔ identify/reset. 최초 1회 현재 상태도 반영. */
function bindSession(): void {
  if (sessionBound) return;
  sessionBound = true;
  const sync = () => {
    const c = client;
    if (!c) return;
    const uid = getUserId();
    if (uid && identifiedAs !== uid) {
      c.identify(uid);
      identifiedAs = uid;
    } else if (!uid && identifiedAs) {
      c.reset();
      identifiedAs = null;
    }
  };
  sync();
  subscribeSession(sync);
}

/** 로그인 직후 프로필(/me/summary 등)을 알게 되면 사람 속성 보강 — 웹과 같은 키. */
export function setAnalyticsPerson(p: AnalyticsPerson): void {
  const c = getPostHog();
  const uid = getUserId();
  if (!c || !uid) return;
  c.identify(uid, personProperties(p));
}

export function trackScreen(path: string): void {
  const c = getPostHog();
  if (!c || !path) return;
  try {
    c.screen(path);
  } catch {
    /* noop */
  }
}
