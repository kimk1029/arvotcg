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
import { router } from 'expo-router';
import { getApiOrigin } from './apiEnv';
import { getAuthHeader, getSession, setSession } from './session';
import { SHOT, shotSanitize } from './shotMode';

export function getApiBaseUrl(): string {
  return getApiOrigin();
}

/** @deprecated 모바일은 더 이상 웹 도메인을 호출하지 않음. apiClient 가 직접 Express 를 호출. */
export const getWebBaseUrl = getApiBaseUrl;

/**
 * 401 → 로그인 화면. 만료·삭제된 토큰은 함께 지운다.
 * 진입 게이트([[EntryGate]])가 없는 구버전 화면에서도 미로그인 사용자가 빈 화면에
 * 갇히지 않게, 모든 API 호출이 지나가는 이 파일 한 곳에서만 처리한다.
 * 이동은 로그인/온보딩에 도달할 때까지 1회 — 응답이 여러 개 몰려도 반복 이동하지 않는다.
 */
let sentToLogin = false;

export function handleUnauthorized() {
  if (SHOT || sentToLogin) return;
  sentToLogin = true;
  if (getSession()) setSession(null);
  // 라우터가 준비되기 전 호출될 수 있어 한 틱 늦춘다(EntryGate 와 같은 이유).
  setTimeout(() => {
    try { router.replace('/login' as never); } catch { sentToLogin = false; }
  }, 0);
}

/** 로그인 성공 후 다시 감시하도록 초기화. */
export function resetUnauthorizedRedirect() {
  sentToLogin = false;
}

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
  /** 응답 대기 상한(ms). 호출자가 signal 을 직접 주면 무시. 기본 DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
  /** GET 일시 장애 자동 재시도 횟수. 기본 1회, 쓰기 요청은 항상 0회. */
  retries?: number;
}

/**
 * 기본 요청 타임아웃.
 * 모바일 네트워크가 끊기거나 서버가 응답을 물고 있으면 fetch 는 스스로 끝나지
 * 않는다 — 타임아웃이 없으면 화면이 로딩 스피너에 영원히 갇힌다(에러 처리도 못 탐).
 * 호출자가 signal 을 넘기면 그쪽 정책을 존중하고 여기선 손대지 않는다.
 */
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_GET_RETRIES = 1;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

const retryDelay = (attempt: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, 350 * attempt));

export async function api<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false) {
    const auth = getAuthHeader();
    if (auth) headers['Authorization'] = auth;
  }

  // POST/PATCH/DELETE 자동 재시도는 중복 생성·결제 위험이 있어 금지한다.
  const retries = method === 'GET' && !opts.signal
    ? Math.max(0, opts.retries ?? DEFAULT_GET_RETRIES)
    : 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // fetch뿐 아니라 res.text()까지 같은 타이머 안에 둔다. 서버가 헤더만 보내고
    // 본문을 멈춰도 반드시 종료되어 화면이 무한 로딩에 빠지지 않는다.
    const controller = opts.signal ? null : new AbortController();
    const timer = controller
      ? setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
      : null;
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal ?? controller?.signal,
      });
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
        if (res.status === 401) handleUnauthorized();
        if (attempt < retries && RETRYABLE_STATUSES.has(res.status)) {
          await retryDelay(attempt + 1);
          continue;
        }
        throw new ApiError(res.status, parsed, `API ${res.status} on ${path}`);
      }
      return shotSanitize(parsed) as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const aborted = controller?.signal.aborted === true;
      const cause = aborted ? '요청 시간 초과' : err instanceof Error ? err.message : 'network';
      console.warn('[api] transport fail:', method, url, cause, `attempt=${attempt + 1}`);
      if (attempt < retries) {
        await retryDelay(attempt + 1);
        continue;
      }
      throw new ApiError(0, null, `${cause} — ${method} ${path}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw new ApiError(0, null, `network — ${method} ${path}`);
}
