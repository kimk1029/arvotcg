'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useCurrency } from '@/components/CurrencyProvider';
import { useUnread } from '@/components/UnreadProvider';
import { useTheme } from '@/components/ThemeProvider';
import { useGamePrefs } from '@/components/GamePrefsProvider';
import { GAME_IDS, GAME_OPTIONS, type GameId } from '@/lib/gamePrefs';
import { HeroSlider, type HeroSlideData } from '@/components/HeroSlider';
import { HomeKoSearchBar } from '@/components/HomeKoSearchBar';
import { GradeMark } from '@/components/cards/GradeMark';
import { translateKnownCardNameToKo } from '@/lib/cardTranslate';
import { CARD_PACKS, type CardPackMeta } from '@/lib/cardPacks';
import { pickHomeBoxPacks } from '../../../shared/homeBoxPacks';

/** 홈 인기박스 선별에 필요한 최소 팩 메타 — 서버 /api/card-packs 응답과 번들 공용. */
type HomePackMeta = Pick<CardPackMeta, 'game' | 'apparelGroupId' | 'releasedAt' | 'shortName'>;
import { headlineFromHistory, trendChangePct } from '@/lib/snkrdunkPrice';
import type { SnkrdunkRow } from '@/components/dashboard/DashboardScreen';
import type { MvcAuctionItem } from '@/lib/navercafe';

/**
 * 메인화면 — Claude Design 'ARVOTCG App' 프로토타입 레이아웃.
 *  헤더(ARVOTCG+벨) · 검색 · 프로모 배너 · 빠른 스캔 · HOT 카드 · 인기 박스 · 실시간 급등.
 * 모든 테마가 같은 레이아웃을 쓰고, 색/폰트만 테마별로 달라진다(클린은 프로토타입 오렌지
 * 팔레트 그대로, 그 외 테마는 CSS 변수 토큰). 카드 아트는 컨테이너 없이 이미지만 떠 보이게.
 */

const ACCENT30 = '#FF7A00'; // ARVO'TCG' 브랜드 액센트 — 모든 테마 공통
const RISE = '#F5333F';

export interface Palette {
  bg: string;
  ink: string;
  ink2: string;
  ink3: string;
  rise: string;
  fall: string;
  priceIcon: string;
  regIcon: string;
  searchBg: string;
  tileBg: string;
  line: string;
  chev: string;
}

const FALL = '#2C8FFF';

/** 등락률 표시 정보. 데이터 없으면 null. */
function pctInfo(pct: number | undefined, P: Palette): { text: string; color: string } | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const up = pct >= 0;
  return { text: `${up ? '+' : ''}${pct.toFixed(1)}% ${up ? '▲' : '▼'}`, color: up ? P.rise : P.fall };
}

// 클린 = 프로토타입 오렌지 팔레트(승인된 모습 그대로).
const CLEAN_PALETTE: Palette = {
  bg: '#ffffff',
  ink: '#16161a',
  ink2: '#8E8E93',
  ink3: '#9A9AA0',
  rise: RISE,
  fall: FALL,
  priceIcon: ACCENT30,
  regIcon: '#5FB85A',
  searchBg: '#F2F2F4',
  tileBg: '#F7F7F9',
  line: '#F0F0F2',
  chev: '#C2C2C8',
};

// 그 외 테마 = 각 테마의 CSS 변수 토큰(테마별 색/폰트 자동 반영).
const VAR_PALETTE: Palette = {
  bg: 'var(--paper)',
  ink: 'var(--ink)',
  ink2: 'var(--ink3)',
  ink3: 'var(--ink3)',
  rise: 'var(--red)',
  fall: 'var(--blu)',
  priceIcon: 'var(--gold)',
  regIcon: 'var(--grn)',
  searchBg: 'var(--pap2)',
  tileBg: 'var(--pap2)',
  line: 'var(--pap3)',
  chev: 'var(--ink3)',
};

// 카드 아트 폴백 그라데이션 (이미지가 없을 때만)
const FALLBACK_GRADS = [
  'linear-gradient(150deg,#f9d423,#ff8a3c)',
  'linear-gradient(150deg,#ff6a3d,#c81d25)',
  'linear-gradient(150deg,#f7a6c4,#b78cf0)',
  'linear-gradient(150deg,#9d6bd6,#4568dc)',
  'linear-gradient(150deg,#3a3a44,#16161a)',
  'linear-gradient(150deg,#7ad0c2,#2f8f7f)',
];

function rankBadgeColor(rank: number): string {
  if (rank === 1) return RISE;
  if (rank === 3) return ACCENT30;
  return '#2B2B2B';
}

// 사이드 드로어 메뉴 — 디자인 'POKE30 App' drawerMenus. 앱 CleanHomeScreen 과 동일 구성.
const DRAWER_MENUS: { emoji: string; label: string; href: string; badge?: string }[] = [
  { emoji: '📊', label: '시세 확인', href: '/cards/packs' },
  { emoji: '🔨', label: '경매', href: '/cards/mvc-auction', badge: 'LIVE' },
  { emoji: '💬', label: '커뮤니티', href: '/feed' },
  { emoji: '📈', label: '내 자산', href: '/my/portfolio' },
  { emoji: '🃏', label: '카드 추가', href: '/cards/add' },
  { emoji: '👤', label: '마이페이지', href: '/my' },
  { emoji: '📢', label: '공지사항', href: '/my/notices' },
];

/** 드로어 프로필 카드에 필요한 최소 요약 — /api/me/summary 응답의 부분집합. */
interface DrawerSummary {
  user: { name: string | null };
  level: { level: number; title: string };
}

// 설정에서 켠 게임별 인기 카드/박스 검색 키워드. 포켓몬은 서버 기본 rows 를 그대로 쓴다.
const GAME_POPULAR_KEYWORD: Partial<Record<GameId, string>> = {
  onepiece: 'ワンピースカード',
  yugioh: '遊戯王',
  sports: 'Topps',
};
const BOX_NAME_RE = /ボックス|box|booster|ブースター|デッキビルド|スターター|拡張パック|ハイクラスパック|ポケモンセンターセット|シュリンク/i;
const isBoxName = (name: string) => BOX_NAME_RE.test(name || '');

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

/** 게임별 목록을 라운드로빈으로 섞어 한 캐러셀에 고르게 배치. */
function interleaveRows<T>(pools: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...pools.map((p) => p.length));
  for (let i = 0; i < max; i++) {
    for (const p of pools) {
      if (i < p.length) out.push(p[i]);
    }
  }
  return out;
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

interface Props {
  heroBanners?: HeroSlideData[];
  isLoggedIn: boolean;
  snkrdunkRows?: SnkrdunkRow[];
  snkrdunkBoxRows?: SnkrdunkRow[];
  mvcAuctions?: MvcAuctionItem[];
}

/** 캐러셀 자동 좌측 무한 스크롤(로테이션). 손대면 멈췄다 이어감. */
function useMarquee(ref: RefObject<HTMLDivElement>, enabled: boolean, depCount: number) {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let paused = false;
    let acc = el.scrollLeft;
    let last = 0;
    const pause = () => { paused = true; };
    const resume = () => { paused = false; acc = el.scrollLeft; };
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('touchend', resume, { passive: true });
    const step = (t: number) => {
      if (!paused && el.scrollWidth > el.clientWidth) {
        const dt = last ? t - last : 16;
        const half = el.scrollWidth / 2; // 카드를 두 벌 이어붙였으므로 절반에서 되돌림
        acc += (dt / 1000) * 28; // ~28px/s
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
  }, [ref, enabled, depCount]);
}

const hrowStyle: CSSProperties = {
  display: 'flex',
  gap: 14,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  // overflow-x:auto 면 overflow-y 가 auto 로 계산돼 카드 그림자가 잘리므로
  // 상하 패딩으로 그림자가 들어갈 여백을 확보한다.
  padding: '10px 20px 26px',
};

function SectionHead({ title, href, P }: { title: ReactNode; href: string; P: Palette }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 13px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: P.ink }}>{title}</div>
      <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 600, color: P.ink3, textDecoration: 'none' }}>
        더보기
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={P.ink3} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}

// 컨테이너(박스) 없이 이미지 '자체'에 그림자를 준다 — drop-shadow 는 이미지의 알파(모양)를
// 따라가므로 둥근/투명 영역 그대로 그림자가 생겨 진짜 떠 있는 사진처럼 보인다.
const ART_SHADOW = 'drop-shadow(0 7px 11px rgba(0,0,0,.30)) drop-shadow(0 2px 4px rgba(0,0,0,.18))';

function CardArt({
  imageUrl,
  fallbackIdx,
  width,
  height,
  radius,
  children,
}: {
  imageUrl: string | null;
  fallbackIdx: number;
  width: number | string;
  height: number;
  radius: number;
  children?: ReactNode;
}) {
  return (
    <div style={{ position: 'relative', width, height }}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius, filter: ART_SHADOW }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: radius,
            background: FALLBACK_GRADS[fallbackIdx % FALLBACK_GRADS.length],
            filter: ART_SHADOW,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 40 }}>🃏</span>
        </div>
      )}
      {children}
    </div>
  );
}

// snkrdunkBoxRows prop 은 레거시 DashboardScreen 경로용으로 Props 에만 남음 —
// CleanHome 의 인기 박스는 앱과 동일하게 클라이언트에서 직접 선별·조회한다.
export function CleanHome({ heroBanners, isLoggedIn, snkrdunkRows = [] }: Props) {
  const { format } = useCurrency();
  const { count: unread } = useUnread();
  const { theme } = useTheme();
  const P = theme === 'clean' ? CLEAN_PALETTE : VAR_PALETTE;
  // 빠른 스캔 타일을 픽셀 입체 박스로 — 웹 .card 가 픽셀로 남는 테마(pokemon·sports)에만.
  // (yugioh·onepiece·clean·dark 는 globals.css 에서 .card 를 플랫 처리하므로 제외.)
  const pixelTiles = theme === 'pokemon' || theme === 'sports';
  // 픽셀 폰트(Press Start 2P/Galmuri) 테마 — 폰트 폭이 넓어 가격·등락률 글씨를 줄인다.
  const pixel = pixelTiles;

  const fmtPrice = (jpy: number) => (jpy > 0 ? format(jpy) : '—');

  // 사이드 드로어 — 헤더 햄버거로 열고, 오버레이/X/메뉴 이동으로 닫는다.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 열려 있는 동안 뒤 페이지 스크롤 잠금.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);
  // 프로필 카드(닉네임·레벨) — 처음 열 때 1회 조회.
  const [drawerMe, setDrawerMe] = useState<DrawerSummary | null>(null);
  useEffect(() => {
    if (!drawerOpen || !isLoggedIn || drawerMe) return;
    let alive = true;
    fetch('/api/me/summary')
      .then((r) => (r.ok ? (r.json() as Promise<DrawerSummary>) : null))
      .then((j) => { if (alive && j?.user) setDrawerMe(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, [drawerOpen, isLoggedIn, drawerMe]);

  // 설정에서 켠 게임들의 인기 카드/박스를 조회해 섞는다 (테마와 무관).
  // 포켓몬은 서버 기본 rows 사용, 나머지 게임은 키워드 검색으로 조회.
  // 포켓몬만 켜져 있으면 조회 없이 서버 rows 그대로 (기존 기본 동작과 동일).
  const { enabledGames, toggleGame } = useGamePrefs();
  const gamesKey = enabledGames.join(',');
  const extraGames = enabledGames.filter((g) => GAME_POPULAR_KEYWORD[g]);
  const needsMix = extraGames.length > 0;
  const [mixPopular, setMixPopular] = useState<Record<string, SnkrdunkRow[]>>({});
  useEffect(() => {
    if (!needsMix || mixPopular[gamesKey]) return;
    let alive = true;
    // 게임당 뽑는 개수 — 섞어도 캐러셀이 과하게 길어지지 않게 켠 게임 수로 나눔.
    const per = Math.max(2, Math.ceil(8 / enabledGames.length));
    const search = async (q: string): Promise<PopularSearchHit[]> => {
      try {
        const r = await fetch(`/api/snkrdunk/search?q=${encodeURIComponent(q)}`);
        if (!r.ok) return [];
        const j = (await r.json()) as { results?: PopularSearchHit[] };
        return j.results ?? [];
      } catch {
        return [];
      }
    };
    // 이름 휴리스틱은 박스 마커 없는 박스를 놓친다 — 상세 itemKind 로 확정 검증.
    // (조회 실패 시엔 이름 필터를 통과한 후보를 그대로 둬 섹션이 비지 않게.)
    const verifySingles = async (hits: PopularSearchHit[]): Promise<PopularSearchHit[]> => {
      const checked = await Promise.all(
        hits.map(async (h) => {
          try {
            const r = await fetch(`/api/snkrdunk/apparels/${h.apparelId}`);
            if (!r.ok) return h;
            const j = (await r.json()) as { data?: { itemKind?: string } };
            return j.data?.itemKind === 'box' ? null : h;
          } catch {
            return h;
          }
        }),
      );
      return checked.filter((h): h is PopularSearchHit => h !== null);
    };
    (async () => {
      const popularLists = await Promise.all(
        extraGames.map(async (g) => {
          const hits = shuffleRows(
            (await search(GAME_POPULAR_KEYWORD[g]!)).filter((h) => !isBoxName(h.name)),
          ).slice(0, per * 2);
          return (await verifySingles(hits)).slice(0, per).map(searchHitToRow);
        }),
      );
      if (!alive) return;
      // 검색 경로 행(추가 게임)에도 대표가·등락률을 채운다 — 포켓몬 seedToRow 와
      // 동일한 소스(sales-history 헤드라인가 + sales-chart trendChangePct, 정본 /shared).
      const enrichRow = async (row: SnkrdunkRow): Promise<SnkrdunkRow> => {
        if (row.changePct !== undefined || row.recentPrice !== undefined) return row;
        try {
          const [cr, hr] = await Promise.all([
            fetch(`/api/snkrdunk/apparels/${row.apparelId}/sales-chart`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
            fetch(`/api/snkrdunk/apparels/${row.apparelId}/sales-history`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
          ]);
          const points = (cr as { data?: { points?: Array<[number, number]> } } | null)?.data?.points;
          const history =
            (hr as { data?: { history?: Parameters<typeof headlineFromHistory>[0] } } | null)?.data
              ?.history ?? [];
          const { price: recent, basis } = headlineFromHistory(history, row.minPrice);
          return {
            ...row,
            recentPrice: recent > 0 ? recent : undefined,
            basis,
            changePct: points ? trendChangePct(points) : undefined,
          };
        } catch {
          return row;
        }
      };
      const enrichedPopular = await Promise.all(
        popularLists.map((list) => Promise.all(list.map(enrichRow))),
      );
      if (!alive) return;
      const withPokemon = (lists: SnkrdunkRow[][], pokemonRows: SnkrdunkRow[]) =>
        interleaveRows(
          enabledGames.includes('pokemon') ? [pokemonRows.slice(0, per), ...lists] : lists,
        ).slice(0, 10);
      const popRows = withPokemon(enrichedPopular, snkrdunkRows);
      if (popRows.length > 0) setMixPopular((p) => ({ ...p, [gamesKey]: popRows }));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamesKey, needsMix, snkrdunkRows]);

  const hotRows = (needsMix && mixPopular[gamesKey]) || snkrdunkRows;

  // 인기 박스 — 앱 CleanHomeScreen 과 동일 로직: 선별은 shared pickHomeBoxPacks,
  // 각 팩의 대표 박스는 apparel-groups(cat 14) 1건 조회. 켠 게임 전체를 라운드로빈.
  // 팩 풀은 서버 카탈로그(/api/card-packs)가 정본 — 서버에 세트 추가만 해도 반영.
  // 번들 CARD_PACKS 는 서버 미응답 폴백.
  const [boxRows, setBoxRows] = useState<SnkrdunkRow[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const catalog = await fetch('/api/card-packs')
        .then((r) => (r.ok ? (r.json() as Promise<{ data?: HomePackMeta[] }>) : null))
        .catch(() => null);
      const pool: readonly HomePackMeta[] =
        catalog?.data && catalog.data.length > 0 ? catalog.data : CARD_PACKS;
      const picked = pickHomeBoxPacks(pool, enabledGames);
      const rows = await Promise.all(
        picked.map(async (pack): Promise<SnkrdunkRow | null> => {
          try {
            const r = await fetch(
              `/api/snkrdunk/apparel-groups/${pack.apparelGroupId}?apparelCategoryId=14&page=1&perPage=1`,
            );
            if (!r.ok) return null;
            const j = (await r.json()) as {
              data?: {
                apparels?: Array<{
                  id: number;
                  localizedName?: string;
                  imageUrl?: string | null;
                  minPrice?: number;
                  listingCountText?: string;
                }>;
              } | null;
            };
            const box = j.data?.apparels?.[0];
            if (!box?.id) return null;
            return {
              apparelId: box.id,
              shortName: pack.shortName,
              localizedName: box.localizedName || undefined,
              category: null,
              imageUrl: box.imageUrl ?? null,
              minPrice: box.minPrice ?? 0,
              listingCountText: box.listingCountText ?? '',
            };
          } catch {
            return null;
          }
        }),
      );
      if (alive) setBoxRows(rows.filter((r): r is SnkrdunkRow => r !== null).slice(0, 6));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamesKey]);

  // HOT 카드 위 게임 필터 칩 — 포켓몬·원피스는 항상, 그 외 켜둔 게임도 함께 노출해 on/off.
  // 끝의 '더보기' 칩은 설정(전체 게임 관리)으로 이동. 앱 CleanHomeScreen GameChips 와 동일.
  const chipGames = GAME_IDS.filter(
    (g) => g === 'pokemon' || g === 'onepiece' || enabledGames.includes(g),
  );
  const gameChips = (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 20px 13px' }}>
      {chipGames.map((g) => {
        const opt = GAME_OPTIONS.find((o) => o.id === g);
        const on = enabledGames.includes(g);
        return (
          <button
            key={g}
            type="button"
            onClick={() => toggleGame(g)}
            style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
              padding: '7px 12px', borderRadius: 999, fontFamily: 'var(--f1)',
              background: on ? P.ink : P.tileBg,
              border: `1px solid ${on ? P.ink : P.line}`,
            }}
          >
            <span style={{ fontSize: 13 }}>{opt?.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: on ? P.bg : P.ink2 }}>{opt?.label ?? g}</span>
          </button>
        );
      })}
      {/* 더보기 → 설정: 유희왕·스포츠 등 다른 카드도 켜고 끈다. */}
      <Link
        href="/my/settings"
        style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none',
          padding: '7px 12px', borderRadius: 999,
          background: P.tileBg, border: `1px solid ${P.line}`,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: P.ink2 }}>더보기</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={P.ink3} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
  // 실시간 급등 = 등락률 내림차순(데이터 없는 행은 뒤로). 이름값이 '급등'이도록 정렬.
  const moverRows = [...hotRows].sort(
    (a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity),
  );

  // HOT / 박스 캐러셀 자동 슬라이딩(카드를 두 벌 이어붙여 끊김 없이 루프).
  const hotRef = useRef<HTMLDivElement>(null);
  const boxScrollRef = useRef<HTMLDivElement>(null);
  useMarquee(hotRef, hotRows.length > 0, hotRows.length);
  useMarquee(boxScrollRef, boxRows.length > 0, boxRows.length);
  const hotDisplay = hotRows.length > 0 ? [...hotRows, ...hotRows] : [];
  const boxDisplay = boxRows.length > 0 ? [...boxRows, ...boxRows] : [];

  return (
    <div className="pagebg" style={{ fontFamily: 'var(--f1)', background: P.bg }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            aria-label="메뉴 열기"
            onClick={() => setDrawerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', margin: -6, padding: 6, background: 'none', border: 'none' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth="2.1" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h12" />
            </svg>
          </button>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-.5px' }}>
            <span style={{ color: P.ink }}>ARVO</span>
            <span style={{ color: ACCENT30 }}>TCG</span>
          </div>
        </div>
        <Link href="/my/messages" aria-label="알림" style={{ position: 'relative', display: 'block', color: P.ink }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {unread > 0 && (
            <span style={{ position: 'absolute', top: 0, right: 1, width: 8, height: 8, background: RISE, borderRadius: '50%', border: '1.5px solid var(--paper)' }} />
          )}
        </Link>
      </div>

      {/* promo banner — 실제 배너 데이터(HeroSlider). 비면 컴포넌트 내장 폴백 슬라이드. */}
      <HeroSlider slides={heroBanners} compact />

      {/* search — 직접 타이핑 검색(Enter/▶ → /cards/snkrdunk/search?q=). 카메라 스캔은 인풋 내장. */}
      <div style={{ padding: '14px 20px' }}>
        <HomeKoSearchBar />
      </div>

      {/* quick scan */}
      <div style={{ padding: '8px 20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
          <QuickTile
            P={P}
            pixel={pixelTiles}
            href="/cards/add"
            label="내 카드 등록"
            desc="보유 카드를 등록하고 관리해요"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={P.regIcon} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M12 11v6M9 14h6" />
              </svg>
            }
          />
          <QuickTile
            P={P}
            pixel={pixelTiles}
            href="/cards/packs"
            label="시세 확인"
            desc={['박스별 힛카드 목록', '힛카드별 현재 시세 확인까지!']}
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={P.priceIcon} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                <circle cx="12" cy="12" r="3.2" />
              </svg>
            }
          />
        </div>
      </div>

      {/* HOT cards */}
      {hotRows.length > 0 && (
        <div style={{ padding: '0 0 24px' }}>
          <SectionHead title="HOT 카드" href="/cards/snkrdunk" P={P} />
          {/* 게임 필터 칩 — 포켓몬/원피스(+켜둔 게임) on/off. '더보기' 는 설정에서 전체 관리. */}
          {gameChips}
          <div ref={hotRef} style={hrowStyle}>
            {hotDisplay.map((c, i) => {
              const rank = (i % hotRows.length) + 1;
              return (
                <Link
                  key={`${c.apparelId}-${i}`}
                  href={`/cards/snkrdunk/${c.apparelId}`}
                  style={{ flex: 'none', width: 100, textDecoration: 'none', color: 'inherit' }}
                >
                  <CardArt imageUrl={c.imageUrl} fallbackIdx={i} width={100} height={138} radius={11}>
                    <div
                      style={{
                        position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: '50%',
                        background: rankBadgeColor(rank), color: '#fff', fontSize: 12, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,.25)',
                      }}
                    >
                      {rank}
                    </div>
                    {/* 대표 시세가 PSA10 기준이면 우하단에 PSA10 마크 — 앱과 동일. */}
                    {c.basis === 'PSA 10' && <GradeMark company="PSA" grade="10" height={9} />}
                  </CardArt>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, marginTop: 9, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.shortName}
                  </div>
                  <div
                    style={{
                      fontSize: pixel ? 13 : 15, fontWeight: 900, color: P.ink, marginTop: 4, letterSpacing: '-.3px',
                      fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {fmtPrice(c.recentPrice ?? c.minPrice)}
                  </div>
                  {(() => {
                    const pc = pctInfo(c.changePct, P);
                    return pc ? (
                      <div style={{ fontSize: pixel ? 9 : 12, fontWeight: 800, color: pc.color, marginTop: 2, whiteSpace: 'nowrap' }}>{pc.text}</div>
                    ) : null;
                  })()}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* box hot cards */}
      {boxRows.length > 0 && (
        <div style={{ padding: '0 0 26px' }}>
          <SectionHead title="인기 박스" href="/cards/packs" P={P} />
          <div ref={boxScrollRef} style={hrowStyle}>
            {boxDisplay.map((b, i) => (
              <Link
                key={`${b.apparelId}-${i}`}
                href={`/cards/snkrdunk/${b.apparelId}`}
                style={{ flex: 'none', width: 100, textDecoration: 'none', color: 'inherit' }}
              >
                <CardArt imageUrl={b.imageUrl} fallbackIdx={i} width={100} height={100} radius={13} />
                <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, marginTop: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {b.shortName}
                </div>
                <div style={{ fontSize: 11, color: P.ink2, marginTop: 3 }}>
                  평균 시세 <span style={{ color: P.rise, fontWeight: 800 }}>{fmtPrice(b.minPrice)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* realtime movers */}
      {hotRows.length > 0 && (
        <div style={{ padding: '0 20px 30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 18, fontWeight: 800, color: P.ink }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={P.rise} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 17 6-6 4 4 8-8" />
                <path d="M17 7h4v4" />
              </svg>
              실시간 급등 카드
            </div>
            <Link href="/cards/snkrdunk" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 600, color: P.ink3, textDecoration: 'none' }}>
              더보기
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={P.ink3} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          </div>
          {moverRows.map((m, i) => {
            const sub = m.localizedName && m.localizedName !== m.shortName ? m.localizedName : m.category ?? '카드';
            const pc = pctInfo(m.changePct, P);
            return (
              <Link
                key={m.apparelId}
                href={`/cards/snkrdunk/${m.apparelId}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${P.line}`, textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, color: i < 3 ? P.rise : P.ink, width: 14, textAlign: 'center' }}>{i + 1}</div>
                <CardArt imageUrl={m.imageUrl} fallbackIdx={i} width={46} height={46} radius={9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.shortName}</div>
                  <div style={{ fontSize: 12, color: P.ink3, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: P.ink, letterSpacing: '-.3px', fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(m.recentPrice ?? m.minPrice)}</div>
                  {pc ? <div style={{ fontSize: pixel ? 9.5 : 12.5, fontWeight: 800, color: pc.color, marginTop: 3, whiteSpace: 'nowrap' }}>{pc.text}</div> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* side drawer — 디자인 'POKE30 App' 좌측 드로어. 오버레이 페이드 + 패널 슬라이드. */}
      <div
        onClick={() => setDrawerOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(22,22,26,.45)',
          opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? 'auto' : 'none', transition: 'opacity .25s ease',
        }}
      />
      <div
        role="dialog"
        aria-label="사이드 메뉴"
        style={{
          position: 'fixed', top: 0, bottom: 0, left: 0, width: 290, maxWidth: '82vw', zIndex: 1001,
          background: P.bg, boxShadow: '12px 0 40px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column',
          padding: '24px 0', transform: drawerOpen ? 'translateX(0)' : 'translateX(-104%)', transition: 'transform .28s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px 18px' }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.5px' }}>
            <span style={{ color: P.ink }}>ARVO</span>
            <span style={{ color: ACCENT30 }}>TCG</span>
          </div>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setDrawerOpen(false)}
            style={{ cursor: 'pointer', padding: 4, background: 'none', border: 'none', display: 'flex' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* profile card — 로그인 시 닉네임·레벨(마이페이지와 동일 아바타 레시피), 미로그인 시 로그인 유도 */}
        <Link
          href={isLoggedIn ? '/my' : '/login'}
          onClick={() => setDrawerOpen(false)}
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, margin: '0 16px 14px', background: P.tileBg, borderRadius: 16, padding: 14 }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(150deg,#3b5bdb,#1e2f8f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flex: 'none' }}>💎</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isLoggedIn ? drawerMe?.user.name ?? '트레이너' : '로그인이 필요해요'}
            </div>
            <div style={{ fontSize: 11.5, color: P.ink3, fontWeight: 600, marginTop: 2 }}>
              {isLoggedIn
                ? `LV.${drawerMe?.level.level ?? 1} · ${drawerMe?.level.title ?? '트레이너'}`
                : '로그인하고 시작하기'}
            </div>
          </div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.chev} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
          {DRAWER_MENUS.map((dm) => (
            <Link
              key={dm.label}
              href={dm.href}
              onClick={() => setDrawerOpen(false)}
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 12px', borderRadius: 12 }}
            >
              <span style={{ fontSize: 19, width: 26, textAlign: 'center', flex: 'none' }}>{dm.emoji}</span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: P.ink }}>{dm.label}</span>
              {dm.badge && (
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: RISE, padding: '2px 8px', borderRadius: 9, flex: 'none' }}>{dm.badge}</span>
              )}
            </Link>
          ))}
        </div>
        <Link
          href="/my/settings"
          onClick={() => setDrawerOpen(false)}
          style={{ textDecoration: 'none', padding: '14px 24px 0', borderTop: `1px solid ${P.line}`, display: 'flex', alignItems: 'center', gap: 13 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={P.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: P.ink3 }}>설정</span>
        </Link>
      </div>

      <div className="bggap" />
    </div>
  );
}

function QuickTile({
  P,
  href,
  label,
  desc,
  icon,
  pixel,
}: {
  P: Palette;
  href: string;
  label: string;
  desc: string | string[];
  icon: ReactNode;
  pixel?: boolean;
}) {
  // 픽셀 테마: .card 픽셀 박스 레시피(4면 ink 보더 + 하드 드롭섀도 + 노치 코너) + 클릭 시 눌림.
  // 플랫(클린·다크): 라운드 소프트 타일 + 약한 보더.
  const baseStyle: CSSProperties = pixel
    ? { background: 'var(--white)', borderRadius: 0, padding: '16px 14px', textDecoration: 'none', color: 'inherit', display: 'block' }
    : { background: P.tileBg, borderRadius: 16, padding: '16px 14px', textDecoration: 'none', color: 'inherit', display: 'block', border: `1px solid ${P.line}` };
  return (
    <Link href={href} className={pixel ? 'qtile-pixel' : undefined} style={baseStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {icon}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.chev} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, marginTop: 14 }}>{label}</div>
      {Array.isArray(desc) ? (
        // 여러 줄 설명 — "- " 불릿 + 행잉 인덴트로 줄별 정렬.
        <div style={{ fontSize: 12, color: P.ink2, marginTop: 3, lineHeight: 1.55, wordBreak: 'keep-all' }}>
          {desc.map((line) => (
            <div key={line} style={{ display: 'flex', gap: 5 }}>
              <span aria-hidden>-</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: P.ink2, marginTop: 3, wordBreak: 'keep-all' }}>{desc}</div>
      )}
    </Link>
  );
}
