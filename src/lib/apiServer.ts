/**
 * Server Component / Server-side fetch wrapper.
 * - dev: Next 가 `/api/*`, `/auth/*` 를 Express 로 rewrite 하지만 Server Component
 *   에서는 절대 URL 이 필요. 직접 Express 서버 (`API_INTERNAL_URL`) 로 호출한다.
 * - 인증이 필요한 호출에는 `pf30_session` 쿠키를 `Cookie:` 헤더로 포워딩.
 */
import { resolveApiOrigin } from '../../shared/apiEndpoints';
import { cookies } from 'next/headers';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'pf30_session';

/**
 * 오리진 결정은 앱과 같은 정본(/shared/apiEndpoints.ts)을 쓴다 — 웹↔앱 패리티.
 *   NEXT_PUBLIC_APP_ENV=stage → NAS / 그 외 → API_ORIGIN_PROD(Vultr) → 없으면 NAS 폴백.
 */
function baseUrl(): string {
  return resolveApiOrigin({
    explicitOverride: process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_ORIGIN,
    appEnv: process.env.NEXT_PUBLIC_APP_ENV,
    productionOrigin: process.env.API_ORIGIN_PROD,
  });
}

interface ServerFetchOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** 인증 쿠키 포워딩 여부 (기본 true). */
  auth?: boolean;
  cache?: RequestCache;
  /**
   * Next 데이터 캐시 TTL (초). 지정하면 `cache` 대신 `next.revalidate` 를 사용 —
   * 같은 URL 요청이 TTL 동안 캐시에서 즉시 반환되고 백그라운드 재검증된다.
   * 인증 호출(auth)에는 쓰지 말 것 (사용자 간 응답이 섞인다).
   */
  revalidate?: number;
  /** 헤더+본문 전체 응답 제한. 공용 조회 기본 30초. */
  timeoutMs?: number;
  /** GET 일시 장애 재시도 횟수. 기본 1회. */
  retries?: number;
}

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export async function serverFetch<T>(
  path: string,
  opts: ServerFetchOpts = {},
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const url = `${baseUrl()}${path}`;
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false) {
    const session = cookies().get(SESSION_COOKIE);
    if (session) headers['Cookie'] = `${session.name}=${session.value}`;
  }

  const method = opts.method ?? 'GET';
  const retries = method === 'GET' ? Math.max(0, opts.retries ?? 1) : 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
        ...(typeof opts.revalidate === 'number'
          ? { next: { revalidate: opts.revalidate } }
          : { cache: opts.cache ?? 'no-store' }),
      });
      if (attempt < retries && RETRYABLE_STATUSES.has(res.status)) {
        await res.arrayBuffer().catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      if (res.status === 204) return { ok: true, status: 204, data: null };
      try {
        const data = (await res.json()) as T;
        return { ok: res.ok, status: res.status, data };
      } catch {
        return { ok: res.ok, status: res.status, data: null };
      }
    } catch (err) {
      // Next가 정적 렌더 중 동적 사용을 감지하기 위해 던지는 제어 신호는
      // 네트워크 오류가 아니다. 삼키거나 재시도하지 말고 프레임워크로 돌려보낸다.
      if (err && typeof err === 'object' && 'digest' in err && err.digest === 'DYNAMIC_SERVER_USAGE') {
        throw err;
      }
      console.error('[serverFetch] network', path, `attempt=${attempt + 1}`, err);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      return { ok: false, status: 0, data: null };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, data: null };
}

export interface ServerSessionUser {
  id: string;
  name: string | null;
  email: string | null;
  provider?: string | null;
}

/**
 * Server Component / route segment 에서 현재 로그인 사용자 조회.
 * NextAuth 의 `getServerSession(authOptions)` 대체.
 */
export async function getServerUser(): Promise<ServerSessionUser | null> {
  const session = cookies().get(SESSION_COOKIE);
  if (!session) return null;
  const r = await serverFetch<{ user: ServerSessionUser | null }>('/auth/me', {
    cache: 'no-store',
  });
  return r.data?.user ?? null;
}
