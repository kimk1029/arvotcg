/**
 * pm2 로그 파일 tail — 어드민 '서버 로그' 화면용.
 *
 * 경로는 pm2 가 자식 프로세스 env 에 심어 주는 pm_out_log_path / pm_err_log_path 를 쓴다
 * (`log_date_format` 이 설정돼 있어 각 줄에 시각이 붙는다). pm2 밖에서 띄웠거나 경로를
 * 바꾸고 싶으면 SERVER_LOG_OUT_PATH / SERVER_LOG_ERR_PATH 로 덮어쓴다.
 *
 * 파일 전체를 읽지 않는다 — 끝에서 정해진 바이트만 읽어 첫 조각 줄은 버린다.
 */
import { open, stat } from 'node:fs/promises';
import { parseLogLines, type LogLine } from '../../shared/serverLogs';

/** 한 파일에서 읽어올 최대 바이트. 300줄 기준으로 넉넉하다. */
const TAIL_BYTES = 512 * 1024;

export interface LogSource {
  kind: 'out' | 'err';
  path: string | null;
  /** 읽기 실패 사유 — 화면에 그대로 보여 준다(경로 오설정 진단용). */
  error?: string;
  bytes?: number;
}

function pathFor(kind: 'out' | 'err'): string | null {
  const override = kind === 'out' ? process.env.SERVER_LOG_OUT_PATH : process.env.SERVER_LOG_ERR_PATH;
  if (override) return override;
  const pm2 = kind === 'out' ? process.env.pm_out_log_path : process.env.pm_err_log_path;
  return pm2 || null;
}

/** 파일 끝 TAIL_BYTES 를 읽는다. 잘린 첫 줄은 버려 반쪽 줄이 표시되지 않게 한다. */
async function tailFile(path: string, maxBytes: number): Promise<string> {
  const info = await stat(path);
  const length = Math.min(info.size, maxBytes);
  if (length === 0) return '';
  const start = info.size - length;
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, start);
    const text = buf.toString('utf8');
    if (start === 0) return text;
    const nl = text.indexOf('\n');
    return nl === -1 ? '' : text.slice(nl + 1);
  } finally {
    await fh.close();
  }
}

/** 표준 출력·표준 에러 파일을 읽어 파싱한 줄과 각 파일 상태를 돌려준다. */
export async function readServerLogs(
  maxBytes = TAIL_BYTES,
): Promise<{ groups: LogLine[][]; sources: LogSource[] }> {
  const groups: LogLine[][] = [];
  const sources: LogSource[] = [];
  for (const kind of ['out', 'err'] as const) {
    const path = pathFor(kind);
    if (!path) {
      sources.push({ kind, path: null, error: 'pm2 로그 경로를 찾지 못했습니다 (pm_out_log_path 미설정)' });
      groups.push([]);
      continue;
    }
    try {
      const raw = await tailFile(path, maxBytes);
      groups.push(parseLogLines(raw, kind));
      sources.push({ kind, path, bytes: Buffer.byteLength(raw) });
    } catch (err) {
      sources.push({ kind, path, error: err instanceof Error ? err.message : String(err) });
      groups.push([]);
    }
  }
  return { groups, sources };
}
