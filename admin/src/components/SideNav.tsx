'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { NAV_GROUPS as GROUPS, activeGroupTitle, isActive } from '@/lib/nav';

const STORAGE_KEY = 'arvo:admin:nav-groups';

export function SideNav({ who }: { who?: string | null }) {
  const pathname = usePathname();
  // 서버·첫 렌더는 항상 전부 펼침 → 하이드레이션 불일치 없음. 저장값은 마운트 후 반영.
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setClosed(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* 저장소를 못 읽어도 전부 펼친 기본값으로 동작한다. */
    }
  }, []);

  // 지금 보고 있는 페이지가 접힌 그룹 안에 있으면 그 그룹만 펼쳐 준다.
  const activeGroup = activeGroupTitle(pathname);
  useEffect(() => {
    if (!activeGroup) return;
    setClosed((prev) => (prev[activeGroup] ? { ...prev, [activeGroup]: false } : prev));
  }, [activeGroup]);

  // 모바일 드로어는 페이지를 옮기면 닫는다.
  useEffect(() => { setDrawer(false); }, [pathname]);

  const toggle = useCallback((title: string, open: boolean) => {
    setClosed((prev) => {
      if (!!prev[title] === !open) return prev;
      const next = { ...prev, [title]: !open };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 저장 실패는 무시 */ }
      return next;
    });
  }, []);

  return (
    <>
      <div className="admin-topbar">
        <button
          type="button"
          className="admin-burger"
          onClick={() => setDrawer((v) => !v)}
          aria-label={drawer ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={drawer}
        >
          {drawer ? '✕' : '☰'}
        </button>
        <span className="admin-topbar-title">ARVOTCG Admin</span>
      </div>

      {drawer ? <div className="admin-backdrop" onClick={() => setDrawer(false)} aria-hidden /> : null}

      <aside className={drawer ? 'admin-side open' : 'admin-side'}>
        <div className="admin-brand">
          ARVOTCG Admin
          <small>{who ? `${who} 님` : '운영 대시보드'}</small>
        </div>
        <nav className="admin-nav">
          {GROUPS.map((g) => (
            <details
              key={g.title}
              className="admin-nav-group"
              open={!closed[g.title]}
              onToggle={(e) => toggle(g.title, (e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="admin-nav-title">
                <span className="admin-nav-chev" aria-hidden />
                <span>{g.title}</span>
                <span className="admin-nav-count">{g.items.length}</span>
              </summary>
              <div className="admin-nav-items">
                {g.items.map((n) => (
                  <Link key={n.href} href={n.href} className={isActive(n.href, pathname) ? 'on' : ''}>
                    <span>{n.icon}</span>
                    <span>{n.label}</span>
                  </Link>
                ))}
              </div>
            </details>
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
    </>
  );
}
