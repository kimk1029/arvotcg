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
  /** 'YYYY-MM-DDTHH:mm:ss' — pm2 가 찍은 **서버 로컬 시각** 그대로. 없으면 null. */
  at: string | null;
  /**
   * `at` 을 실제 시점(UTC ISO)으로 바꾼 값. 로그를 읽은 서버에서만 채울 수 있다 —
   * pm2 는 서버 로컬 시각으로 찍는데 운영 서버는 UTC 라, 이 값이 없으면 화면이 9시간 어긋난다.
   */
  atIso?: string | null;
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

// 집계 로그의 "0 failed" / "no errors" 는 성공 보고다. 판정 전에 지운다.
// (실측: `[dailySnapshot] done: 2 recorded / 0 failed / 2 tried` 가 빨갛게 잡혔다.)
const ZERO_COUNT_RE = /\b(?:0|no)\s+(?:failed|failures?|fails?|errors?|exceptions?|timeouts?)\b/gi;

/** 한 줄의 심각도. 표준 에러로 나온 줄은 무조건 error. */
export function classifyLine(text: string, source: 'out' | 'err'): LogLevel {
  if (source === 'err') return 'error';
  const t = text.replace(ZERO_COUNT_RE, ' ');
  if (ERROR_WORD_RE.test(t) || ERROR_CODE_RE.test(t)) return 'error';
  if (WARN_RE.test(t)) return 'warn';
  return 'info';
}

/**
 * pm2 가 찍은 로컬 시각 문자열 → UTC ISO 문자열.
 *
 * 오프셋이 없는 'YYYY-MM-DDTHH:mm:ss' 를 JS 는 **실행 환경의 로컬 시각**으로 읽는다.
 * 이 함수는 로그 파일을 쓴 그 서버에서 호출해야 맞는 시점이 나온다.
 */
export function localLogTimeToIso(at: string | null): string | null {
  if (!at) return null;
  const t = new Date(at).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** 각 줄에 atIso 를 채운다. 로그를 읽은 서버에서 한 번만 부른다. */
export function withIsoTimes(lines: LogLine[]): LogLine[] {
  return lines.map((l) => ({ ...l, atIso: localLogTimeToIso(l.at) }));
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
