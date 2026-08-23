/**
 * Express 백엔드 (`server/`) 호출용 클라이언트.
 *
 * baseUrl 결정은 [[apiEnv]] 가 전담한다 (정본: /shared/apiEndpoints.ts):
 *   stage 빌드      → NAS (Synology, DSM 리버스 프록시 :3031 → :3030, Let's Encrypt TLS)
 *   production 빌드 → EXPO_PUBLIC_API_ORIGIN_PROD (Vultr), 미지정 시 NAS 폴백
 *   로컬 dev        → EXPO_PUBLIC_API_BASE_URL=http://<WSL2-IP>:3030 (최우선 오버라이드)
 *
 * 인증은 `/auth/{provider}` 가 발급한 JWT 를 `Authorization: Bearer ...` 헤더로
 * 첨부. [[session]] 모듈이 토큰을 관리.
 */
import { getApiOrigin } from './apiEnv';
import { getAuthHeader } from './session';
import { shotSanitize } from './shotMode';

export function getApiBaseUrl(): string {
  return getApiOrigin();
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
  // 스토어 스크린샷 모드 — 응답의 카드·팩 이름과 자유 텍스트를 가상 데이터로 치환.
  // (SHOT 이 아니면 항등 함수라 프로덕션 경로에는 영향 없음.)
  return shotSanitize(parsed) as T;
}
