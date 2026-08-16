/**
 * Express 백엔드 (`server/`) 호출용 클라이언트.
 *
 * baseUrl 은 `EXPO_PUBLIC_API_BASE_URL` 환경 변수에서 가져온다.
 * 운영: http://kimk1029.synology.me:3030
 * 로컬 dev: EXPO_PUBLIC_API_BASE_URL=http://<WSL2-IP>:3030 또는 adb reverse 후 localhost.
 *
 * 인증은 `/auth/{provider}` 가 발급한 JWT 를 `Authorization: Bearer ...` 헤더로
 * 첨부. [[session]] 모듈이 토큰을 관리.
 */
import { getAuthHeader } from './session';

// EXPO_PUBLIC_API_BASE_URL 이 비어있을 때 폴백 — 운영 Synology 호스트.
const DEFAULT_BASE = 'http://kimk1029.synology.me:3030';

export function getApiBaseUrl(): string {
  const v = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof v === 'string' && v.length > 0) return v.replace(/\/$/, '');
  return DEFAULT_BASE;
}

/** @deprecated 모바일은 더 이상 웹 도메인을 호출하지 않음. apiClient 가 직접 Express 를 호출. */
export const getWebBaseUrl = getApiBaseUrl;

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API ${status}`);
    this.status = status;
    this.body = body;
  }
}

interface ApiOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Bearer 자동 첨부 여부. 기본 true. */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false) {
    const auth = getAuthHeader();
    if (auth) headers['Authorization'] = auth;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    // 전송 단계 실패 — 원인 추적용으로 메서드·경로를 메시지에 포함 (토스트에 그대로 노출).
    const cause = err instanceof Error ? err.message : 'network';
    console.warn('[api] transport fail:', opts.method ?? 'GET', url, cause);
    throw new ApiError(0, null, `${cause} — ${opts.method ?? 'GET'} ${path}`);
  }

  const txt = await res.text();
  let parsed: unknown = null;
  if (txt) {
    try {
      parsed = JSON.parse(txt);
    } catch {
      parsed = txt;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, parsed, `API ${res.status} on ${path}`);
  }
  return parsed as T;
}
