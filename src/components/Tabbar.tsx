'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LineIcon, type LineIconName } from './Icons';
import { useTheme } from './ThemeProvider';
import { useNavPrefs } from './NavPrefsProvider';
import { isFlatTheme } from '@/lib/theme';

type TabId = 'home' | 'collection' | 'fab' | 'community' | 'my';

interface Tab {
  id: TabId;
  label: string;
  icon?: LineIconName;
  href: string;
  fab?: boolean;
}

const TABS: Tab[] = [
  { id: 'home', label: '홈', icon: 'home', href: '/' },
  { id: 'collection', label: '컬렉션', icon: 'collection', href: '/my/cards' },
  { id: 'fab', label: '추가', href: '/cards/add', fab: true },
  { id: 'community', label: '커뮤니티', icon: 'community', href: '/feed' },
  { id: 'my', label: '프로필', icon: 'my', href: '/my' },
];

function activeId(pathname: string): TabId | '' {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/my/cards')) return 'collection';
  if (pathname.startsWith('/cards/add')) return 'fab';
  if (pathname.startsWith('/cards/grading')) return 'fab';
  if (pathname.startsWith('/feed')) return 'community';
  if (pathname.startsWith('/trade')) return 'community';
  if (pathname.startsWith('/events')) return 'home';
  if (pathname.startsWith('/cards')) return 'home';
  if (pathname.startsWith('/my')) return 'my';
  if (pathname.startsWith('/write/feed')) return 'community';
  if (pathname.startsWith('/write/trade')) return 'community';
  return '';
}

export function Tabbar(_props: { onFab?: () => void } = {}) {
  const pathname = usePathname();
  const active = activeId(pathname);
  const [ballAnim, setBallAnim] = useState(false);
  const { theme } = useTheme();
  const { navStyle } = useNavPrefs();
  // navStyle 은 마운트 후 localStorage 에서 로드된다. 그 전(SSR/첫 페인트)엔 기본값
  // (통합형) 바가 잠깐 그려져 플로팅 사용자에게 풀바 배경·상하 보더가 깜빡인다.
  // 마운트 전까지 숨겨(visibility) 잘못된 바가 보이지 않게 한다(레이아웃은 유지).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const hideUntilReady = mounted ? undefined : ('hidden' as const);

  const handleFabClick = () => {
    setBallAnim(false);
    requestAnimationFrame(() => setBallAnim(true));
  };

  // ── 분리형(플로팅) ── 아이콘 + 작은 한글 라벨 + 가운데 강조 버튼을 바 안으로(돌출 X).
  if (navStyle === 'floating') {
    return (
      <nav className="tabbar tabbar--floating" aria-label="하단 네비게이션" style={{ visibility: hideUntilReady }}>
        {TABS.map((t) => {
          const on = active === t.id;
          if (t.fab) {
            return (
              <Link key={t.id} href={t.href} className={`tab fab-mini-tab${on ? ' on' : ''}`} aria-label={t.label}>
                <span className="fab-mini">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </Link>
            );
          }
          return (
            <Link key={t.id} href={t.href} className={`tab${on ? ' on' : ''}`} aria-label={t.label}>
              {t.icon && <LineIcon name={t.icon} />}
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="tabbar" style={{ visibility: hideUntilReady }}>
      {TABS.map((t) => {
        const cls = ['tab', active === t.id ? 'on' : '', t.fab ? 'fab-tab' : '']
          .filter(Boolean)
          .join(' ');

        if (t.fab) {
          return (
            <Link
              key={t.id}
              href={t.href}
              className={cls}
              aria-label="카드 추가"
              onClick={handleFabClick}
            >
              <div
                className={`fab-circle${ballAnim ? ' fab-click' : ''}`}
                onAnimationEnd={() => setBallAnim(false)}
              >
                {/* 원피스 테마 — 둥근 버튼을 꽉 채우는 탑뷰 밀짚모자. */}
                {theme === 'onepiece' && (
                  <svg
                    className="fab-strawhat"
                    viewBox="0 0 100 100"
                    width="60"
                    height="60"
                    aria-hidden
                  >
                    {/* 브림 — stroke 없음(버튼 보더가 유일한 테두리). 배경 짚색과 이음 */}
                    <circle cx="50" cy="50" r="47" fill="#F4D272" />
                    <circle cx="50" cy="50" r="47" fill="none" stroke="#D8B25A" strokeWidth="2" opacity="0.6" />
                    {/* 짚 짜임 — 바깥 링 짧은 방사 눈금(코너로 삐져나오지 않게 길이 제한) */}
                    <g stroke="rgba(120,80,20,.28)" strokeWidth="1.4">
                      <line x1="50" y1="6" x2="50" y2="15" />
                      <line x1="50" y1="85" x2="50" y2="94" />
                      <line x1="6" y1="50" x2="15" y2="50" />
                      <line x1="85" y1="50" x2="94" y2="50" />
                      <line x1="20" y1="20" x2="26" y2="26" />
                      <line x1="80" y1="20" x2="74" y2="26" />
                      <line x1="20" y1="80" x2="26" y2="74" />
                      <line x1="80" y1="80" x2="74" y2="74" />
                    </g>
                    {/* 짚 짜임 — 동심원 */}
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(120,80,20,.2)" strokeWidth="1.4" />
                    {/* 빨간 밴드 */}
                    <circle cx="50" cy="50" r="34" fill="#E63946" />
                    {/* 크라운(윗면) */}
                    <circle cx="50" cy="50" r="25" fill="#E3B45A" stroke="#C99A4A" strokeWidth="1.5" />
                    {/* 하이라이트 */}
                    <ellipse cx="42" cy="42" rx="8" ry="4.5" fill="#FFF1C9" opacity="0.5" />
                  </svg>
                )}

                {/* 유희왕 테마 — 역피라미드 황금 펜던트 + 호루스의 눈 (자체 드로잉). */}
                {theme === 'yugioh' && (
                  <svg
                    className="fab-pendant"
                    viewBox="0 0 100 100"
                    width="62"
                    height="62"
                    aria-hidden
                  >
                    {/* 본체 — 아래로 뾰족한 역피라미드 */}
                    <polygon
                      points="50,97 5,18 95,18"
                      fill="#E0AC2E"
                      stroke="#4A3408"
                      strokeWidth="3"
                      strokeLinejoin="round"
                    />
                    {/* 좌측 절반 음영 — 금속 입체감 */}
                    <polygon points="50,97 5,18 50,18" fill="#C9941C" />
                    {/* 상단 베벨(윗변 모서리 빛) */}
                    <polygon points="5,18 95,18 86,28 14,28" fill="#F2D470" />
                    {/* 내부 능선 — 베벨에서 꼭짓점으로 모이는 이중 프레임 */}
                    <polyline
                      points="14,28 50,89 86,28"
                      fill="none"
                      stroke="#8F6A0E"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    {/* 호루스의 눈 — 눈썹/눈매/동공/꼬리 장식 */}
                    <g stroke="#3A2606" strokeLinecap="round" fill="none">
                      <path d="M31 41 Q50 30 69 41" strokeWidth="4" />
                      <path d="M29 51 Q50 38 71 51 Q50 62 29 51 Z" fill="#FBF4DE" strokeWidth="3" />
                      <circle cx="50" cy="50" r="5.5" fill="#3A2606" stroke="none" />
                      {/* 왼쪽 — 나선 꼬리 */}
                      <path d="M42 60 L40 70 Q39 76 33 74" strokeWidth="3.2" />
                      {/* 오른쪽 — 사선 눈물 자국 */}
                      <path d="M58 60 L63 72" strokeWidth="3.2" />
                    </g>
                    {/* 우상단 하이라이트 */}
                    <polygon points="60,18 78,18 70,26 58,26" fill="#FFF0B8" opacity="0.7" />
                  </svg>
                )}

                {/* 클린 테마 — 화이트 스캔 프레임 아이콘 (전용 FAB 가 있는 테마 제외). */}
                {isFlatTheme(theme) && theme !== 'yugioh' && theme !== 'onepiece' && (
                  <svg
                    className="fab-scan"
                    viewBox="0 0 24 24"
                    width="28"
                    height="28"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M4 9 V7 A3 3 0 0 1 7 4 H9" />
                    <path d="M15 4 H17 A3 3 0 0 1 20 7 V9" />
                    <path d="M20 15 V17 A3 3 0 0 1 17 20 H15" />
                    <path d="M9 20 H7 A3 3 0 0 1 4 17 V15" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                  </svg>
                )}
              </div>
            </Link>
          );
        }

        return (
          <Link key={t.id} href={t.href} className={cls}>
            {t.icon && <LineIcon name={t.icon} />}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

