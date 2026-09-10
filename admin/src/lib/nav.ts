/**
 * 어드민 사이드메뉴 구성과 경로 판정 — 화면(SideNav)과 분리한 순수 로직.
 * 메뉴를 추가할 땐 GROUPS 만 고치면 된다.
 */

export interface NavItem { href: string; label: string; icon: string }
export interface NavGroup { title: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    title: '운영',
    items: [
      { href: '/', label: '대시보드', icon: '📊' },
      { href: '/monitoring', label: '시스템 상태', icon: '🩺' },
    ],
  },
  {
    title: '콘텐츠',
    items: [
      { href: '/notices', label: '공지사항', icon: '📢' },
      { href: '/banners', label: '히어로 배너', icon: '🎏' },
      { href: '/event-posts', label: '이벤트 게시판', icon: '📅' },
      { href: '/cardshow', label: '카드쇼 예약', icon: '🎪' },
      { href: '/feeds', label: '커뮤니티 글', icon: '📝' },
      { href: '/cards', label: '카드 카탈로그', icon: '🃏' },
    ],
  },
  {
    title: '회원',
    items: [
      { href: '/users', label: '회원 관리', icon: '👥' },
      { href: '/ranking', label: '포인트 랭킹', icon: '🏆' },
      { href: '/online', label: '접속중 사용자', icon: '🟢' },
      { href: '/messages', label: '쪽지 목록', icon: '✉️' },
      { href: '/bug-reports', label: '버그 제보', icon: '🐛' },
    ],
  },
  {
    title: '거래·오리파',
    items: [
      { href: '/trades', label: '거래 관리', icon: '🤝' },
      { href: '/shops', label: '카드샵 관리', icon: '🏪' },
      { href: '/oripa/packs', label: '오리파 팩', icon: '🎁' },
      { href: '/oripa', label: '오리파 티켓', icon: '🎟️' },
    ],
  },
  {
    title: '지표·로그',
    items: [
      { href: '/server-logs', label: '서버 로그', icon: '📜' },
      { href: '/visitors', label: '방문 기록', icon: '🚪' },
      { href: '/events', label: '행동 로그', icon: '🖱️' },
      { href: '/searches', label: '검색 로그', icon: '🔍' },
      { href: '/scans', label: '스캔 로그', icon: '📷' },
      { href: '/ads', label: '광고 분석', icon: '📈' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/**
 * 이 메뉴가 현재 경로를 가리키는가.
 * 더 긴 prefix 를 가진 메뉴가 이기므로 `/oripa` 는 `/oripa/packs` 에서 켜지지 않는다.
 */
export function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  const longerMatches = ALL_ITEMS.some(
    (m) =>
      m.href !== href &&
      m.href.startsWith(href + '/') &&
      (pathname === m.href || pathname.startsWith(m.href + '/')),
  );
  return !longerMatches && (pathname === href || pathname.startsWith(href + '/'));
}

/** 현재 경로가 속한 그룹 제목. 어디에도 없으면 null. */
export function activeGroupTitle(pathname: string): string | null {
  for (const g of NAV_GROUPS) {
    if (g.items.some((i) => isActive(i.href, pathname))) return g.title;
  }
  return null;
}
