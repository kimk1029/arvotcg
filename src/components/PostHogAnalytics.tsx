'use client';

import posthog from 'posthog-js';
import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/session';
import { hasEmbedQuery, isEmbedUserAgent } from '../../shared/embed';
import {
  POSTHOG_HOST_DEFAULT,
  POSTHOG_KEY_DEFAULT,
  personProperties,
} from '../../shared/analytics';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? POSTHOG_KEY_DEFAULT;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? POSTHOG_HOST_DEFAULT;

let initialized = false;

/** 앱 인앱 WebView 면 웹 SDK 를 켜지 않는다(앱 SDK 와 이중 집계 방지). 규칙은 shared/embed.ts. */
function isEmbedded(): boolean {
  try {
    if (document.documentElement.getAttribute('data-embed') === '1') return true;
    if (hasEmbedQuery(location.search)) return true;
    if (isEmbedUserAgent(navigator.userAgent)) return true;
    if (sessionStorage.getItem('pf30:embed') === '1') return true;
  } catch {
    /* noop */
  }
  return false;
}

function initOnce(): boolean {
  if (initialized) return true;
  if (typeof window === 'undefined' || !KEY) return false;
  if (isEmbedded()) return false;
  posthog.init(KEY, {
    api_host: HOST,
    // 2026-05-30 기본값 묶음: history_change 페이지뷰(App Router 라우팅 포함)·pageleave·autocapture 등.
    defaults: '2026-05-30',
    // 로그인한 사람만 person 프로필 생성 — 익명 트래픽은 이벤트만(비용·프라이버시).
    person_profiles: 'identified_only',
    capture_exceptions: true,
  });
  posthog.register({
    platform: 'web',
    env: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? '',
  });
  initialized = true;
  return true;
}

/**
 * PostHog 웹 SDK 부트스트랩 + 로그인 세션 ↔ identify 동기화.
 * 앱 짝: mobile/src/lib/posthog.ts (+ ActionTracker 의 screen 캡처).
 */
export function PostHogAnalytics() {
  const { user, status } = useSession();
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    initOnce();
  }, []);

  useEffect(() => {
    if (!initOnce()) return;
    if (status === 'authenticated' && user) {
      if (identifiedRef.current !== user.id) {
        posthog.identify(user.id, personProperties(user));
        identifiedRef.current = user.id;
      }
    } else if (status === 'unauthenticated' && identifiedRef.current) {
      // 로그아웃 — 다음 익명 방문이 이전 사람에 붙지 않도록 distinct_id 재발급.
      posthog.reset();
      identifiedRef.current = null;
    }
  }, [status, user]);

  return null;
}
