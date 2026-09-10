/**
 * 어드민 → API 서버 로그 조회.
 * 어드민 앱은 사용자 JWT 가 없으므로 서버와 공유하는 ADMIN_UPLOAD_SECRET 로 인증한다
 * (배너 업로드와 같은 방식).
 */
import type { LogLine } from '../../../shared/serverLogs';

export type { LogLine };
export type LogLevelFilter = 'all' | 'error';

const API_ORIGIN = process.env.ADMIN_API_ORIGIN ?? 'https://api.arvotcg.com';
const TIMEOUT_MS = 10_000;

export interface LogSource {
  kind: 'out' | 'err';
  path: string | null;
  error?: string;
  bytes?: number;
}

export interface ServerLogsResult {
  lines: LogLine[];
  level: LogLevelFilter;
  limit: number;
  totalScanned: number;
  errorCount: number;
  warnCount: number;
  sources: LogSource[];
  at: string;
  /** 조회 자체가 실패한 이유 — 화면 상단에 그대로 보여 준다. */
  fetchError?: string;
}

const EMPTY: Omit<ServerLogsResult, 'level' | 'limit' | 'fetchError'> = {
  lines: [], totalScanned: 0, errorCount: 0, warnCount: 0, sources: [], at: '',
};

export async function fetchServerLogs(
  level: LogLevelFilter,
  limit: number,
): Promise<ServerLogsResult> {
  const secret = process.env.ADMIN_UPLOAD_SECRET;
  if (!secret) {
    return {
      ...EMPTY, level, limit,
      fetchError: 'ADMIN_UPLOAD_SECRET 미설정 — admin/.env 와 server/.env 에 같은 값을 넣으세요.',
    };
  }
  const url = `${API_ORIGIN}/api/admin/logs?level=${level}&limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: { 'x-admin-upload-secret': secret },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({}))) as Partial<ServerLogsResult> & { error?: string };
    if (!res.ok) {
      return { ...EMPTY, level, limit, fetchError: body.error ?? `API 서버 HTTP ${res.status}` };
    }
    return {
      lines: body.lines ?? [],
      level: body.level ?? level,
      limit: body.limit ?? limit,
      totalScanned: body.totalScanned ?? 0,
      errorCount: body.errorCount ?? 0,
      warnCount: body.warnCount ?? 0,
      sources: body.sources ?? [],
      at: body.at ?? '',
    };
  } catch (err) {
    return {
      ...EMPTY, level, limit,
      fetchError: err instanceof Error ? err.message : String(err),
    };
  }
}
