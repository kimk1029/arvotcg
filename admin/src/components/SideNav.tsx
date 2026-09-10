'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem { href: string; label: string; icon: string }

const GROUPS: { title: string; items: NavItem[] }[] = [
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
      { href: '/visitors', label: '방문 기록', icon: '🚪' },
      { href: '/events', label: '행동 로그', icon: '🖱️' },
      { href: '/searches', label: '검색 로그', icon: '🔍' },
      { href: '/scans', label: '스캔 로그', icon: '📷' },
      { href: '/ads', label: '광고 분석', icon: '📈' },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

export function SideNav({ who }: { who?: string | null }) {
  const pathname = usePathname();
  const isOn = (href: string) => {
    if (href === '/') return pathname === '/';
    // 더 긴 prefix 가 있으면 짧은 prefix 는 무시 (/oripa 가 /oripa/packs 일 때 highlight 안 되게)
    const longerMatches = ALL.some(
      (m) => m.href !== href && m.href.startsWith(href + '/') && (pathname === m.href || pathname.startsWith(m.href + '/')),
    );
    return !longerMatches && (pathname === href || pathname.startsWith(href + '/'));
  };
  return (
    <aside className="admin-side">
      <div className="admin-brand">
        ARVOTCG Admin
        <small>{who ? `${who} 님` : '운영 대시보드'}</small>
      </div>
      <nav className="admin-nav">
        {GROUPS.map((g) => (
          <div key={g.title} className="admin-nav-group">
            <div className="admin-nav-title">{g.title}</div>
            {g.items.map((n) => (
              <Link key={n.href} href={n.href} className={isOn(n.href) ? 'on' : ''}>
                <span>{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <button
        type="button"
        className="admin-logout"
        onClick={async () => {
          await fetch('/api/logout', { method: 'POST' }).catch(() => {});
          window.location.href = '/login';
        }}
      >
        <span>🚪</span>
        <span>로그아웃</span>
      </button>
    </aside>
  );
}
