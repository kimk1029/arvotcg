import { NOTICE_TAGS, type NoticeTag } from '../../../shared/notices';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export { NOTICE_TAGS, type NoticeTag };

export interface NoticeInput {
  title?: string;
  body?: string;
  tag?: string | null;
  pinned?: boolean;
  published?: boolean;
  publishedAt?: string;
}

type ParseResult = { ok: true; data: NoticeInput } | { ok: false; error: string };

/** 공지 입력 검증. partial=true 면 PATCH(누락 필드 허용). */
export function parseNoticeInput(raw: Record<string, unknown>, partial: boolean): ParseResult {
  const data: NoticeInput = {};

  if (raw.title !== undefined) {
    if (typeof raw.title !== 'string' || !raw.title.trim()) return { ok: false, error: 'title 이 비어있습니다' };
    data.title = raw.title.trim();
  } else if (!partial) {
    return { ok: false, error: 'title 이 필요합니다' };
  }

  if (raw.body !== undefined) {
    if (typeof raw.body !== 'string') return { ok: false, error: 'body 는 문자열이어야 합니다' };
    data.body = raw.body;
  }

  if (raw.publishedAt !== undefined) {
    if (typeof raw.publishedAt !== 'string' || !DATE_RE.test(raw.publishedAt)) {
      return { ok: false, error: 'publishedAt 은 YYYY-MM-DD 형식이어야 합니다' };
    }
    data.publishedAt = raw.publishedAt;
  } else if (!partial) {
    return { ok: false, error: 'publishedAt 이 필요합니다' };
  }

  if (raw.tag !== undefined) {
    if (raw.tag === null || raw.tag === '') {
      data.tag = null;
    } else if (typeof raw.tag === 'string' && (NOTICE_TAGS as readonly string[]).includes(raw.tag)) {
      data.tag = raw.tag;
    } else {
      return { ok: false, error: `tag 는 ${NOTICE_TAGS.join('/')} 중 하나여야 합니다` };
    }
  }

  for (const key of ['pinned', 'published'] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== 'boolean') return { ok: false, error: `${key} 는 boolean 이어야 합니다` };
    data[key] = raw[key] as boolean;
  }

  return { ok: true, data };
}

/**
 * DB 도입 전 웹·앱에 하드코딩돼 있던 공지 2건.
 * /api/notices/seed 가 테이블이 빈 경우에만 넣는다.
 */
export const DEFAULT_NOTICES: {
  title: string;
  body: string;
  tag: NoticeTag | null;
  publishedAt: string;
}[] = [
  {
    title: '아르보TCG 서비스 오픈',
    body: '아르보TCG 웹 서비스가 정식 오픈했습니다. 현장 혼잡도 제보·거래·스탬프 랠리·오리파 모두 이용 가능합니다.',
    tag: 'event',
    publishedAt: '2026-04-20',
  },
  {
    title: '스탬프 6곳 주소 확정 안내',
    body: '성수 일대 6개 포켓스탑 정식 주소가 확정되어 "실제 지도" 탭에 반영되었습니다. 각 지점 정보 참고하세요.',
    tag: 'update',
    publishedAt: '2026-04-15',
  },
];
