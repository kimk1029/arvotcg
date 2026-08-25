'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: '대시보드', icon: '📊' },
  { href: '/banners', label: '히어로 배너', icon: '🎏' },
  { href: '/event-posts', label: '이벤트 게시판', icon: '📅' },
  { href: '/users', label: '회원 관리', icon: '👥' },
  { href: '/ranking', label: '포인트 랭킹', icon: '🏆' },
  { href: '/events', label: '행동 로그', icon: '🖱️' },
  { href: '/searches', label: '검색 로그', icon: '🔍' },
  { href: '/scans', label: '스캔 로그', icon: '📷' },
  { href: '/cards', label: '카드 카탈로그', icon: '🃏' },
  { href: '/feeds', label: '피드 관리', icon: '📝' },
  { href: '/messages', label: '쪽지 목록', icon: '✉️' },
  { href: '/trades', label: '거래 관리', icon: '🤝' },
  { href: '/shops', label: '카드샵 관리', icon: '🏪' },
  { href: '/oripa/packs', label: '오리파 팩', icon: '🎁' },
  { href: '/oripa', label: '오리파 티켓', icon: '🎟️' },
  { href: '/ads', label: '광고 분석', icon: '📢' },
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <aside className="admin-side">
      <div className="admin-brand">
        ARVOTCG Admin
        <small>운영 대시보드</small>
      </div>
      <nav className="admin-nav">
        {NAV.map((n) => {
          // 더 긴 prefix 가 있으면 짧은 prefix 는 무시 (/oripa 가 /oripa/packs 일 때 highlight 안 되게)
          const longerMatches = NAV.some(
            (m) => m.href !== n.href && m.href.startsWith(n.href + '/') && (pathname === m.href || pathname.startsWith(m.href + '/')),
          );
          const on = n.href === '/'
            ? pathname === '/'
            : !longerMatches && (pathname === n.href || pathname.startsWith(n.href + '/'));
          return (
            <Link key={n.href} href={n.href} className={on ? 'on' : ''}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          );
        })}
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
