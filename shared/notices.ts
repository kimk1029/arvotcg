/**
 * 공지사항 — 웹·앱·서버·어드민 공유 단일 소스.
 * 실제 데이터는 DB(notices 테이블) → 서버 GET /api/notices.
 * 어드민 CRUD 는 admin/src/app/notices.
 */

export const NOTICE_TAGS = ['update', 'event', 'maintenance'] as const;
export type NoticeTag = (typeof NOTICE_TAGS)[number];

/** 태그 배지 문구. 색은 플랫폼별(웹 CSS 변수 / 앱 테마 토큰). */
export const NOTICE_TAG_LABEL: Record<NoticeTag, string> = {
  update: 'UPDATE',
  event: 'EVENT',
  maintenance: '점검',
};

export function isNoticeTag(v: unknown): v is NoticeTag {
  return typeof v === 'string' && (NOTICE_TAGS as readonly string[]).includes(v);
}

/** 공지 한 건 — 서버 /api/notices 응답 행. */
export interface Notice {
  id: number;
  title: string;
  /** 줄바꿈 \n 그대로 렌더. */
  body: string;
  /** null = 태그 없음. */
  tag: NoticeTag | null;
  /** 목록 상단 고정. */
  pinned: boolean;
  /** 표시용 발행일 'YYYY-MM-DD'. */
  publishedAt: string;
}

/** '2026-04-20' → '2026.04.20' */
export function noticeDateLabel(d: string): string {
  return d.replaceAll('-', '.');
}

/** 목록 정렬 — 고정글 먼저, 발행일 최신순. 서버 orderBy 와 같은 규칙. */
export function sortNotices<T extends Pick<Notice, 'pinned' | 'publishedAt' | 'id'>>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.publishedAt.localeCompare(a.publishedAt) ||
      b.id - a.id,
  );
}
