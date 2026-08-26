/**
 * 클라이언트용 세션 훅 — Express `/auth/me` 를 호출해 현재 로그인 정보를 가져온다.
 * NextAuth 의 `useSession()` 대체.
 *
 * 페이지 마운트 후 한 번 fetch → 이후 localStorage 캐시.
 * 로그아웃 / 로그인 후에는 `mutateSession()` 으로 갱신.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  avatar?: string;
  avatarId?: string;
  provider?: string | null;
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionState {
  user: SessionUser | null;
  status: SessionStatus;
}

const listeners = new Set<(s: SessionState) => void>();
let cache: SessionState = { user: null, status: 'loading' };
let inflight: Promise<void> | null = null;

function emit() {
  for (const fn of listeners) fn(cache);
}

async function refresh() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch('/auth/me', { credentials: 'include', cache: 'no-store' });
      const data = (await r.json()) as { user: SessionUser | null };
      cache = {
        user: data.user ?? null,
        status: data.user ? 'authenticated' : 'unauthenticated',
      };
    } catch {
      cache = { user: null, status: 'unauthenticated' };
    } finally {
      emit();
      inflight = null;
    }
  })();
  return inflight;
}

export function useSession(): SessionState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<SessionState>(cache);
  useEffect(() => {
    listeners.add(setState);
    if (cache.status === 'loading') void refresh();
    else setState(cache);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return { ...state, refresh };
}

/** 외부에서 강제 갱신 (로그인/로그아웃 직후). */
export function mutateSession() {
  return refresh();
}

export async function signOut(redirect: string | null = '/') {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore
  }
  cache = { user: null, status: 'unauthenticated' };
  emit();
  if (redirect && typeof window !== 'undefined') {
    window.location.href = redirect;
  }
}

export function signIn(provider: 'kakao' | 'naver' | 'google', redirect = '/') {
  if (typeof window === 'undefined') return;
  // 내부 경로만 허용 (open redirect 방지) — 서버 safeReturnPath 와 같은 규칙.
  const safe = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
  const u = new URL('/auth/' + provider, window.location.origin);
  u.searchParams.set('redirect', safe);
  window.location.href = u.toString();
}
