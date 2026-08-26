import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, ScrollView, Pressable, Text, TextInput, Image, Animated, Easing, Modal, PanResponder } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { HeroBanner, type HeroSlideData } from '@/components/HeroBanner';
import { useCurrency } from '@/components/CurrencyProvider';
import { useTheme, useThemeColors } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { GradeMark } from '@/components/cv/GradeMark';
import { fonts } from '@/theme/tokens';
import {
  fetchSnkrdunkApparel,
  fetchSnkrdunkBrowse,
  fetchSnkrdunkSalesChart,
  fetchSnkrdunkSalesHistory,
  headlineFromHistory,
  searchSnkrdunkByQuery,
  SNKRDUNK_FEATURED_CARDS,
  type SnkrdunkApparel,
  type SnkrdunkCardSeed,
} from '@/services/snkrdunk';
import { useGamePrefs } from '@/components/GamePrefsProvider';
import { GAME_IDS, GAME_OPTIONS, type GameId } from '@/lib/gamePrefs';
import { CARD_PACKS, type CardPackMeta } from '@/data/cardPacks';
import { pickHomeBoxPacks } from '../../../shared/homeBoxPacks';
import { jaToKoBatch, jaToKoCached } from '@/lib/cardLang';
import { useScanToSearch } from '@/lib/useScanToSearch';
import { api } from '@/lib/apiClient';
import { fetchMySummary, fetchUnreadCount, type MySummary } from '@/lib/myApi';
import { isAuthenticated } from '@/lib/session';
import { setHomeHotRows } from '@/lib/homeHotStore';
import { swrAge, swrKeys, swrPeek, swrSet } from '@/lib/swr';
import { trendChangePct } from '../../../shared/snkrdunkPrice';
import { SNKRDUNK_GAME_KEYWORD } from '../../../shared/gameKeyword';
import { shotCardName, shotPackName, shotSource } from '@/lib/shotMode';

/**
 * 메인화면 — Claude Design 'ARVOTCG App' 프로토타입 레이아웃 (네이티브).
 * 모든 테마가 같은 레이아웃을 쓰고 색/폰트만 테마별로 달라진다 — 클린은 프로토타입
 * 오렌지 팔레트 그대로, 그 외 테마는 테마 토큰(tc)/폰트. HOT·박스는 자동 슬라이딩하며,
 * 카드 아트는 컨테이너 없이 이미지만 떠 보인다.
 */

const ACCENT30 = '#FF7A00'; // ARVO'TCG' 브랜드 액센트 — 모든 테마 공통
const RISE = '#F5333F';
const FALL = '#2C8FFF';

interface Palette {
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

/**
 * '어제 대비' 등락률(%) — 정본 /shared/snkrdunkPrice.ts trendChangePct 사용 (웹 홈과 동일).
 */

function pctInfo(pct: number | undefined, P: Palette): { text: string; color: string } | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const up = pct >= 0;
  return { text: `${up ? '+' : ''}${pct.toFixed(1)}% ${up ? '▲' : '▼'}`, color: up ? P.rise : P.fall };
}

const FALLBACK_BG = ['#f9d423', '#ff6a3d', '#f7a6c4', '#9d6bd6', '#3a3a44', '#7ad0c2'];

interface SnkrDisplaySeed {
  apparelId: number;
  shortName: string;
  category: SnkrdunkCardSeed['category'] | null;
  /** 검색 결과 썸네일 — 상세(data) 도착 전 선페인트용. */
  imageUrl?: string | null;
}
interface SnkrRow {
  seed: SnkrDisplaySeed;
  data: SnkrdunkApparel | null;
}

const FEATURED_BY_ID = new Map(SNKRDUNK_FEATURED_CARDS.map((s) => [s.apparelId, s]));

/* 홈 섹션 캐시 — SWR 스토어(메모리+디스크). 화면 재진입은 물론 앱 재시작(콜드
 * 스타트)에도 마지막 홈이 즉시 그려지고, TTL 이 지나면 백그라운드로 갱신한다
 * (웹 CleanHome 페어). */
const HOME_TTL_MS = 5 * 60_000;
const HOT_PREFIX = 'home:hot:';
const BOX_PREFIX = 'home:box:';
const BANNERS_KEY = 'home:banners';
const hotKey = (g: string) => `${HOT_PREFIX}${g}`;
const boxKey = (g: string) => `${BOX_PREFIX}${g}`;

const rowsFromCache = (prefix: string) => {
  const out: Record<string, SnkrRow[]> = {};
  for (const k of swrKeys(prefix)) {
    const rows = swrPeek<SnkrRow[]>(k);
    if (rows && rows.length > 0) out[k.slice(prefix.length)] = rows;
  }
  return out;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** 홈 fetch 공용 타임아웃 — 요청이 매달리면(iOS 기본 60초) 섹션이 영영 안 떠서 필수. */
function homeAbort(ms = 8000): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/** 홈 인기박스 선별에 필요한 최소 팩 메타 — 서버 /api/card-packs 응답과 번들 공용 (웹 동일). */
type HomePackMeta = Pick<CardPackMeta, 'game' | 'apparelGroupId' | 'releasedAt' | 'shortName'>;

// RN 에는 CSS word-break:keep-all 이 없어 한글이 글자 단위로 줄바꿈됨 —
// 어절 내부에 word joiner(U+2060)를 끼워 공백에서만 줄바꿈되게 함 (웹 keep-all 패리티).
const keepAllWrap = (s: string) => s.split(' ').map((w) => w.split('').join('\u2060')).join(' ');

const BOX_NAME_RE = /ボックス|box|booster|ブースター|デッキビルド|スターター|拡張パック|ハイクラスパック|ポケモンセンターセット|シュリンク/i;
// 싱글 카드 제목엔 세트명이 괄호로 붙는다(예: "メガレックウザex SAR [M6 110/076](拡張パック…)")
// — 세트명만 보고 박스로 오인하지 않게, 카드번호 브래킷이 있으면 싱글로 간주한다.
const CARD_NO_RE = /\[[^\]]*\d[^\]]*\]/;
const isBoxName = (name: string) => !CARD_NO_RE.test(name || '') && BOX_NAME_RE.test(name || '');


function inferSnkrCategory(name: string): SnkrdunkCardSeed['category'] | null {
  if (/プロモ|PROMO/i.test(name)) return '프로모';
  if (/\bSAR\b/.test(name)) return 'SAR';
  if (/\bSR\b/.test(name)) return 'SR';
  return null;
}
function shortenSnkrName(name: string): string {
  const cut = name.split(/[|｜]/)[0].trim();
  return cut.length > 22 ? cut.slice(0, 21) + '…' : cut;
}
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 게임별 인기 카드 검색 키워드 — 정본 /shared/gameKeyword (웹 CleanHome·랜딩·전체시세와 공유).
const GAME_POPULAR_KEYWORD = SNKRDUNK_GAME_KEYWORD;
function rankBadgeColor(rank: number): string {
  if (rank === 1) return RISE;
  if (rank === 3) return ACCENT30;
  return '#2B2B2B';
}

// 사이드 드로어 메뉴 — 사이트맵형 섹션 그룹. 웹 CleanHome 과 동일 구성.
interface DrawerItem {
  emoji: string;
  label: string;
  href: string;
  badge?: string;
  /** 배지 배경색 — 생략 시 빨강(RISE). */
  badgeBg?: string;
}
const DRAWER_SECTIONS: { label: string | null; items: DrawerItem[] }[] = [
  { label: null, items: [{ emoji: '🏠', label: '홈', href: '/' }] },
  {
    label: '카드',
    items: [
      { emoji: '🗂️', label: '내 컬렉션', href: '/my/cards' },
      { emoji: '🃏', label: '카드 등록', href: '/cards/add' },
      { emoji: '📦', label: '박스별 카드', href: '/cards/packs' },
      { emoji: '📊', label: '시세 확인', href: '/cards/snkrdunk' },
    ],
  },
  {
    label: '소셜',
    items: [
      { emoji: '💬', label: '커뮤니티', href: '/feed' },
      { emoji: '🔨', label: 'MVC 경매', href: '/cards/mvc-auction', badge: '베타', badgeBg: ACCENT30 },
      // 카드샵 = 커뮤니티의 Shop 탭 화면 (딥링크 ?tab=shop).
      { emoji: '🏪', label: '카드샵', href: '/feed?tab=shop' },
    ],
  },
  {
    label: '내 정보',
    items: [
      // 알림(쪽지함) — 헤더 벨을 드로어로 통합. 미읽음 수는 렌더 시점에 동적 배지로.
      { emoji: '🔔', label: '알림', href: '/my/messages' },
      { emoji: '📢', label: '공지사항', href: '/my/notices' },
      { emoji: '👤', label: '마이페이지', href: '/my' },
    ],
  },
];
const DRAWER_ROW_COUNT = DRAWER_SECTIONS.reduce((n, s) => n + s.items.length, 0);

// 프로필 요약 메모리 캐시 — /api/me/summary 가 무거워(집계 수 초) 드로어를 열 때마다
// 기다리지 않게, 홈 진입 시 선조회한 결과를 앱 세션 동안 재사용한다 (웹 세션캐시 페어).
const ME_TTL_MS = 5 * 60_000;
let meCache: { me: MySummary; at: number } | null = null;

/**
 * 카드 아트 — 웹 홈과 동일: 컨테이너/보더 없이 이미지만 떠 보이게(둥근 모서리 + 은은한 그림자).
 * 모든 테마 공통(색/폰트만 테마별로 다르고 아트 크롬은 동일).
 */
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
  width: number;
  height: number;
  radius: number;
  children?: ReactNode;
}) {
  // 둥근 모서리 + 소프트 드롭섀도, 보더 없음. Android elevation 은 둥근 이미지 뒤에 '사각'
  // 그림자 박스를 그려 컨테이너처럼 보이므로 끈다.
  const shadow = { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 0 } as const;
  return (
    <View style={{ position: 'relative', width, height }}>
      {imageUrl ? (
        <Image source={shotSource(imageUrl)} style={{ width, height, borderRadius: radius, ...shadow }} resizeMode="cover" />
      ) : (
        <View style={{ width, height, borderRadius: radius, backgroundColor: FALLBACK_BG[fallbackIdx % FALLBACK_BG.length], alignItems: 'center', justifyContent: 'center', ...shadow }}>
          <Text style={{ fontSize: 40 }}>🃏</Text>
        </View>
      )}
      {children}
    </View>
  );
}

/**
 * 가로 캐러셀 — 등속 좌측 루프(마퀴) + 손 스와이프(드래그·플링) 지원.
 * ⚠️ ScrollView.scrollTo 30ms 틱 방식 절대 금지 — iOS 는 스크롤 중 터치를 취소하므로
 * 앱이 상시 스크롤 상태가 되어 화면 전체 버튼이 눌리지 않는 치명적 버그가 됐었다.
 * 대신 스크롤 시스템 밖에서 transform(setNativeProps)으로만 움직인다.
 * 손 스와이프도 같은 이유로 ScrollView 가 아닌 PanResponder 드래그로 구현 —
 * 가로 우세 제스처만 잡아 세로 스크롤(부모)과 충돌하지 않고, 탭은 그대로 카드에
 * 전달된다(8px 이상 움직여야 드래그로 전환). 놓으면 속도만큼 감속 플링 후
 * 1.6초 뒤 자동 슬라이드 재개. 양 끝은 세트 폭 모듈로로 무한 순환 (웹 useMarquee 페어).
 */
function AutoCarousel<T>({
  data,
  itemWidth,
  gap,
  renderItem,
}: {
  data: T[];
  itemWidth: number;
  gap: number;
  renderItem: (item: T, indexInSet: number) => ReactNode;
}) {
  const rowRef = useRef<View>(null);
  const offset = useRef(0);
  const paused = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flingRaf = useRef<number | null>(null);
  const dragStart = useRef(0);
  const STEP = itemWidth + gap;
  const setWidth = data.length * STEP;
  // 데이터 개수가 바뀌어도(점진 로드) 진행 중 제스처가 최신 폭으로 되감게 ref 로 참조.
  const setWidthRef = useRef(setWidth);
  setWidthRef.current = setWidth;

  /** offset 을 세트 폭 모듈로로 되감아 적용 — 드래그 역방향(음수)도 순환. */
  const moveTo = (x: number) => {
    const w = setWidthRef.current;
    if (w <= 0) return;
    let v = x % w;
    if (v < 0) v += w;
    offset.current = v;
    rowRef.current?.setNativeProps({
      style: { transform: [{ translateX: -offset.current }] },
    });
  };

  useEffect(() => {
    if (setWidth <= 0) return;
    const id = setInterval(() => {
      if (paused.current) return;
      moveTo(offset.current + 22 * 0.03); // ~22px/s 등속
    }, 30);
    return () => {
      clearInterval(id);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      if (flingRaf.current != null) cancelAnimationFrame(flingRaf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setWidth]);

  const stopFling = () => {
    if (flingRaf.current != null) {
      cancelAnimationFrame(flingRaf.current);
      flingRaf.current = null;
    }
  };
  const pause = () => {
    paused.current = true;
    stopFling();
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const resumeSoon = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      paused.current = false;
    }, 1600);
  };

  // 놓은 속도로 감속 플링 — 네이티브 스크롤 느낌. vx(px/ms) → px/s, 과속은 캡.
  const fling = (vx: number) => {
    let v = Math.max(-2500, Math.min(2500, -vx * 1000));
    if (Math.abs(v) < 120) {
      resumeSoon();
      return;
    }
    let last = Date.now();
    const step = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      moveTo(offset.current + v * dt);
      v *= Math.pow(0.04, dt); // ~1초 내 자연 감속
      if (Math.abs(v) > 40) {
        flingRaf.current = requestAnimationFrame(step);
      } else {
        flingRaf.current = null;
        resumeSoon();
      }
    };
    flingRaf.current = requestAnimationFrame(step);
  };

  const panResponder = useRef(
    PanResponder.create({
      // 가로 우세 + 8px 이상일 때만 드래그로 전환 — 탭은 카드 Pressable 로, 세로는 부모로.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      // 일단 드래그를 잡으면 부모 스크롤에 넘기지 않는다 (가로 드래그 유지).
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        pause();
        dragStart.current = offset.current;
      },
      onPanResponderMove: (_e, g) => {
        moveTo(dragStart.current - g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        fling(g.vx);
      },
      onPanResponderTerminate: () => resumeSoon(),
    }),
  ).current;

  const display = [...data, ...data];
  return (
    <View
      style={{ overflow: 'hidden', paddingTop: 8, paddingBottom: 4 }}
      onTouchStart={pause}
      onTouchEnd={resumeSoon}
      onTouchCancel={resumeSoon}
      {...panResponder.panHandlers}
    >
      <View ref={rowRef} style={{ flexDirection: 'row', paddingLeft: 20 }}>
        {display.map((item, i) => (
          <View key={i} style={{ width: itemWidth, marginRight: gap }}>
            {renderItem(item, i % data.length)}
          </View>
        ))}
      </View>
    </View>
  );
}

export function CleanHomeScreen() {
  const { format } = useCurrency();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const flat = isFlatTheme(theme);
  const pixel = !flat; // 픽셀 테마(pokemon·onepiece·yugioh·sports) — 직각/하드섀도 크롬.
  const isClean = theme === 'clean';
  const P: Palette = isClean
    ? CLEAN_PALETTE
    : {
        bg: tc.paper,
        ink: tc.ink,
        ink2: tc.ink3,
        ink3: tc.ink3,
        rise: tc.red,
        fall: tc.blu,
        priceIcon: tc.gold,
        regIcon: tc.grn,
        searchBg: tc.pap2,
        tileBg: tc.pap2,
        line: tc.pap3,
        chev: tc.ink3,
      };

  // 테마별 폰트 — 플랫(clean·dark·yugioh·onepiece)=시스템 산세리프, 그 외(픽셀)=갈무리.
  const fontReg = flat ? undefined : fonts.ko;
  const fontBold = flat ? undefined : fonts.koBold;
  const ts = (size: number, weight: '400' | '600' | '700' | '800' | '900', color: string) => ({
    fontFamily: Number(weight) >= 700 ? fontBold : fontReg,
    fontSize: size,
    fontWeight: weight,
    color,
    lineHeight: Math.round(size * 1.3),
  });

  const fmtPrice = (jpy: number) => (jpy > 0 ? format(jpy) : '—');

  // 사이드 드로어 — 헤더 햄버거로 열고, 오버레이/X/메뉴 이동으로 닫는다.
  // Modal 이라 탭바 위까지 덮는다(웹 fixed 오버레이 패리티).
  // 열릴 땐 패널 스프링(살짝 튀어나왔다 자리잡음) + 항목 위→아래 스태거, 닫힐 땐 빠른 이즈.
  const insets = useSafeAreaInsets();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;
  const drawerItemAnims = useRef(
    Array.from({ length: DRAWER_ROW_COUNT }, () => new Animated.Value(0)),
  ).current;
  // 미읽음 쪽지 수 — 메뉴 알약의 빨간 점 + 드로어 '알림' 배지 (웹 useUnread 페어).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!isAuthenticated()) return;
    fetchUnreadCount().then(setUnread);
  }, []);
  const openDrawer = () => {
    if (isAuthenticated()) fetchUnreadCount().then(setUnread);
    setDrawerVisible(true);
    drawerAnim.setValue(0);
    drawerItemAnims.forEach((v) => v.setValue(0));
    Animated.spring(drawerAnim, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }).start();
    Animated.stagger(
      32,
      drawerItemAnims.map((v) =>
        Animated.spring(v, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      ),
    ).start();
  };
  const closeDrawer = () => {
    Animated.timing(drawerAnim, { toValue: 0, duration: 190, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setDrawerVisible(false);
    });
  };
  const goFromDrawer = (href: string) => {
    setDrawerVisible(false);
    drawerAnim.setValue(0);
    router.push(href as never);
  };
  // 프로필 카드(닉네임·레벨·이메일) — 홈 진입 시 선조회해 드로어를 열 때 즉시 뜨게 한다.
  // 캐시(5분)로 홈 재진입도 즉시. 로그인 직후를 위해 드로어 오픈 시 재시도 (웹 CleanHome 동일).
  const drawerAuthed = isAuthenticated();
  const [drawerMe, setDrawerMe] = useState<MySummary | null>(() =>
    meCache && Date.now() - meCache.at < ME_TTL_MS ? meCache.me : null,
  );
  useEffect(() => {
    if (drawerMe || !isAuthenticated()) return;
    let alive = true;
    fetchMySummary()
      .then((s) => {
        if (!alive) return;
        meCache = { me: s, at: Date.now() };
        setDrawerMe(s);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [drawerMe, drawerVisible]);

  // 빠른스캔 두 타일의 공통 높이(측정된 최댓값). onTileLayout 이 되먹인다.
  const [tileH, setTileH] = useState(0);

  // 홈 검색 — 직접 타이핑 → 검색 화면에 결과(?q=).
  const [homeQuery, setHomeQuery] = useState('');
  const submitSearch = () => {
    const q = homeQuery.trim();
    if (q) router.push(`/cards/snkrdunk/search?q=${encodeURIComponent(q)}` as never);
  };

  // 홈 카메라 = 웹 HomeKoSearchBar 동일: 촬영 → OCR(세트코드+번호) → 검색 목록으로.
  // 카드 추가 화면 우상단 카메라와 공용 훅 (useScanToSearch).
  const { scanBusy, scanToSearch } = useScanToSearch();

  // 홈 노출 게임 — 단일 선택(라디오). 기본 포켓몬, 다른 칩을 누르면 그 게임만 노출.
  // enabledGames(설정)는 어떤 칩을 보여줄지에만 쓰인다 (웹 CleanHome 동일).
  const { enabledGames } = useGamePrefs();
  const [homeGame, setHomeGame] = useState<GameId>('pokemon');

  // 인기 카드 — 선택 게임만 조회(포켓몬=browse, 그 외=키워드 검색) 후 게임별 캐시.
  // 칩 전환 시 재조회 없이 즉시 복귀. 세션 캐시(TTL)로 홈 재진입도 즉시.
  // 검색 결과 썸네일로 먼저 그리고(상세를 기다리지 않음) 상세는 도착 즉시 덮어쓴다.
  // 실패/빈 결과는 백오프 재시도 — 한 번 실패해도 섹션이 영영 비지 않게.
  const [gameRows, setGameRows] = useState<Record<string, SnkrRow[]>>(() => rowsFromCache(HOT_PREFIX));
  const snkrRows = useMemo(() => gameRows[homeGame] ?? [], [gameRows, homeGame]);
  useEffect(() => {
    if (swrAge(hotKey(homeGame)) < HOME_TTL_MS) return; // 신선 — 재조회 생략
    let alive = true;
    const paint = (rows: SnkrRow[], confirmed: boolean) => {
      if (!alive || rows.length === 0) return;
      setGameRows((p) => ({ ...p, [homeGame]: rows }));
      if (confirmed) swrSet(hotKey(homeGame), rows, { persist: true });
    };
    (async () => {
      for (let attempt = 0; alive && attempt < 3; attempt++) {
        if (attempt > 0) await sleep(2500 * attempt);
        if (!alive) return;
        // 검색 상위엔 이름에 박스 마커가 없는 박스/덱/팩이 대거 섞인다(실측: 상위 14개가
        // 전부 itemKind 'box' 라 필터 후 0행 → 섹션이 캐시되지 못하던 원인). 풀을 넉넉히
        // 잡고 12개씩 배치로 상세를 훑어 "싱글 카드" 10장을 채울 때까지 스캔한다.
        const kw = GAME_POPULAR_KEYWORD[homeGame];
        const list = kw ? await searchSnkrdunkByQuery(kw) : await fetchSnkrdunkBrowse(1);
        const pool = shuffle(list.filter((r) => !isBoxName(r.name))).slice(0, 40);
        const fromSearch = pool.length > 0;
        const seeds: SnkrDisplaySeed[] = fromSearch
          ? pool.map((r) => {
              const curated = FEATURED_BY_ID.get(r.apparelId);
              return curated
                ? { apparelId: r.apparelId, shortName: shotCardName(curated.shortName), category: curated.category, imageUrl: r.imageUrl }
                : {
                    apparelId: r.apparelId,
                    shortName: shortenSnkrName(jaToKoCached(r.name)),
                    category: inferSnkrCategory(r.name),
                    imageUrl: r.imageUrl,
                  };
            })
          : shuffle(SNKRDUNK_FEATURED_CARDS)
              .slice(0, 14)
              .map((s) => ({ apparelId: s.apparelId, shortName: shotCardName(s.shortName), category: s.category }));
        // 검색 썸네일로 즉시 선페인트 — 상세 조회를 기다리는 동안 섹션이 비지 않게.
        // 단, 이미 그려진 게 있으면(스테일 캐시 등) 가격 있는 기존 행을 유지.
        if (fromSearch) {
          setGameRows((p) =>
            (p[homeGame]?.length ?? 0) > 0
              ? p
              : { ...p, [homeGame]: seeds.slice(0, 10).map((seed) => ({ seed, data: null })) },
          );
        }
        // 배치 스캔 — 상세 itemKind 가 박스인 행을 제외하고 싱글 10장을 모은다.
        // 상세 실패(null)는 유지(웹 동일) — 이미지·이름은 검색 시드로 그려진다.
        const kept: SnkrRow[] = [];
        for (let i = 0; i < seeds.length && kept.length < 10; i += 12) {
          const chunk = seeds.slice(i, i + 12);
          const fetched = await Promise.all(
            chunk.map(async (seed) => ({ seed, data: await fetchSnkrdunkApparel(seed.apparelId) })),
          );
          if (!alive) return;
          kept.push(...fetched.filter((row) => row.data === null || row.data.itemKind !== 'box'));
        }
        const rows = kept.slice(0, 10);
        const gotDetails = rows.some((r) => r.data !== null);
        if (rows.length === 0 || (!fromSearch && !gotDetails)) {
          // 완전 실패(오프라인/서버 장애) 또는 풀 전체가 박스 — 이미 그려진 행
          // (디스크 캐시 등)이 있으면 절대 폴백으로 덮지 않는다. 아무것도 없을 때만
          // featured 폴백을 그리고 재시도.
          const fallback = shuffle(SNKRDUNK_FEATURED_CARDS)
            .slice(0, 10)
            .map((s): SnkrRow => ({ seed: { apparelId: s.apparelId, shortName: shotCardName(s.shortName), category: s.category }, data: null }));
          setGameRows((p) => ((p[homeGame]?.length ?? 0) > 0 ? p : { ...p, [homeGame]: fallback }));
          continue;
        }
        // 검색만 성공해도 캐시 확정 — 상세가 전부 실패한 첫 실행 뒤에도 다음 실행이
        // 즉시 그려진다(이미지=검색 썸네일, 가격은 enrich 가 채움). 상세까지 성공하면
        // 뒤의 재시도 paint 가 더 완전한 행으로 캐시를 덮어쓴다.
        paint(rows, fromSearch);
        // 성공(검색·상세 모두 응답)이면 종료, 아니면 재시도.
        if (fromSearch && gotDetails) return;
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeGame]);

  // 등락률 + 대표 시세 — 표시된 인기 카드의 판매 차트/거래내역을 받아 채움(렌더 후 점진).
  // 대표 시세 = 시세상세 헤드라인과 동일(거래 많은 등급의 최근 체결가). 없으면 minPrice 폴백.
  const [changeById, setChangeById] = useState<Record<number, number>>({});
  const [priceById, setPriceById] = useState<Record<number, number>>({});
  // 대표 시세의 등급 기준('PSA 10' 이면 우하단에 PSA10 마크 표시).
  const [basisById, setBasisById] = useState<Record<number, string>>({});
  useEffect(() => {
    if (snkrRows.length === 0) return;
    let alive = true;
    (async () => {
      await Promise.all(
        snkrRows.map(async ({ seed, data }) => {
          const [chart, history] = await Promise.all([
            fetchSnkrdunkSalesChart(seed.apparelId).catch(() => null),
            fetchSnkrdunkSalesHistory(seed.apparelId).catch(() => null),
          ]);
          if (!alive) return;
          const pct = chart ? trendChangePct(chart.points) : undefined;
          if (pct != null) setChangeById((prev) => ({ ...prev, [seed.apparelId]: pct }));
          const { price, basis } = headlineFromHistory(history, data?.minPrice ?? 0);
          if (price > 0) setPriceById((prev) => ({ ...prev, [seed.apparelId]: price }));
          setBasisById((prev) => ({ ...prev, [seed.apparelId]: basis }));
        }),
      );
    })();
    return () => {
      alive = false;
    };
  }, [snkrRows]);

  // '더보기'(/cards/snkrdunk) 목록이 홈 캐러셀과 동일한 항목·순서로 뜨도록 공유 저장 —
  // 대표가·등락률이 점진적으로 채워질 때마다 최신 상태로 갱신 (웹 homeHotCache 페어).
  useEffect(() => {
    if (snkrRows.length === 0) return;
    setHomeHotRows(
      homeGame,
      snkrRows.map(({ seed, data }) => ({
        apparelId: seed.apparelId,
        shortName: seed.shortName,
        localizedName: data?.localizedName || undefined,
        imageUrl: data?.imageUrl ?? seed.imageUrl ?? null,
        minPrice: data?.minPrice ?? 0,
        recentPrice: priceById[seed.apparelId],
        changePct: changeById[seed.apparelId],
        listingCountText: data?.listingCountText ?? '',
      })),
    );
  }, [snkrRows, priceById, changeById, homeGame]);

  const [gameBoxRows, setGameBoxRows] = useState<Record<string, SnkrRow[]>>(() => rowsFromCache(BOX_PREFIX));
  const snkrBoxRows = useMemo(() => gameBoxRows[homeGame] ?? [], [gameBoxRows, homeGame]);
  useEffect(() => {
    if (swrAge(boxKey(homeGame)) < HOME_TTL_MS) return; // 신선 — 재조회 생략
    let alive = true;
    (async () => {
      // 실패/빈 결과는 백오프 재시도 — 요청 하나 매달려도(타임아웃 8초) 섹션이 영영 비지 않게.
      for (let attempt = 0; alive && attempt < 3; attempt++) {
        if (attempt > 0) await sleep(2500 * attempt);
        if (!alive) return;
        // 선택 게임의 최신 팩 선별 — 정본 shared/homeBoxPacks (웹 동일, 칩 라디오 연동).
        // 팩 풀은 서버 카탈로그(/api/card-packs)가 정본 — 서버에 세트 추가만 해도 반영.
        // 번들 CARD_PACKS 는 서버 미응답 폴백.
        const catalog = await api<{ data?: HomePackMeta[] }>('/api/card-packs', {
          auth: false,
          signal: homeAbort(),
        }).catch(() => null);
        const pool: readonly HomePackMeta[] =
          catalog?.data && catalog.data.length > 0 ? catalog.data : CARD_PACKS;
        const picked = pickHomeBoxPacks(pool, [homeGame]);
        const rows = await Promise.all(
          picked.map(async (pack): Promise<SnkrRow | null> => {
            // 웹 홈 fetchBoxRows 와 동일한 NAS 엔드포인트 (박스 전용 카테고리 그룹 조회).
            const r = await api<{ data: { apparels?: SnkrdunkApparel[] } | null }>(
              `/api/snkrdunk/apparel-groups/${pack.apparelGroupId}?apparelCategoryId=14&page=1&perPage=1`,
              { auth: false, signal: homeAbort() },
            ).catch(() => null);
            const box = r?.data?.apparels?.[0];
            if (!box || !box.id) return null;
            return { seed: { apparelId: box.id, shortName: shotPackName(pack.shortName), category: null }, data: box };
          }),
        );
        if (!alive) return;
        const ok = rows.filter((r): r is SnkrRow => r !== null).slice(0, 6);
        if (ok.length > 0) {
          setGameBoxRows((p) => ({ ...p, [homeGame]: ok }));
          swrSet(boxKey(homeGame), ok, { persist: true });
          return;
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeGame]);

  // null = 로딩 중 (플레이스홀더 노출). 로드 전에 폴백 슬라이드를 그리면
  // "슬라이드 3개 → DB 1개"로 인디케이터가 줄어드는 깜빡임이 생긴다.
  // 타임아웃(8초)+재시도 1회 — 요청이 매달리면 회색 플레이스홀더가 영영 남던 문제 방지.
  // 최종 실패 시 []로 확정해 HeroBanner 내장 폴백 슬라이드라도 뜨게 한다. 세션 캐시로 재진입 즉시.
  const [banners, setBanners] = useState<HeroSlideData[] | null>(() => swrPeek<HeroSlideData[]>(BANNERS_KEY));
  useEffect(() => {
    if (swrAge(BANNERS_KEY) < HOME_TTL_MS) return; // 신선 — 재조회 생략
    let alive = true;
    (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await sleep(1500);
        try {
          const r = await api<{ data: HeroSlideData[] }>('/api/banners', { auth: false, signal: homeAbort() });
          const v = Array.isArray(r?.data) ? r.data : [];
          swrSet(BANNERS_KEY, v, { persist: true });
          if (alive) setBanners(v);
          return;
        } catch {
          // 재시도 후에도 실패하면 아래 폴백 확정.
        }
      }
      // 스테일 캐시라도 그려져 있으면 유지, 아무것도 없을 때만 []로 확정(내장 폴백 슬라이드).
      if (alive && swrPeek<HeroSlideData[]>(BANNERS_KEY) === null) setBanners([]);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Chevron = ({ size, color, w }: { size: number; color: string; w: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m9 6 6 6-6 6" />
    </Svg>
  );

  const MoreLink = ({ onPress }: { onPress: () => void }) => (
    <Pressable onPress={onPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Text style={ts(13, '600', P.ink3)}>더보기</Text>
      <Chevron size={13} color={P.ink3} w={2.6} />
    </Pressable>
  );

  // 빠른 스캔 타일 컨테이너 — 픽셀: 직각 PixelPress(white) / 플랫: 둥근 소프트 타일.
  // 두 타일의 세로 높이를 같게: 설명 줄 수가 달라도 실제 콘텐츠 높이를 측정해 큰 쪽에
  // 맞춘다(웹 grid stretch 대응). 고정 minHeight 는 더 큰 타일이 그 값을 넘으면 어긋나서,
  // onLayout 으로 최댓값을 잡아 양쪽에 minHeight 로 되먹인다(=max 로 수렴, 무한루프 없음).
  const onTileLayout = (h: number) => setTileH((prev) => (h > prev + 0.5 ? h : prev));
  const ScanTile = ({ onPress, children }: { onPress: () => void; children: ReactNode }) =>
    pixel ? (
      <View style={{ flex: 1 }}>
        <PixelPress onPress={onPress} borderWidth={3} shadow={5} inner={3} bg={tc.white}>
          <View
            onLayout={(e) => onTileLayout(e.nativeEvent.layout.height)}
            style={{ paddingVertical: 14, paddingHorizontal: 13, minHeight: tileH || undefined }}
          >
            {children}
          </View>
        </PixelPress>
      </View>
    ) : (
      <Pressable
        onPress={onPress}
        onLayout={(e) => onTileLayout(e.nativeEvent.layout.height)}
        style={{ flex: 1, backgroundColor: P.tileBg, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: P.line, minHeight: tileH || undefined }}
      >
        {children}
      </Pressable>
    );

  // 타일 여러 줄 설명 — 웹 QuickTile 과 동일한 "- " 불릿 + 행잉 인덴트.
  const TileDescLines = ({ lines }: { lines: string[] }) => (
    <View style={{ marginTop: 3 }}>
      {lines.map((line) => (
        <View key={line} style={{ flexDirection: 'row', gap: 5 }}>
          <Text style={[ts(12, '400', P.ink2), { lineHeight: 18 }]}>-</Text>
          <Text style={[ts(12, '400', P.ink2), { lineHeight: 18, flexShrink: 1 }]}>{keepAllWrap(line)}</Text>
        </View>
      ))}
    </View>
  );

  // HOT 카드 위 게임 칩 — 단일 선택(라디오): 포켓몬·원피스는 항상, 설정에서 켠 게임도 노출.
  // 끝의 '더보기' 칩은 설정(전체 게임 관리)으로 이동. 라벨/이모지는 GAME_OPTIONS 단일 소스.
  const chipGames = GAME_IDS.filter(
    (g) => g === 'pokemon' || g === 'onepiece' || enabledGames.includes(g),
  );
  const GameChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 13 }}
    >
      {chipGames.map((g) => {
        const opt = GAME_OPTIONS.find((o) => o.id === g);
        const on = g === homeGame;
        return (
          <Pressable
            key={g}
            onPress={() => setHomeGame(g)}
            hitSlop={4}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
              backgroundColor: on ? P.ink : P.tileBg,
              borderWidth: 1, borderColor: on ? P.ink : P.line,
            }}
          >
            <Text style={{ fontSize: 13 }}>{opt?.emoji}</Text>
            <Text style={ts(13, '700', on ? P.bg : P.ink2)}>{opt?.label ?? g}</Text>
          </Pressable>
        );
      })}
      {/* '더보기' 칩(→설정)은 2026-08 요청으로 임시 제거 — 게임 on/off 는 설정에서 계속 가능. */}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 }}>
          <Text style={ts(24, '900', P.ink)}>
            <Text style={ts(24, '900', P.ink)}>ARVO</Text>
            <Text style={ts(24, '900', ACCENT30)}>TCG</Text>
          </Text>
          {/* 메뉴 — 라벨이 있는 알약형 버튼. 알림은 드로어 안으로 통합 — 미읽음이 있으면
              알약에 빨간 점으로 신호만 남긴다 (웹 CleanHome 동일). */}
          <Pressable
            onPress={openDrawer}
            hitSlop={6}
            accessibilityLabel={unread > 0 ? `메뉴 열기 (새 알림 ${unread}개)` : '메뉴 열기'}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              height: 34, paddingLeft: 10, paddingRight: 11, borderRadius: 11,
              backgroundColor: P.searchBg, borderWidth: 1, borderColor: P.line,
            }}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth={2.4} strokeLinecap="round">
              <Path d="M3 6h18M3 12h18M3 18h18" />
            </Svg>
            <Text style={ts(12.5, '800', P.ink)}>메뉴</Text>
            {unread > 0 ? (
              <View style={{ position: 'absolute', top: -3, right: -3, width: 9, height: 9, backgroundColor: RISE, borderRadius: 5, borderWidth: 1.5, borderColor: P.bg }} />
            ) : null}
          </Pressable>
        </View>

        {/* promo banner — 비면 컴포넌트 내장 폴백 슬라이드 */}
        {banners === null ? (
          // 배너 로딩 플레이스홀더 — 실배너와 같은 높이(176+dots)로 레이아웃 점프 방지.
          <View style={{ height: 176, marginBottom: 8, backgroundColor: tc.pap2 }} />
        ) : (
          <HeroBanner slides={banners} />
        )}

        {/* search — 픽셀: 직각 PixelFrame 박스 / 플랫: 둥근 소프트 타일 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 }}>
          {pixel ? (
            <PixelFrame borderWidth={3} shadow={5} inner={3}>
              {/* 세로길이 +50% (기존 ≈46 → 68). 스캔 버튼(30)보다 넉넉히 커 내용은 중앙 정렬. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: tc.white, minHeight: 68, paddingVertical: 8, paddingHorizontal: 14 }}>
                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={P.ink3} strokeWidth={2.4} strokeLinecap="round">
                  <Circle cx={11} cy={11} r={7} />
                  <Path d="m20 20-3.5-3.5" />
                </Svg>
                <TextInput
                  value={homeQuery}
                  onChangeText={setHomeQuery}
                  onSubmitEditing={submitSearch}
                  returnKeyType="search"
                  placeholder="카드명·세트명 검색"
                  placeholderTextColor={P.ink3}
                  style={{ flex: 1, padding: 0, fontFamily: fontReg, fontSize: 13, color: P.ink }}
                />
                <Pressable onPress={scanToSearch} disabled={scanBusy} hitSlop={6} style={{ width: 30, height: 30, backgroundColor: tc.ink, alignItems: 'center', justifyContent: 'center', opacity: scanBusy ? 0.5 : 1 }} accessibilityLabel="카드 사진 스캔">
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tc.gold} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M14.5 4h-5L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2.5-3Z" />
                    <Circle cx={12} cy={13} r={3.2} />
                  </Svg>
                </Pressable>
              </View>
            </PixelFrame>
          ) : (
            // 세로길이 +50% (기존 ≈32 → 48).
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: P.searchBg, borderRadius: 14, minHeight: 48, paddingVertical: 6, paddingHorizontal: 16 }}>
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={P.ink3} strokeWidth={2.2} strokeLinecap="round">
                <Circle cx={11} cy={11} r={7} />
                <Path d="m20 20-3.5-3.5" />
              </Svg>
              <TextInput
                value={homeQuery}
                onChangeText={setHomeQuery}
                onSubmitEditing={submitSearch}
                returnKeyType="search"
                placeholder="카드명 또는 세트명으로 검색하세요"
                placeholderTextColor={P.ink3}
                style={{ flex: 1, padding: 0, fontFamily: fontReg, fontSize: 14.5, color: P.ink }}
              />
              <Pressable onPress={scanToSearch} disabled={scanBusy} hitSlop={6} style={{ opacity: scanBusy ? 0.5 : 1 }} accessibilityLabel="카드 사진 스캔">
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={P.ink3} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M14.5 4h-5L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2.5-3Z" />
                  <Circle cx={12} cy={13} r={3.2} />
                </Svg>
              </Pressable>
            </View>
          )}
        </View>

        {/* quick scan */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', gap: 11 }}>
            <ScanTile onPress={() => router.push('/cards/add' as never)}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={P.regIcon} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M14 3v4a1 1 0 0 0 1 1h4" />
                  <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <Path d="M12 11v6M9 14h6" />
                </Svg>
                <Chevron size={16} color={P.chev} w={2.4} />
              </View>
              <Text style={[ts(16, '800', P.ink), { marginTop: 14 }]}>내 카드 등록</Text>
              <Text style={[ts(12, '400', P.ink2), { marginTop: 3 }]}>{keepAllWrap('보유 카드를 등록하고 관리해요')}</Text>
            </ScanTile>
            <ScanTile onPress={() => router.push('/cards/packs' as never)}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={P.priceIcon} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <Circle cx={12} cy={12} r={3.2} />
                </Svg>
                <Chevron size={16} color={P.chev} w={2.4} />
              </View>
              <Text style={[ts(16, '800', P.ink), { marginTop: 14 }]}>시세 확인</Text>
              <TileDescLines lines={['박스별 힛카드 목록', '힛카드별 현재 시세 확인까지!']} />
            </ScanTile>
          </View>
        </View>

        {/* 게임 선택 칩 — HOT 카드·인기 박스·실시간 급등이 모두 이 선택을 따르므로
            섹션들 위에 배치 (단일 선택). '더보기'는 설정에서 전체 관리. */}
        <GameChips />

        {/* HOT cards — 자동 슬라이딩 */}
        {snkrRows.length > 0 ? (
          <View style={{ paddingBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 }}>
              <Text style={ts(18, '800', P.ink)}>🔥 HOT 카드</Text>
              <MoreLink onPress={() => router.push(`/cards/snkrdunk?game=${homeGame}` as never)} />
            </View>
            <AutoCarousel
              data={snkrRows}
              itemWidth={100}
              gap={14}
              renderItem={({ seed, data }, idx) => (
                <Pressable onPress={() => router.push(`/cards/snkrdunk/${seed.apparelId}` as never)}>
                  <CardArt imageUrl={data?.imageUrl ?? seed.imageUrl ?? null} fallbackIdx={idx} width={100} height={138} radius={11}>
                    <View
                      style={{
                        position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11,
                        backgroundColor: rankBadgeColor(idx + 1), alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{idx + 1}</Text>
                    </View>
                    {basisById[seed.apparelId] === 'PSA 10' ? <GradeMark company="PSA" grade="10" height={9} /> : null}
                  </CardArt>
                  <Text numberOfLines={1} style={[ts(12.5, '700', P.ink), { marginTop: 9 }]}>{seed.shortName}</Text>
                  <Text numberOfLines={1} style={[ts(flat ? 15 : 13, '900', P.ink), { marginTop: 4, letterSpacing: -0.3 }]}>{fmtPrice(priceById[seed.apparelId] ?? data?.minPrice ?? 0)}</Text>
                  {(() => {
                    const pc = pctInfo(changeById[seed.apparelId], P);
                    return pc ? <Text numberOfLines={1} style={[ts(flat ? 12 : 9, '800', pc.color), { marginTop: 2 }]}>{pc.text}</Text> : null;
                  })()}
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {/* box hot cards — 자동 슬라이딩 */}
        {snkrBoxRows.length > 0 ? (
          <View style={{ paddingBottom: 26 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 13 }}>
              <Text style={ts(18, '800', P.ink)}>📦 인기 박스</Text>
              {/* 더보기에 선택 게임을 실어 보내 시세확인도 같은 게임(IP) 탭으로 열린다. */}
              <MoreLink onPress={() => router.push(`/cards/packs?game=${homeGame}` as never)} />
            </View>
            <AutoCarousel
              data={snkrBoxRows}
              itemWidth={100}
              gap={14}
              renderItem={({ seed, data }, idx) => (
                <Pressable onPress={() => router.push(`/cards/snkrdunk/${seed.apparelId}` as never)}>
                  <CardArt imageUrl={data?.imageUrl ?? null} fallbackIdx={idx} width={100} height={100} radius={13} />
                  <Text numberOfLines={1} style={[ts(12.5, '700', P.ink), { marginTop: 9 }]}>{seed.shortName}</Text>
                  <Text style={[ts(11, '400', P.ink2), { marginTop: 3 }]}>
                    평균 시세 <Text style={ts(11, '800', P.rise)}>{fmtPrice(data?.minPrice ?? 0)}</Text>
                  </Text>
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {/* realtime movers */}
        {snkrRows.length > 0 ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 30 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={P.rise} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="m3 17 6-6 4 4 8-8" />
                  <Path d="M17 7h4v4" />
                </Svg>
                <Text style={ts(18, '800', P.ink)}>실시간 급등 카드</Text>
              </View>
              <MoreLink onPress={() => router.push(`/cards/snkrdunk?game=${homeGame}` as never)} />
            </View>
            {[...snkrRows]
              .sort((a, b) => (changeById[b.seed.apparelId] ?? -Infinity) - (changeById[a.seed.apparelId] ?? -Infinity))
              .map(({ seed, data }, i) => {
                const pc = pctInfo(changeById[seed.apparelId], P);
                return (
                  <Pressable
                    key={seed.apparelId}
                    onPress={() => router.push(`/cards/snkrdunk/${seed.apparelId}` as never)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: P.line }}
                  >
                    <Text style={[ts(15, '800', i < 3 ? P.rise : P.ink), { width: 14, textAlign: 'center' }]}>{i + 1}</Text>
                    <CardArt imageUrl={data?.imageUrl ?? seed.imageUrl ?? null} fallbackIdx={i} width={46} height={46} radius={9} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={ts(14, '700', P.ink)}>{seed.shortName}</Text>
                      <Text numberOfLines={1} style={[ts(12, '400', P.ink3), { marginTop: 2 }]}>{seed.category ?? '카드'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={ts(14.5, '900', P.ink)}>{fmtPrice(priceById[seed.apparelId] ?? data?.minPrice ?? 0)}</Text>
                      {pc ? <Text numberOfLines={1} style={[ts(flat ? 12.5 : 9.5, '800', pc.color), { marginTop: 3 }]}>{pc.text}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
          </View>
        ) : null}
      </ScrollView>

      {/* side drawer — 사이트맵형 섹션 메뉴. 패널 스프링 슬라이드(튀어나옴) + 항목 스태거.
          픽셀 테마는 직각/잉크 보더 크롬, 플랫(clean·dark)은 소프트 (웹 CleanHome 동일). */}
      <Modal visible={drawerVisible} transparent animationType="none" statusBarTranslucent onRequestClose={closeDrawer}>
        <View style={{ flex: 1 }}>
          <Animated.View
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(22,22,26,.45)',
              // 스프링 오버슈트가 1을 넘어도 오버레이는 완전 불투명 이상으로 가지 않게 클램프.
              opacity: drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={closeDrawer} accessibilityLabel="메뉴 닫기" />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: 290, backgroundColor: P.bg,
              paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24,
              // 오버슈트를 그대로 살려 열릴 때 살짝 '튀어나오는' 느낌 (translateX > 0 순간 허용).
              transform: [{ translateX: drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [-300, 0] }) }],
              borderRightWidth: pixel ? 4 : 0,
              borderRightColor: tc.ink,
              shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 12, height: 0 }, elevation: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 18 }}>
              <Text style={ts(22, '900', P.ink)}>
                <Text style={ts(22, '900', P.ink)}>ARVO</Text>
                <Text style={ts(22, '900', ACCENT30)}>TCG</Text>
              </Text>
              <Pressable onPress={closeDrawer} hitSlop={8} accessibilityLabel="메뉴 닫기" style={{ padding: 4 }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth={2.2} strokeLinecap="round">
                  <Path d="M18 6 6 18M6 6l12 12" />
                </Svg>
              </Pressable>
            </View>
            {/* profile card — 로그인 시 닉네임·레벨(마이페이지와 동일 아바타 레시피), 미로그인 시 로그인 유도 */}
            <Pressable
              onPress={() => goFromDrawer(drawerAuthed ? '/my' : '/login')}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 12,
                backgroundColor: P.tileBg, padding: 14,
                borderRadius: pixel ? 0 : 16,
                borderWidth: pixel ? 3 : 0,
                borderColor: tc.ink,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: pixel ? 0 : 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={44} height={44} style={{ position: 'absolute' }}>
                  <Defs>
                    <LinearGradient id="drawer-av" x1="0" y1="0" x2="0.6" y2="1">
                      <Stop offset="0" stopColor="#3b5bdb" />
                      <Stop offset="1" stopColor="#1e2f8f" />
                    </LinearGradient>
                  </Defs>
                  <Rect width={44} height={44} fill="url(#drawer-av)" />
                </Svg>
                <Text style={{ fontSize: 22 }}>💎</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={ts(14.5, '800', P.ink)}>
                  {!drawerAuthed ? '로그인이 필요해요' : drawerMe ? drawerMe.user.name ?? '트레이너' : '프로필 불러오는 중…'}
                </Text>
                {drawerAuthed && drawerMe ? (
                  <>
                    <Text style={[ts(11.5, '600', P.ink3), { marginTop: 2 }]}>
                      LV.{drawerMe.level.level} · {drawerMe.level.title}
                    </Text>
                    {drawerMe.user.email ? (
                      <Text numberOfLines={1} style={[ts(10.5, '400', P.ink3), { marginTop: 2 }]}>
                        {drawerMe.user.email}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={[ts(11.5, '600', P.ink3), { marginTop: 2 }]}>
                    {drawerAuthed ? '잠시만요…' : '로그인하고 시작하기'}
                  </Text>
                )}
              </View>
              <Chevron size={15} color={P.chev} w={2.4} />
            </Pressable>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12 }} showsVerticalScrollIndicator={false}>
              {(() => {
                let rowIdx = 0;
                return DRAWER_SECTIONS.map((sec) => (
                  <View key={sec.label ?? 'root'}>
                    {sec.label ? (
                      <View
                        style={{
                          marginTop: 8, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 6,
                          borderTopWidth: 1,
                          borderTopColor: pixel ? tc.ink3 : P.line,
                          borderStyle: pixel ? 'dashed' : 'solid',
                        }}
                      >
                        <Text style={[ts(11, '800', P.ink3), { letterSpacing: 1 }]}>{sec.label}</Text>
                      </View>
                    ) : null}
                    {sec.items.map((dm) => {
                      const anim = drawerItemAnims[rowIdx++];
                      return (
                        <Animated.View
                          key={dm.label}
                          style={{
                            opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
                            transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
                          }}
                        >
                          <Pressable
                            onPress={() => goFromDrawer(dm.href)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, paddingHorizontal: 12, borderRadius: pixel ? 0 : 12 }}
                          >
                            <Text style={{ fontSize: 19, width: 26, textAlign: 'center' }}>{dm.emoji}</Text>
                            <Text style={[ts(14.5, '700', P.ink), { flex: 1 }]}>{dm.label}</Text>
                            {(() => {
                              // 알림 항목은 미읽음 수를 동적 배지로 (그 외엔 정적 badge).
                              const badge = dm.href === '/my/messages'
                                ? (unread > 0 ? String(Math.min(unread, 99)) : null)
                                : dm.badge ?? null;
                              return badge ? (
                                <View style={{ backgroundColor: dm.badgeBg ?? RISE, paddingVertical: 2, paddingHorizontal: 8, borderRadius: pixel ? 0 : 9 }}>
                                  <Text style={ts(10.5, '800', '#fff')}>{badge}</Text>
                                </View>
                              ) : null;
                            })()}
                          </Pressable>
                        </Animated.View>
                      );
                    })}
                  </View>
                ));
              })()}
            </ScrollView>
            <Pressable
              onPress={() => goFromDrawer('/settings')}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 13, paddingTop: 14, paddingHorizontal: 24,
                borderTopWidth: pixel ? 3 : 1,
                borderTopColor: pixel ? tc.ink : P.line,
              }}
            >
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={P.ink3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={3} />
                <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </Svg>
              <Text style={ts(13, '700', P.ink3)}>설정</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
