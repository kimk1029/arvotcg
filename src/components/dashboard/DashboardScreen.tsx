'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { AppBarUser } from '@/components/AppBarUser';
import { CardThumb } from '@/components/CardThumb';
import { useCurrency } from '@/components/CurrencyProvider';
import { PIXEL_BORDER } from '@/components/pixelBorder';
import { useHomePrefs } from '@/components/HomePrefsProvider';
import { HeroSlider, type HeroSlideData } from '@/components/HeroSlider';
import { PortfolioHero } from '@/components/PortfolioHero';
import { AppBar } from '@/components/ui/AppBar';
import { Panel } from '@/components/ui/Panel';
import { StatusBar } from '@/components/ui/StatusBar';
import { useTheme } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import type { MyCardWithPrice } from '@/lib/queries';
import { translateKnownCardNameToKo } from '@/lib/cardTranslate';

// ── 바로가기 클린 라인 아이콘 ───────────────────────────────────────────
// 모든 박스 테두리/그림자는 <Panel> 이 테마별로 관리한다(픽셀 인라인 섀도우 금지).

// 바로가기 색 키 → 클린 라인 아이콘 색(강/소프트 면).
const CLEAN_ICON_COLORS: Record<string, { fg: string; bg: string }> = {
  'var(--grn)': { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
  'var(--gold)': { fg: 'var(--gold)', bg: 'var(--gold-soft)' },
  'var(--blu)': { fg: 'var(--blu)', bg: 'var(--blu-soft)' },
  'var(--red)': { fg: 'var(--red)', bg: 'var(--red-soft)' },
};

const lineIcon = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function ScanLineIcon() {
  return (
    <svg {...lineIcon}>
      <path d="M4 9V6.5A1.5 1.5 0 0 1 5.5 5H8" />
      <path d="M16 5h2.5A1.5 1.5 0 0 1 20 6.5V9" />
      <path d="M20 15v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 19H5.5A1.5 1.5 0 0 1 4 17.5V15" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function PriceLineIcon() {
  return (
    <svg {...lineIcon}>
      <path d="M4 13.5 11.5 6H18a1 1 0 0 1 1 1v6.5L11.5 21z" />
      <circle cx="14.5" cy="9.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function AuctionLineIcon() {
  return (
    <svg {...lineIcon}>
      <path d="M13.5 3.5 19 9l-2.5 2.5L11 6z" />
      <path d="M11.5 7.5 5 14" />
      <path d="M8 10.5 12 14.5" />
      <path d="M4 20.5h9" />
    </svg>
  );
}
function MarketLineIcon() {
  return (
    <svg {...lineIcon}>
      <path d="M4.5 9 6 5h12l1.5 4" />
      <path d="M4.5 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 3 0" />
      <path d="M5.5 11v8h13v-8" />
      <path d="M10 19v-4h4v4" />
    </svg>
  );
}
function TradeLineIcon() {
  return (
    <svg {...lineIcon}>
      <path d="M5 8h12" />
      <path d="M14 5 17 8l-3 3" />
      <path d="M19 16H7" />
      <path d="M10 13 7 16l3 3" />
    </svg>
  );
}
function SearchLineIcon() {
  return (
    <svg {...lineIcon}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function EventLineIcon() {
  return (
    <svg {...lineIcon}>
      <rect x="4" y="5.5" width="16" height="14" rx="1.5" />
      <path d="M4 9.5h16" />
      <path d="M8 3.5v4" />
      <path d="M16 3.5v4" />
    </svg>
  );
}

export type SnkrdunkCategory = 'SAR' | '프로모' | 'SR' | '원피스';

export interface SnkrdunkRow {
  apparelId: number;
  shortName: string;
  /** 일본어 원문 (소제목 노출용). 비어 있으면 표시 생략. */
  localizedName?: string;
  /** 상세 조회로 확정된 분류 — HOT 카드(싱글 전용) 섹션의 박스 제외에 사용. */
  itemKind?: 'single' | 'box';
  category: SnkrdunkCategory | null;
  imageUrl: string | null;
  /** 최저 매물가(라이브 호가). */
  minPrice: number;
  /** 대표 시세 — 시세상세 헤드라인과 동일(거래 많은 등급의 최근 체결가). 없으면 minPrice 로 폴백 표시. */
  recentPrice?: number;
  /** 대표 시세의 등급 기준('PSA 10' | 'PSA 9' | 'RAW') — 'PSA 10' 이면 HOT 카드 우하단에 PSA10 마크. */
  basis?: string;
  listingCountText: string;
  /** 등락률(%) — 판매 차트 기간 시세 변화. 양수=상승, 음수=하락. 데이터 없으면 미표시. */
  changePct?: number;
}

export interface PackHitCardRow {
  apparelId: number;
  shortName: string;
  imageUrl: string | null;
  minPrice: number;
  listingCountText: string;
}

export interface PackRow {
  code: string;
  name: string;
  shortName: string;
  emoji: string;
  bg: string;
  releasedAt?: string;
  hits: PackHitCardRow[];
  boxes?: PackHitCardRow[];
}

interface Props {
  cards: MyCardWithPrice[];
  heroBanners?: HeroSlideData[];
  isLoggedIn: boolean;
  snkrdunkRows?: SnkrdunkRow[];
  /** 인기 박스 목록(박스류만). 비어 있으면 박스 섹션 미노출. */
  snkrdunkBoxRows?: SnkrdunkRow[];
  packs?: PackRow[];
}

const SNKR_CAT_BG: Record<SnkrdunkCategory, string> = {
  SAR: 'var(--orn)',
  프로모: 'var(--pur)',
  SR: 'var(--red)',
  원피스: 'var(--grn-dk)',
};
const SNKR_FALLBACK_BG = 'var(--ink2)';

type Rarity = 'C' | 'U' | 'R' | 'SR' | 'HR' | 'S';

const RAR_ORDER: Rarity[] = ['C', 'U', 'R', 'SR', 'HR', 'S'];
const RAR_COLORS: Record<Rarity, string> = {
  C: '#475569', U: '#22C55E', R: '#3A5BD9', SR: '#7C3AED', HR: '#EC4899', S: '#FFD23F',
};

const GAME_COLORS: Record<string, string> = {
  포켓몬: '#E63946', 유희왕: '#7C3AED', 원피스: '#F97316',
  MTG: '#22C55E', 스포츠: '#3A5BD9', 기타: '#94A3B8',
};

function KoreaMarketIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      aria-hidden
      style={{ display: 'block', shapeRendering: 'crispEdges' }}
    >
      <rect x="3" y="7" width="16" height="12" fill="#0F172A" />
      <rect x="5" y="9" width="12" height="8" fill="#FFFFFF" />
      <rect x="7" y="4" width="8" height="3" fill="#0F172A" />
      <rect x="8" y="2" width="6" height="3" fill="#FFFFFF" />
      <rect x="9" y="11" width="4" height="4" fill="#E63946" />
      <rect x="11" y="13" width="4" height="4" fill="#3A5BD9" />
      <rect x="6" y="11" width="2" height="2" fill="#0F172A" />
      <rect x="15" y="14" width="2" height="2" fill="#0F172A" />
    </svg>
  );
}
const ACTIVITY = [
  { icon: '🔥', c: 'var(--grn)', txt: '리자몽 EX 가격 ▲ +8%', time: '10분 전', pt: '+5P' },
  { icon: '📷', c: 'var(--blu)', txt: '카이바 슈라이 스캔 완료', time: '1시간 전', pt: '+10P' },
  { icon: '🤝', c: 'var(--gold)', txt: '피카츄 VMAX 거래 완료', time: '3시간 전', pt: '+15P' },
  { icon: '⭐', c: 'var(--pur)', txt: '레벨업! LV.12 달성', time: '어제', pt: '+50P' },
];

function fmt(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  return Math.round(n).toLocaleString();
}

/**
 * 테마별 인기 카드 검색 키워드 (snkrdunk 일본어 검색).
 * 서버가 내려주는 기본 rows 는 포켓몬 — 다른 카드게임 테마에서는
 * 클라이언트에서 해당 키워드로 교체 조회한다. (clean/dark/pokemon = 포켓몬 유지)
 */
const THEME_POPULAR_KEYWORD: Partial<Record<string, string>> = {
  onepiece: 'ワンピースカード',
  yugioh: '遊戯王',
  // 'スポーツカード'(애니 굿즈)·'MLB'(모자/티셔츠) 는 잡품이 섞임 —
  // 카드 브랜드명 Topps 가 실물 선수 트레카만 안정적으로 반환.
  sports: 'Topps',
};

/** 테마별 인기 박스 검색 키워드. 카드 키워드에 ' ボックス' 를 붙여 박스류를 끌어온다. */
const THEME_BOX_KEYWORD: Partial<Record<string, string>> = {
  onepiece: 'ワンピースカード ボックス',
  yugioh: '遊戯王 ボックス',
  sports: 'Topps ボックス',
};

// snkrdunk.ts classifySnkrdunkName 의 박스 마커와 일치시킬 것 (변경 시 양쪽 수정).
const BOX_NAME_RE = /ボックス|box|booster|ブースター|デッキビルド|スターター|拡張パック|ハイクラスパック|ポケモンセンターセット|シュリンク/i;
function isBoxName(name: string): boolean {
  return BOX_NAME_RE.test(name || '');
}

interface PopularSearchHit {
  apparelId: number;
  name: string;
  imageUrl: string | null;
  priceText: string;
}

function shuffleRows<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function searchHitToRow(r: PopularSearchHit): SnkrdunkRow {
  const ko = translateKnownCardNameToKo(r.name) || r.name;
  const cut = ko.split(/[|｜]/)[0].trim();
  return {
    apparelId: r.apparelId,
    shortName: cut.length > 22 ? cut.slice(0, 21) + '…' : cut,
    localizedName: r.name,
    category: null,
    imageUrl: r.imageUrl,
    minPrice: Number((r.priceText ?? '').replace(/[^\d]/g, '')) || 0,
    listingCountText: '',
  };
}

export function DashboardScreen({ cards, heroBanners, isLoggedIn, snkrdunkRows = [], snkrdunkBoxRows = [], packs = [] }: Props) {
  const { format } = useCurrency();
  const { theme } = useTheme();
  const isClean = isFlatTheme(theme);
  // 메인에 포트폴리오 hero 표시 여부 (기본 off). off 면 순서: 레벨→배너→바로가기→인기.
  const { showPortfolioOnMain } = useHomePrefs();

  const shortcutsNode = (
    <div style={{ margin: '0 var(--gap) var(--cg)' }}>
      <div className="sect-hd" style={{ marginBottom: 8 }}><h2>바로가기</h2></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6 }}>
        {([
          { icon: '🔍' as ReactNode, cleanIcon: <SearchLineIcon />, lb: '카드검색', bg: 'var(--blu)', href: '/cards/snkrdunk/search' },
          { icon: '¥' as ReactNode, cleanIcon: <PriceLineIcon />, lb: '시세확인', bg: 'var(--gold)', href: '/cards/packs' },
          { icon: '🔨' as ReactNode, cleanIcon: <AuctionLineIcon />, lb: 'MVC경매', bg: 'var(--red)', href: '/cards/mvc-auction' },
          { icon: '📅' as ReactNode, cleanIcon: <EventLineIcon />, lb: '이벤트', bg: 'var(--grn)', href: '/events' },
        ]).map(({ icon, cleanIcon, lb, bg, href }) => {
          const cc = CLEAN_ICON_COLORS[bg] ?? CLEAN_ICON_COLORS['var(--grn)'];
          return (
            <Link key={lb} href={href} className="dash-quick">
              <div style={isClean
                ? {
                    width: 40, height: 40, borderRadius: 14, background: cc.bg, color: cc.fg,
                    display: 'grid', placeItems: 'center',
                  }
                : {
                    width: 32, height: 32, background: bg, display: 'grid', placeItems: 'center', fontSize: 17,
                    boxShadow: '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),inset 0 3px 0 rgba(255,255,255,.3),inset 0 -2px 0 rgba(0,0,0,.25),3px 3px 0 var(--ink)',
                  }}>
                {isClean ? cleanIcon : icon}
              </div>
              <div style={{ fontFamily: 'var(--f1)', fontSize: 12, lineHeight: 1.1, letterSpacing: 0, whiteSpace: 'nowrap' }}>{lb}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );

  // 인기 카드 — off 면 자동 무한 좌측 스크롤(로테이션). 다크는 종목 리스트(스크롤 미적용).
  // 테마가 다른 카드게임(onepiece/yugioh/sports)이면 해당 게임 인기 카드로 교체.
  const popularKeyword = THEME_POPULAR_KEYWORD[theme];
  const [themePopular, setThemePopular] = useState<Record<string, SnkrdunkRow[]>>({});
  useEffect(() => {
    if (!popularKeyword || themePopular[theme]) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/snkrdunk/search?q=${encodeURIComponent(popularKeyword)}`);
        if (!alive || !r.ok) return;
        const j = (await r.json()) as { results?: PopularSearchHit[] };
        // 인기 카드 섹션은 싱글만 — 검색에 섞여 들어온 박스류는 제외.
        const hits = (j.results ?? []).filter((h) => !isBoxName(h.name));
        const rows = shuffleRows(hits).slice(0, 6).map(searchHitToRow);
        if (alive && rows.length > 0) setThemePopular((prev) => ({ ...prev, [theme]: rows }));
      } catch {
        /* 실패 시 포켓몬 기본 rows 유지 */
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, popularKeyword]);
  // 로딩 중에는 기본(포켓몬) rows 를 보여주다가 도착하면 부드럽게 교체.
  const popularRows = (popularKeyword && themePopular[theme]) || snkrdunkRows;

  const popularNode = popularRows.length > 0 ? (
    <PopularCardsSection
      rows={popularRows}
      theme={theme}
      isClean={isClean}
      format={format}
      autoScroll={!showPortfolioOnMain}
      moreHref={popularKeyword
        ? `/cards/snkrdunk/search?q=${encodeURIComponent(popularKeyword)}`
        : '/cards/snkrdunk'}
    />
  ) : null;

  // 인기 박스 — 카드와 동일한 패턴. 기본(포켓몬)은 서버 rows, 다른 카드게임 테마는
  // ' ボックス' 키워드로 클라이언트 교체 조회.
  const boxKeyword = THEME_BOX_KEYWORD[theme];
  const [themeBox, setThemeBox] = useState<Record<string, SnkrdunkRow[]>>({});
  useEffect(() => {
    if (!boxKeyword || themeBox[theme]) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/snkrdunk/search?q=${encodeURIComponent(boxKeyword)}`);
        if (!alive || !r.ok) return;
        const j = (await r.json()) as { results?: PopularSearchHit[] };
        // 박스만 — 이름 마커로 거른다. 매치가 없으면 섹션을 비워(폴백=서버 포켓몬 박스)
        // 싱글카드가 절대 섞이지 않게 한다. (예전: all 폴백이 싱글을 끌어들였음)
        const boxes = (j.results ?? []).filter((h) => isBoxName(h.name));
        const rows = shuffleRows(boxes).slice(0, 6).map(searchHitToRow);
        if (alive && rows.length > 0) setThemeBox((prev) => ({ ...prev, [theme]: rows }));
      } catch {
        /* 실패 시 포켓몬 기본 rows 유지 */
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, boxKeyword]);
  const boxRows = (boxKeyword && themeBox[theme]) || snkrdunkBoxRows;

  const popularBoxNode = boxRows.length > 0 ? (
    <PopularCardsSection
      rows={boxRows}
      theme={theme}
      isClean={isClean}
      format={format}
      autoScroll={!showPortfolioOnMain}
      title="📦 인기 박스들"
      darkTitle="박스 시세"
      moreHref="/cards/packs"
    />
  ) : null;

  // 메인 히어로(프로모) 배너.
  const bannerNode = <HeroSlider slides={heroBanners} compact />;

  return (
    <>
      <StatusBar />
      <AppBar right={<AppBarUser />} />

      {/* ═══ 다크(주식창): 실시간 인기 티커 바 ═══ */}
      {theme === 'dark' && snkrdunkRows.length > 0 && (
        <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid var(--line2)', background: 'var(--dark)' }}>
          <div style={{ flexShrink: 0, padding: '9px 14px', borderRight: '1px solid var(--line2)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--blu)' }}>🔥 실시간 인기</span>
          </div>
          {snkrdunkRows.slice(0, 8).map((r) => (
            <Link
              key={r.apparelId}
              href={`/cards/snkrdunk/${r.apparelId}`}
              style={{ flexShrink: 0, padding: '9px 13px', borderRight: '1px solid var(--line2)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'inherit' }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', maxWidth: 92, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.shortName}</span>
              <span className="num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{r.minPrice > 0 ? format(r.minPrice) : '—'}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ═══ HERO: PORTFOLIO ═══ 메인 표시 ON 일 때만 (기본 off) */}
      {showPortfolioOnMain && <PortfolioHero cards={cards} isLoggedIn={isLoggedIn} />}

      {/* ═══ 상단 그룹 ═══ 레벨·핵심지표·게임별현황·최근활동 제거.
          ON: 바로가기 → 인기카드 / OFF: 히어로배너 → 바로가기 → 인기카드 */}
      {showPortfolioOnMain ? (
        <>
          {shortcutsNode}
          {popularNode}
          {popularBoxNode}
        </>
      ) : (
        <>
          {bannerNode}
          {shortcutsNode}
          {popularNode}
          {popularBoxNode}
        </>
      )}

      <div className="bggap" />
    </>
  );
}

interface BlockProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: string;
  href?: string;
}

function Block({ label, value, sub, color, icon, href }: BlockProps) {
  const inner = (
    <>
      {icon && <div style={{ position: 'absolute', right: 10, top: 10, fontSize: 19, opacity: .15 }}>{icon}</div>}
      <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)', letterSpacing: .5 }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--f1)',
          fontSize: 19,
          color: color || 'var(--ink)',
          letterSpacing: -1,
          lineHeight: 1.1,
          textShadow: color ? '1px 1px 0 rgba(0,0,0,.15)' : 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: 'var(--f1)',
            fontSize: 10,
            color: 'var(--ink3)',
            letterSpacing: 0.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sub}
        </div>
      )}
    </>
  );
  // 4 칸 동일 높이 — minHeight 로 통일. 박스 테두리/그림자는 Panel 이 테마별로.
  const baseStyle: React.CSSProperties = {
    padding: '14px 12px',
    minHeight: 96,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 5,
    position: 'relative',
    overflow: 'hidden',
  };
  return (
    <Panel href={href} style={baseStyle}>
      {inner}
    </Panel>
  );
}

function PackHitsSectionBlock({ pack }: { pack: PackRow }) {
  const { format } = useCurrency();
  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          background: pack.bg, color: 'var(--white)',
          boxShadow:
            '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),inset 0 2px 0 rgba(255,255,255,.45),inset 0 -2px 0 rgba(0,0,0,.25),4px 4px 0 var(--ink)',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 19 }}>{pack.emoji}</span>
        <span style={{ fontFamily: 'var(--f1)', fontSize: 12, letterSpacing: 0.5, flex: 1 }}>{pack.shortName}</span>
        {pack.releasedAt ? (
          <span style={{ fontFamily: 'var(--f1)', fontSize: 9, opacity: 0.8, letterSpacing: 0.3 }}>
            {pack.releasedAt.slice(0, 7).replace('-', '.')}
          </span>
        ) : null}
        <Link
          href={`/cards/packs/${pack.code}`}
          style={{ fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--white)', letterSpacing: 0.3, textDecoration: 'underline' }}
        >
          전체 ▶
        </Link>
      </div>
      {pack.hits.length === 0 ? (
        <div
          style={{
            padding: 24, textAlign: 'center', background: 'var(--white)',
            fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)',
            boxShadow:
              '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),5px 5px 0 var(--ink)',
          }}
        >
          매물 확인 중…
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
            paddingBottom: 4,
          }}
        >
          {pack.hits.map((hit) => (
            <Link
              key={hit.apparelId}
              href={`/cards/snkrdunk/${hit.apparelId}`}
              style={{
                minWidth: 0, textDecoration: 'none', color: 'inherit',
                background: 'var(--white)',
                boxShadow:
                  '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),inset 0 2px 0 rgba(255,255,255,.7),5px 5px 0 var(--ink)',
                borderTop: `4px solid ${pack.bg}`,
              }}
            >
              <CardThumb
                style={{
                  height: 92, background: 'var(--pap2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}
                src={hit.imageUrl}
                alt={hit.shortName}
                emojiSize={33}
              />
              <div style={{ padding: '7px 8px 9px', borderTop: '3px solid var(--ink)' }}>
                <div
                  style={{
                    fontFamily: 'var(--f1)', fontSize: 11, letterSpacing: 0.2, marginBottom: 4,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {hit.shortName}
                </div>
                <div style={{ fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--red)', letterSpacing: 0.3 }}>
                  {hit.minPrice > 0 ? format(hit.minPrice) : '—'}
                </div>
                <div style={{ fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)', marginTop: 3, letterSpacing: 0.3, minHeight: 11 }}>
                  {hit.listingCountText ? `매물 ${hit.listingCountText}건` : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 인기 카드 섹션 — 다크=실시간 시세 종목 리스트 / 그 외=인기 카드 가로 캐러셀.
 * autoScroll=true 면 캐러셀이 자동으로 천천히 왼쪽으로 무한 스크롤(로테이션).
 * 카드를 두 벌 이어붙여 끝에 도달하면 절반만큼 되돌려 끊김 없이 루프한다.
 * 사용자가 손으로 만지는 동안(pointer/hover)에는 멈춘다.
 */
function PopularCardsSection({
  rows,
  theme,
  isClean,
  format,
  autoScroll,
  moreHref = '/cards/snkrdunk',
  title = '🔥 인기 카드들',
  darkTitle = '실시간 시세',
}: {
  rows: SnkrdunkRow[];
  theme: string;
  isClean: boolean;
  format: (jpy: number) => string;
  autoScroll: boolean;
  moreHref?: string;
  title?: string;
  darkTitle?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const carousel = theme !== 'dark';

  useEffect(() => {
    if (!autoScroll || !carousel) return;
    const el = scrollRef.current;
    if (!el) return;
    // scrollLeft 의 getter 는 정수로 반올림되므로 0.x 씩 더하면 누적되지 않는다.
    // float 누적기(acc)를 따로 두고 매 프레임 el.scrollLeft 에 대입해야 움직인다.
    let raf = 0;
    let paused = false;
    let acc = el.scrollLeft;
    const pause = () => { paused = true; };
    const resume = () => { paused = false; acc = el.scrollLeft; };
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('touchend', resume, { passive: true });
    let last = 0;
    const step = (t: number) => {
      if (!paused && el.scrollWidth > el.clientWidth) {
        const dt = last ? t - last : 16;
        const half = el.scrollWidth / 2; // 카드를 두 벌 이어붙였으므로 절반 지점에서 되돌림
        acc += (dt / 1000) * 28; // ~28px/s, 천천히
        if (half > 0 && acc >= half) acc -= half;
        el.scrollLeft = acc;
      }
      last = t;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('touchend', resume);
    };
  }, [autoScroll, carousel, rows.length]);

  if (theme === 'dark') {
    return (
      <div className="sect">
        <div className="sect-hd">
          <h2>{darkTitle}</h2>
          <Link href={moreHref} className="more">전체 ▶</Link>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: '1px solid var(--pap3)', background: 'var(--dark)' }}>
            <span style={{ width: 20, fontSize: 10, color: 'var(--ink4)', fontWeight: 700, textAlign: 'center' }}>#</span>
            <span style={{ flex: 1, fontSize: 10, color: 'var(--ink4)', fontWeight: 700 }}>카드명</span>
            <span style={{ fontSize: 10, color: 'var(--ink4)', fontWeight: 700 }}>현재가</span>
          </div>
          {rows.slice(0, 10).map((r, i, arr) => (
            <Link
              key={r.apparelId}
              href={`/cards/snkrdunk/${r.apparelId}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--line2)' : 'none', textDecoration: 'none', color: 'inherit' }}
            >
              <div className="num" style={{ width: 20, textAlign: 'center', fontSize: 13, fontWeight: 800, color: i < 3 ? 'var(--red)' : 'var(--ink4)' }}>{i + 1}</div>
              <CardThumb
                style={{ width: 34, height: 46, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--surf2)', display: 'grid', placeItems: 'center' }}
                src={r.imageUrl}
                alt={r.shortName}
                emojiSize={18}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.shortName}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.localizedName && r.localizedName !== r.shortName
                    ? r.localizedName
                    : `${r.category ?? '카드'}${r.listingCountText ? ` · 매물 ${r.listingCountText}건` : ''}`}
                </div>
              </div>
              <div className="num" style={{ fontSize: 13, fontWeight: 800, textAlign: 'right', flexShrink: 0 }}>{r.minPrice > 0 ? format(r.minPrice) : '—'}</div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // 캐러셀 — 자동 스크롤 시 카드를 두 벌 이어붙여 끊김 없이 루프.
  const displayRows = autoScroll ? [...rows, ...rows] : rows;
  return (
    <div className="sect">
      <div className="sect-hd">
        <h2>{title}</h2>
        <Link href={moreHref} className="more">전체 ▶</Link>
      </div>
      {/* 좌/우 padding 으로 첫·마지막 카드의 box-shadow 가 잘리지 않도록 여백 확보. */}
      <div
        ref={scrollRef}
        style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 6px 8px' }}
      >
        {displayRows.map((r, idx) => {
          const bg = r.category ? SNKR_CAT_BG[r.category] : SNKR_FALLBACK_BG;
          const priceText = r.minPrice > 0 ? format(r.minPrice) : '—';
          const showJp = r.localizedName && r.localizedName !== r.shortName;
          return (
            <Panel
              key={`${r.apparelId}-${idx}`}
              href={`/cards/snkrdunk/${r.apparelId}`}
              style={{
                flexShrink: 0, width: 108, cursor: 'pointer', overflow: 'hidden',
                ...(isClean ? {} : { borderTop: `4px solid ${bg}` }),
              }}
            >
              <CardThumb
                style={{
                  // 플랫 테마: 카드 면(--white)과 동일하게 — 이미지 띠가 회색 컨테이너처럼 떠 보이지 않게.
                  height: 92, background: isClean ? 'var(--white)' : 'var(--pap2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}
                src={r.imageUrl}
                alt={r.shortName}
                emojiSize={33}
              />
              <div style={{
                padding: '7px 8px 9px',
                borderTop: isClean ? '1px solid var(--pap3)' : '3px solid var(--ink)',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ minHeight: 16, marginBottom: 5 }}>
                  {r.category ? (
                    <span style={{
                      fontFamily: 'var(--f1)', fontSize: 9, padding: '2px 4px', display: 'inline-block',
                      background: bg, color: 'var(--white)', letterSpacing: 0.3,
                      boxShadow: PIXEL_BORDER,
                    }}>{r.category}</span>
                  ) : null}
                </div>
                <div style={{
                  fontFamily: 'var(--f1)', fontSize: 13, letterSpacing: 0.2, marginBottom: 3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{r.shortName}</div>
                {showJp ? (
                  <div style={{
                    fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)',
                    letterSpacing: 0.2, marginBottom: 4,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.localizedName}</div>
                ) : null}
                <div style={{ fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--red)', letterSpacing: 0.3 }}>
                  {priceText}
                </div>
                <div style={{
                  fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)',
                  marginTop: 3, letterSpacing: 0.3, minHeight: 11,
                }}>
                  {r.listingCountText ? `매물 ${r.listingCountText}건` : ''}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

