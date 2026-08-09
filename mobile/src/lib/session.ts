/**
 * Bearer 토큰 (Express /auth/{provider} 가 발급한 JWT) 을 디바이스에 저장.
 * apiClient 는 이 토큰을 `Authorization: Bearer ...` 헤더로 첨부.
 */
import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'session.json';

interface Stored {
  token: string;
  /** 만료 ms epoch. null 이면 만료 정보 없음 (그래도 보존). */
  expiresAt: number | null;
  /** 디버그용 — 이 토큰이 어느 base url 로부터 잡힌 것인지. */
  baseUrl: string;
}

function getFile(): File {
  return new File(Paths.document, FILE_NAME);
}

let memo: Stored | null | undefined;
const listeners = new Set<() => void>();

function readSync(): Stored | null {
  if (memo !== undefined) return memo;
  try {
    const f = getFile();
    if (!f.exists) {
      memo = null;
      return null;
    }
    const txt = f.textSync();
    const parsed = JSON.parse(txt) as Stored;
    if (!parsed?.token) {
      memo = null;
      return null;
    }
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      memo = null;
      return null;
    }
    memo = parsed;
    return parsed;
  } catch {
    memo = null;
    return null;
  }
}

function emit() {
  for (const fn of listeners) fn();
}

export function getSession(): Stored | null {
  return readSync();
}

export function getAuthHeader(): string | null {
  const s = readSync();
  if (!s) return null;
  return `Bearer ${s.token}`;
}

export function setSession(next: Stored | null) {
  const f = getFile();
  if (next === null) {
    if (f.exists) f.delete();
    memo = null;
  } else {
    if (!f.exists) f.create();
    f.write(JSON.stringify(next));
    memo = next;
  }
  emit();
}

export function isAuthenticated(): boolean {
  return readSync() !== null;
}

/**
 * JWT payload 의 sub(userId) — 서명 검증 없이 표시/비교용으로만 디코드.
 * (내 글에 신고/차단 메뉴 숨김 등. 권한 판단은 항상 서버가 한다.)
 */
export function getUserId(): string | null {
  const s = readSync();
  if (!s) return null;
  try {
    const payload = s.token.split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(globalThis.atob(b64)) as { sub?: string };
    return typeof json.sub === 'string' ? json.sub : null;
  } catch {
    return null;
  }
}

export function subscribeSession(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
