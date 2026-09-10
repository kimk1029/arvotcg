/**
 * 서버 로그(pm2 파일) 파싱 — 서버·어드민 공유 단일 소스.
 *
 * pm2 는 `log_date_format: YYYY-MM-DDTHH:mm:ss` 설정으로 각 줄 앞에
 * `2026-09-10T04:16:44: ` 형태의 시각을 붙인다. 스택 트레이스의 이어지는 줄에도
 * 똑같이 붙으므로 줄 단위로 그대로 다뤄도 어긋나지 않는다.
 */

export type LogLevel = 'error' | 'warn' | 'info';

/** 로그 한 줄. */
export interface LogLine {
  /** 'YYYY-MM-DDTHH:mm:ss' — pm2 접두사가 없으면 null. */
  at: string | null;
  level: LogLevel;
  /** out = 표준 출력, err = 표준 에러(console.error·미처리 예외). */
  source: 'out' | 'err';
  text: string;
}

const TS_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}):\s?(.*)$/;

// 표준 출력에 섞여 나오는 실패 로그를 잡는다. 단어로 들어간 경우만 — 'terror' 같은
// 우연한 부분일치를 피한다.
const ERROR_WORD_RE = /(^|[^a-z])(error|err|exception|unhandled|rejected|fail(?:ed|ure)?|timeout|refused)([^a-z]|$)/i;
// 대문자 규칙에 기대는 패턴이라 대소문자를 구분한다:
// TypeError·PrismaClientKnownRequestError 같은 예외 클래스명과 ECONNREFUSED 류 errno.
const ERROR_CODE_RE = /[A-Za-z]*Error\b|\bE[A-Z]{4,}\b|✖|❌/;
const WARN_RE = /(^|[^a-z])(warn(?:ing)?|deprecat\w*|slow|retry|retrying|skipped)([^a-z]|$)|⚠/i;

/** 한 줄의 심각도. 표준 에러로 나온 줄은 무조건 error. */
export function classifyLine(text: string, source: 'out' | 'err'): LogLevel {
  if (source === 'err') return 'error';
  if (ERROR_WORD_RE.test(text) || ERROR_CODE_RE.test(text)) return 'error';
  if (WARN_RE.test(text)) return 'warn';
  return 'info';
}

/** 파일에서 읽은 원문 → 로그 줄 배열. 빈 줄은 버린다. */
export function parseLogLines(raw: string, source: 'out' | 'err'): LogLine[] {
  const out: LogLine[] = [];
  for (const line of raw.split('\n')) {
    const text = line.replace(/\r$/, '');
    if (!text.trim()) continue;
    const m = TS_RE.exec(text);
    const body = m ? m[2] : text;
    out.push({ at: m ? m[1] : null, level: classifyLine(body, source), source, text: body });
  }
  return out;
}

/**
 * 표준 출력·표준 에러를 시각순으로 합친다.
 * 시각이 없는 줄(스택 조각 등)은 순서를 보존하려고 바로 앞 줄의 시각을 물려받는다.
 * 마지막 `limit` 줄만 남긴다 — 화면은 최신이 아래다.
 */
export function mergeLogLines(groups: LogLine[][], limit: number): LogLine[] {
  const filled = groups.map((g) => {
    let last: string | null = null;
    return g.map((l) => {
      if (l.at) last = l.at;
      return l.at ? l : { ...l, at: last };
    });
  });
  const all = filled.flat();
  // 시각이 같으면 원래 순서를 지킨다(안정 정렬).
  const sorted = all
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.at ?? '').localeCompare(b.l.at ?? '') || a.i - b.i)
    .map((x) => x.l);
  return limit > 0 && sorted.length > limit ? sorted.slice(sorted.length - limit) : sorted;
}

/** 'error' 필터. 'all' 이면 그대로 돌려준다. */
export function filterByLevel(lines: LogLine[], level: 'all' | 'error'): LogLine[] {
  return level === 'error' ? lines.filter((l) => l.level === 'error') : lines;
}
