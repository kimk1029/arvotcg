'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { useCurrency } from '@/components/CurrencyProvider';
import { StatusBar } from '@/components/ui/StatusBar';
import { useUnread } from '@/components/UnreadProvider';
import { signOut } from '@/lib/session';
import type { LevelInfo } from '@/lib/level';

/**
 * /my — 마이페이지. Claude Design 'ARVOTCG 마이페이지' 프로토타입 레이아웃
 * (홈·커뮤니티와 동일하게 모든 테마 공통 단일 디자인 — 라이트/화이트 카드/오렌지 포인트).
 * 모바일 mobile/app/my.tsx 와 페어.
 */

interface Props {
  user: { name?: string | null; email?: string | null };
  level: LevelInfo;
  cardCount: number;
  tradeCount: number;
  savedCount: number;
  /** 미로그인 게스트 모드 — 로그아웃 대신 로그인 CTA, 포트폴리오는 안내 문구. */
  isGuest?: boolean;
  /** 어드민 계정(ADMIN_EMAILS) 이면 관리자 메뉴 노출. */
  isAdmin?: boolean;
}

/* 프로토타입 고정 팔레트 — 테마 무관 */
const P = {
  pageBg: '#F7F7F9',
  card: '#FFFFFF',
  ink: '#16161a',
  sub: '#9A9AA0',
  sub2: '#8E8E93',
  line: '#F4F4F6',
  headerLine: '#F0F0F2',
  chip: '#F0F0F2',
  orange: '#FF7A00',
  red: '#F5333F',
  blue: '#2F6BFF',
  chev: '#C2C2C8',
};

const CARD_SHADOW = '0 2px 10px rgba(0,0,0,.05)';
const CARD_SHADOW_SOFT = '0 2px 10px rgba(0,0,0,.04)';

interface MenuItem {
  emoji: string;
  iconBg: string;
  label: string;
  sub?: string;
  badge?: string;
  href?: string;
  disabled?: boolean;
}

function ChevronSvg({ s = 16 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={P.chev} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function MyScreen({ user, level, cardCount, tradeCount, savedCount, isGuest, isAdmin }: Props) {
  const router = useRouter();
  const { format } = useCurrency();
  const { count: unread } = useUnread();
  const p = level;
  const xpPct = Math.max(0, Math.min(100, Math.round((p.xp / p.xpNeeded) * 100)));

  // 이름 편집 — PATCH /api/me/name (기존 EditableName 로직, 디자인 스타일).
  const [name, setName] = useState(user?.name ?? (isGuest ? '게스트' : '트레이너'));
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  // 포트폴리오 컴팩트 카드 — /api/me/portfolio.
  const [pf, setPf] = useState<{ totalJpy: number; changePct: number | null; history: number[] } | null>(null);
  useEffect(() => {
    if (isGuest) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/me/portfolio', { credentials: 'include', cache: 'no-store' });
        if (!r.ok || !alive) return;
        const j = (await r.json()) as { data?: { totalJpy: number; changePct: number | null; totalCount: number; history: Array<{ totalJpy: number }> } };
        const d = j.data;
        if (!d || d.totalCount === 0) return;
        if (alive) setPf({ totalJpy: d.totalJpy, changePct: d.changePct, history: (d.history ?? []).map((h) => h.totalJpy) });
      } catch {
        /* 시세 실패 시 정적 표시 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [isGuest]);

  const saveName = async () => {
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/me/name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setName(trimmed);
      setEditing(false);
      router.refresh();
    } catch {
      /* 실패 시 편집 상태 유지 */
    } finally {
      setBusy(false);
    }
  };

  const pfUp = (pf?.changePct ?? 0) >= 0;
  const pfColor = pfUp ? P.red : P.blue;

  const activity: MenuItem[] = [
    { emoji: '✉️', iconBg: '#E3F6EC', label: '쪽지함', sub: '새 쪽지를 확인하세요', badge: unread > 0 ? `${unread > 99 ? '99+' : unread}` : undefined, href: '/my/messages' },
    { emoji: '📈', iconBg: '#FFF1E6', label: '포트폴리오', sub: '보유 카드 평가액과 수익률', href: '/my/portfolio' },
    { emoji: '🃏', iconBg: '#E0EDFF', label: '내 카드', sub: `등록한 카드 ${cardCount}장 관리`, href: '/my/cards' },
    { emoji: '🤝', iconBg: '#F4F1FF', label: '내 거래', sub: '판매·구매 내역', href: '/my/trades' },
    { emoji: '❤️', iconBg: '#FFECEC', label: '찜한 글', sub: '북마크한 게시글', href: '/my/bookmarks' },
    { emoji: '⭐', iconBg: '#FFF6DE', label: '관심카드', sub: '찜한 시세 카드', href: '/my/favorites' },
    { emoji: '🗣', iconBg: '#F1EAFF', label: '내 피드', sub: '내가 쓴 커뮤니티 글', href: '/my/feeds' },
  ];

  const settings: MenuItem[] = [
    ...(isAdmin ? [{ emoji: '🛠', iconBg: '#E0EDFF', label: '어드민 · 콘텐츠 관리', href: '/admin' } satisfies MenuItem] : []),
    { emoji: '📢', iconBg: '#FFF6DE', label: '공지사항', badge: 'NEW', href: '/my/notices' },
    { emoji: '❓', iconBg: '#E0EDFF', label: 'FAQ · 자주 묻는 질문', href: '/my/faq' },
    { emoji: '📜', iconBg: '#F0F0F2', label: '이용약관', href: '/terms' },
    { emoji: '🔒', iconBg: '#E3F6EC', label: '개인정보처리방침', href: '/privacy' },
    { emoji: '🔔', iconBg: '#F0F0F2', label: '알림 설정', sub: '준비중', disabled: true },
  ];

  return (
    <div style={{ background: P.pageBg, minHeight: '100%' }}>
      <StatusBar />

      {/* header — 디자인: 내 프로필 + 상점(카트)·환경설정(기어) */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${P.headerLine}`, display: 'flex', alignItems: 'center', padding: '8px 20px 12px' }}>
        <div style={{ flex: 1, fontSize: 24, fontWeight: 900, color: P.ink, letterSpacing: -0.6 }}>내 프로필</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/my/shop" aria-label="상점" style={{ display: 'flex' }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1.6" /><circle cx="19" cy="21" r="1.6" /><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6" /></svg>
          </Link>
          <Link href="/my/settings" aria-label="환경설정" style={{ display: 'flex' }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
          </Link>
        </div>
      </div>

      {/* profile card */}
      <div style={{ padding: '16px 16px 10px' }}>
        <div style={{ background: P.card, borderRadius: 20, padding: 20, boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', flex: 'none' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(150deg,#3b5bdb,#1e2f8f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 6px 14px rgba(40,70,200,.3)' }}>💎</div>
              <div style={{ position: 'absolute', bottom: -5, right: -5, background: P.orange, color: '#fff', fontSize: 10, fontWeight: 900, padding: '3px 7px', borderRadius: 9, border: '2.5px solid #fff' }}>LV.{p.level}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    value={input}
                    autoFocus
                    disabled={busy}
                    maxLength={20}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); saveName(); }
                      if (e.key === 'Escape') { setEditing(false); }
                    }}
                    style={{ flex: 1, minWidth: 0, background: P.pageBg, border: 'none', outline: 'none', borderRadius: 10, padding: '7px 10px', fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: 'inherit' }}
                  />
                  <button type="button" onClick={saveName} disabled={busy} style={miniBtn(P.orange, '#fff')}>{busy ? '…' : '✓'}</button>
                  <button type="button" onClick={() => setEditing(false)} style={miniBtn(P.chip, P.sub2)}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: P.ink, letterSpacing: -0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  {!isGuest && (
                    <button type="button" aria-label="닉네임 수정" onClick={() => { setInput(name); setEditing(true); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flex: 'none' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: P.orange }}>★ {p.title}</span>
                <span style={{ fontSize: 11.5, color: P.sub, fontWeight: 600 }}>· LV.{p.level}</span>
              </div>
            </div>
          </div>

          {/* XP */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: P.sub, marginBottom: 6 }}>
              <span>XP {p.xp} / {p.xpNeeded}</span>
              <span>다음 LV.까지 <span style={{ color: P.ink }}>{p.xpNeeded - p.xp} XP</span></span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: P.chip, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(xpPct, 6)}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#FF9A4D,#FF7A00)' }} />
            </div>
          </div>

          {/* compact portfolio */}
          <Link href={isGuest ? '/login' : '/my/portfolio'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, background: P.pageBg, borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.sub }}>포트폴리오</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: P.ink, letterSpacing: -0.4 }}>
                  {isGuest ? '로그인 후 확인' : pf ? format(pf.totalJpy) : '계산 중…'}
                </span>
                {pf?.changePct != null && (
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: pfColor }}>
                    {pfUp ? '+' : ''}{pf.changePct.toFixed(1)}% {pfUp ? '▲' : '▼'}
                  </span>
                )}
              </div>
            </div>
            {pf && pf.history.length >= 2 && <Sparkline points={pf.history} color={pfColor} />}
            <ChevronSvg s={15} />
          </Link>
        </div>
      </div>

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, padding: '0 16px 20px' }}>
        {([
          [cardCount, '내 카드'],
          [tradeCount, '내 거래'],
          [savedCount, '찜한 글'],
        ] as const).map(([n, label]) => (
          <div key={label} style={{ background: P.card, borderRadius: 16, padding: '15px 12px', textAlign: 'center', boxShadow: CARD_SHADOW_SOFT }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: P.ink }}>{n}</div>
            <div style={{ fontSize: 11.5, color: P.sub2, fontWeight: 600, marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 내 활동 */}
      <div style={{ fontSize: 17, fontWeight: 800, color: P.ink, padding: '0 20px 12px' }}>내 활동</div>
      <MenuCard items={activity} />

      {/* 설정 */}
      <div style={{ fontSize: 17, fontWeight: 800, color: P.ink, padding: '0 20px 12px' }}>설정</div>
      <MenuCard items={settings} />

      {/* 로그아웃 / 로그인 */}
      <div style={{ padding: '0 16px 8px' }}>
        {isGuest ? (
          <Link href="/login" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: P.orange, borderRadius: 18, padding: '15px 0', color: '#fff', fontSize: 14.5, fontWeight: 800, boxShadow: CARD_SHADOW_SOFT }}>
            로그인하기
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => signOut('/')}
            style={{ display: 'block', width: '100%', textAlign: 'center', background: P.card, border: 'none', cursor: 'pointer', borderRadius: 18, padding: '15px 0', color: P.red, fontSize: 14.5, fontWeight: 800, boxShadow: CARD_SHADOW_SOFT, fontFamily: 'inherit' }}
          >
            로그아웃
          </button>
        )}
      </div>
      <div className="bggap" />
    </div>
  );
}

/** 화이트 라운드 카드 안 메뉴 행 리스트 — 디자인 sc-for 행 그대로. */
function MenuCard({ items }: { items: MenuItem[] }) {
  return (
    <div style={{ padding: '0 16px 28px' }}>
      <div style={{ background: P.card, borderRadius: 18, overflow: 'hidden', boxShadow: CARD_SHADOW_SOFT }}>
        {items.map((m, i) => {
          const inner = (
            <>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: m.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flex: 'none' }}>{m.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: P.ink }}>{m.label}</div>
                {m.sub && <div style={{ fontSize: 11.5, color: P.sub, fontWeight: 600, marginTop: 2 }}>{m.sub}</div>}
              </div>
              {m.badge && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: P.red, padding: '2px 8px', borderRadius: 9, flex: 'none' }}>{m.badge}</span>}
              {!m.disabled && <ChevronSvg />}
            </>
          );
          const rowStyle: CSSProperties = { textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', borderTop: i === 0 ? '1px solid transparent' : `1px solid ${P.line}`, cursor: m.disabled ? 'default' : 'pointer', opacity: m.disabled ? 0.45 : 1 };
          return m.href && !m.disabled ? (
            <Link key={m.label} href={m.href} style={rowStyle}>{inner}</Link>
          ) : (
            <div key={m.label} style={rowStyle}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

/** 포트폴리오 스파크라인 — 88×28, history 정규화. 상승=빨강(디자인)/하락=파랑. */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const W = 100;
  const H = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  const step = W / (points.length - 1);
  const coords = points.map((v, i) => ({ x: i * step, y: H - 4 - ((v - min) / span) * (H - 8) }));
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ flex: 'none', width: 88, height: 28 }}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </svg>
  );
}

function miniBtn(bg: string, color: string): CSSProperties {
  return { width: 30, height: 30, borderRadius: 10, background: bg, color, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, display: 'inline-grid', placeItems: 'center', flex: 'none' };
}
