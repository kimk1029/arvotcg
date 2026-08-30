/** 이벤트 게시판 — 웹 src/lib/events.ts 와 1:1 동기화. */

export const EVENT_CATEGORIES = ['구매', '시세파악', '오리파구매'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** 말머리별 태그 색. */
export const EVENT_CATEGORY_STYLE: Record<string, { background: string; color: string }> = {
  구매: { background: '#3A5BD9', color: '#fff' },
  시세파악: { background: '#0D7377', color: '#fff' },
  오리파구매: { background: '#B45309', color: '#fff' },
};

/** 이벤트 게시판 글 — 서버 /api/events 응답 행. */
export interface EventPost {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  /** 'YYYY-MM-DD'. 둘 다 null 이면 기간 없는 글. */
  startsAt: string | null;
  endsAt: string | null;
  pinned: boolean;
  published: boolean;
  /** 말머리 ('구매' 등). null = 말머리 없음(공지 등). */
  category: string | null;
  /** 작성자 이름 — null = 어드민 작성 공지. */
  authorName: string | null;
  /** 회원 작성자 id — null = 어드민 공지. 신고·차단용. */
  authorId: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export type EventStatus = 'always' | 'upcoming' | 'ongoing' | 'ended';

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  always: '상시',
  upcoming: '예정',
  ongoing: '진행중',
  ended: '종료',
};

/** KST 기준 오늘 날짜 ('YYYY-MM-DD'). */
function todayKst(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}

export function eventStatus(p: Pick<EventPost, 'startsAt' | 'endsAt'>): EventStatus {
  if (!p.startsAt && !p.endsAt) return 'always';
  const today = todayKst();
  if (p.startsAt && today < p.startsAt) return 'upcoming';
  if (p.endsAt && today > p.endsAt) return 'ended';
  return 'ongoing';
}

/** '2026-06-15' → '2026.06.15', 기간 라벨 '2026.06.15 ~ 2026.06.30' 형태. 기간 없으면 ''. */
export function eventPeriodLabel(p: Pick<EventPost, 'startsAt' | 'endsAt'>): string {
  const fmt = (d: string) => d.replaceAll('-', '.');
  if (!p.startsAt && !p.endsAt) return '';
  if (p.startsAt && p.endsAt) return `${fmt(p.startsAt)} ~ ${fmt(p.endsAt)}`;
  if (p.startsAt) return `${fmt(p.startsAt)} ~`;
  return `~ ${fmt(p.endsAt!)}`;
}
