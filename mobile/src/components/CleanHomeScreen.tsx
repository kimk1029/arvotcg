import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, ScrollView, Pressable, Text, TextInput, Image, Animated, Easing } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
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
import { CARD_PACKS } from '@/data/cardPacks';
import { pickHomeBoxPacks } from '../../../shared/homeBoxPacks';
import { jaToKoBatch, jaToKoCached } from '@/lib/cardLang';
import * as ImagePicker from 'expo-image-picker';
import { uploadScanImage, CardScanError } from '@/services/cardScanApi';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/apiClient';
import { trendChangePct } from '../../../shared/snkrdunkPrice';

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
}
interface SnkrRow {
  seed: SnkrDisplaySeed;
  data: SnkrdunkApparel | null;
}

const FEATURED_BY_ID = new Map(SNKRDUNK_FEATURED_CARDS.map((s) => [s.apparelId, s]));

const BOX_NAME_RE = /ボックス|box|booster|ブースター|デッキビルド|スターター|拡張パック|ハイクラスパック|ポケモンセンターセット|シュリンク/i;
const isBoxName = (name: string) => BOX_NAME_RE.test(name || '');


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

// 설정에서 켠 게임별 인기 카드 검색 키워드 (웹 CleanHome 동일). 포켓몬은 browse 기본 풀.
const GAME_POPULAR_KEYWORD: Partial<Record<GameId, string>> = {
  onepiece: 'ワンピースカード',
  yugioh: '遊戯王',
  sports: 'Topps',
};

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
function rankBadgeColor(rank: number): string {
  if (rank === 1) return RISE;
  if (rank === 3) return ACCENT30;
  return '#2B2B2B';
}

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
        <Image source={{ uri: imageUrl }} style={{ width, height, borderRadius: radius, ...shadow }} resizeMode="cover" />
      ) : (
        <View style={{ width, height, borderRadius: radius, backgroundColor: FALLBACK_BG[fallbackIdx % FALLBACK_BG.length], alignItems: 'center', justifyContent: 'center', ...shadow }}>
          <Text style={{ fontSize: 40 }}>🃏</Text>
        </View>
      )}
      {children}
    </View>
  );
}

/** 가로 캐러셀 자동 슬라이딩 — 카드를 두 벌 이어붙여 등속 좌측 무한 루프. 손대면 멈췄다 이어감. */
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
  const tx = useRef(new Animated.Value(0)).current;
  const txVal = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const STEP = itemWidth + gap;
  const setWidth = data.length * STEP;

  useEffect(() => {
    const id = tx.addListener(({ value }) => {
      txVal.current = value;
    });
    return () => tx.removeListener(id);
  }, [tx]);

  const runMarquee = (fromTx: number) => {
    if (setWidth <= 0) return;
    let v = fromTx % setWidth;
    if (v > 0) v -= setWidth;
    const dist = setWidth + v;
    if (dist <= 0.5) {
      tx.setValue(0);
      runMarquee(0);
      return;
    }
    tx.setValue(v);
    animRef.current = Animated.timing(tx, {
      toValue: -setWidth,
      duration: (dist / 22) * 1000, // ~22px/s
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animRef.current.start(({ finished }) => {
      if (finished) runMarquee(0);
    });
  };

  useEffect(() => {
    runMarquee(0);
    return () => {
      animRef.current?.stop();
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setWidth]);

  const pause = () => {
    animRef.current?.stop();
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const resumeSoon = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => runMarquee(txVal.current), 1600);
  };

  const display = [...data, ...data];
  return (
    <View style={{ overflow: 'hidden', paddingTop: 8, paddingBottom: 4 }} onTouchStart={pause} onTouchEnd={resumeSoon} onTouchCancel={resumeSoon}>
      <Animated.View style={{ flexDirection: 'row', paddingLeft: 20, transform: [{ translateX: tx }] }}>
        {display.map((item, i) => (
          <View key={i} style={{ width: itemWidth, marginRight: gap }}>
            {renderItem(item, i % data.length)}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

export function CleanHomeScreen() {
  const { format } = useCurrency();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const toast = useToast();
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

  // 빠른스캔 두 타일의 공통 높이(측정된 최댓값). onTileLayout 이 되먹인다.
  const [tileH, setTileH] = useState(0);

  // 홈 검색 — 직접 타이핑 → 검색 화면에 결과(?q=).
  const [homeQuery, setHomeQuery] = useState('');
  const submitSearch = () => {
    const q = homeQuery.trim();
    if (q) router.push(`/cards/snkrdunk/search?q=${encodeURIComponent(q)}` as never);
  };

  // 홈 카메라 = 웹 HomeKoSearchBar 동일: 촬영 → OCR(세트코드+번호) → 검색 목록으로.
  // 목록에서 카드 선택 → 시세상세 → '내 컬렉션에 추가'로 등록하는 흐름.
  const [scanBusy, setScanBusy] = useState(false);
  const scanToSearch = async () => {
    if (scanBusy) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const result = perm.granted
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setScanBusy(true);
    try {
      const r = await uploadScanImage({
        uri: a.uri,
        guideRect: { x: 0, y: 0, w: a.width ?? 0, h: a.height ?? 0 },
        imageWidth: a.width ?? 0,
        imageHeight: a.height ?? 0,
        capturedAt: new Date().toISOString(),
        useAi: true,
        language: 'ko',
      });
      const setCode = (r.extracted?.setCode ?? '').trim();
      const num = (r.extracted?.cardNumber ?? '').split('/')[0].trim();
      const q = [setCode, num].filter(Boolean).join(' ');
      if (q) router.push(`/cards/snkrdunk/search?q=${encodeURIComponent(q)}` as never);
      else toast.error('카드 정보를 인식하지 못했어요. 하단이 잘 보이게 다시 찍어주세요.');
    } catch (e) {
      if (e instanceof CardScanError && e.code === 'AUTH') {
        toast.error('로그인 후 이용할 수 있어요');
        router.push('/login' as never);
      } else {
        toast.error(e instanceof Error ? e.message : '스캔 실패');
      }
    } finally {
      setScanBusy(false);
    }
  };

  // 인기 카드 풀 — 설정에서 켠 게임별로 조회해 라운드로빈으로 섞는다 (웹 CleanHome 동일 컨셉).
  // 포켓몬은 browse 기본 풀, 나머지 게임은 키워드 검색.
  const { enabledGames, toggleGame } = useGamePrefs();
  const gamesKey = enabledGames.join(',');
  const [snkrRows, setSnkrRows] = useState<SnkrRow[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      // 이름엔 박스 마커가 빠진 박스가 섞일 수 있어 넉넉히 뽑고(상세 itemKind로 한 번 더 거름).
      const per = Math.max(3, Math.ceil(12 / enabledGames.length));
      const pools = await Promise.all(
        enabledGames.map(async (g) => {
          const kw = GAME_POPULAR_KEYWORD[g];
          const list = kw ? await searchSnkrdunkByQuery(kw) : await fetchSnkrdunkBrowse(1);
          return shuffle(list.filter((r) => !isBoxName(r.name))).slice(0, per);
        }),
      );
      const pool = interleaveRows(pools).slice(0, 12);
      const seeds: SnkrDisplaySeed[] =
        pool.length > 0
          ? pool.map((r) => {
              const curated = FEATURED_BY_ID.get(r.apparelId);
              return curated
                ? { apparelId: r.apparelId, shortName: curated.shortName, category: curated.category }
                : {
                    apparelId: r.apparelId,
                    shortName: shortenSnkrName(jaToKoCached(r.name)),
                    category: inferSnkrCategory(r.name),
                  };
            })
          : shuffle(SNKRDUNK_FEATURED_CARDS)
              .slice(0, 12)
              .map((s) => ({ apparelId: s.apparelId, shortName: s.shortName, category: s.category }));
      const fetched = await Promise.all(
        seeds.map(async (seed) => ({ seed, data: await fetchSnkrdunkApparel(seed.apparelId) })),
      );
      if (!alive) return;
      // 상세 itemKind 가 박스인 행을 확실히 제외. 여러 게임이 섞였을 땐 게임 순서 유지를
      // 위해 앞에서부터 6개(라운드로빈 결과라 게임별로 고르게 들어간다).
      const rows = fetched.filter((row) => row.data?.itemKind !== 'box').slice(0, 6);
      setSnkrRows(rows);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamesKey]);

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

  const [snkrBoxRows, setSnkrBoxRows] = useState<SnkrRow[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      // 설정에서 켠 게임의 최신 팩 라운드로빈 선별 — 정본 shared/homeBoxPacks (웹 동일).
      const picked = pickHomeBoxPacks(CARD_PACKS, enabledGames);
      const rows = await Promise.all(
        picked.map(async (pack): Promise<SnkrRow | null> => {
          // 웹 홈 fetchBoxRows 와 동일한 NAS 엔드포인트 (박스 전용 카테고리 그룹 조회).
          const r = await api<{ data: { apparels?: SnkrdunkApparel[] } | null }>(
            `/api/snkrdunk/apparel-groups/${pack.apparelGroupId}?apparelCategoryId=14&page=1&perPage=1`,
            { auth: false },
          ).catch(() => null);
          const box = r?.data?.apparels?.[0];
          if (!box || !box.id) return null;
          return { seed: { apparelId: box.id, shortName: pack.shortName, category: null }, data: box };
        }),
      );
      if (alive) setSnkrBoxRows(rows.filter((r): r is SnkrRow => r !== null).slice(0, 6));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamesKey]);

  const [banners, setBanners] = useState<HeroSlideData[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api<{ data: HeroSlideData[] }>('/api/banners', { auth: false });
        if (alive) setBanners(Array.isArray(r?.data) ? r.data : []);
      } catch {
        if (alive) setBanners([]);
      }
    })();
    return () => {
      alive = false;
    };
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
          <Text style={[ts(12, '400', P.ink2), { lineHeight: 18, flexShrink: 1 }]}>{line}</Text>
        </View>
      ))}
    </View>
  );

  // HOT 카드 위 게임 필터 칩 — 포켓몬·원피스는 항상, 그 외 켜둔 게임도 함께 노출해 on/off.
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
        const on = enabledGames.includes(g);
        return (
          <Pressable
            key={g}
            onPress={() => toggleGame(g)}
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
      {/* 더보기 → 설정: 유희왕·스포츠 등 다른 카드도 켜고 끈다. */}
      <Pressable
        onPress={() => router.push('/settings' as never)}
        hitSlop={4}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 3,
          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
          backgroundColor: P.tileBg, borderWidth: 1, borderColor: P.line,
        }}
      >
        <Text style={ts(13, '700', P.ink2)}>더보기</Text>
        <Chevron size={13} color={P.ink3} w={2.6} />
      </Pressable>
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
          <Pressable onPress={() => router.push('/my/messages' as never)} hitSlop={8}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <Path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </Svg>
          </Pressable>
        </View>

        {/* promo banner — 비면 컴포넌트 내장 폴백 슬라이드 */}
        <HeroBanner slides={banners} />

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
              <Text style={[ts(12, '400', P.ink2), { marginTop: 3 }]}>보유 카드를 등록하고 관리해요</Text>
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

        {/* HOT cards — 자동 슬라이딩 */}
        {snkrRows.length > 0 ? (
          <View style={{ paddingBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 }}>
              <Text style={ts(18, '800', P.ink)}>HOT 카드</Text>
              <MoreLink onPress={() => router.push('/cards/snkrdunk' as never)} />
            </View>
            {/* 게임 필터 칩 — 포켓몬/원피스(+켜둔 게임) on/off. '더보기' 는 설정에서 전체 관리. */}
            <GameChips />
            <AutoCarousel
              data={snkrRows}
              itemWidth={100}
              gap={14}
              renderItem={({ seed, data }, idx) => (
                <Pressable onPress={() => router.push(`/cards/snkrdunk/${seed.apparelId}` as never)}>
                  <CardArt imageUrl={data?.imageUrl ?? null} fallbackIdx={idx} width={100} height={138} radius={11}>
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
              <Text style={ts(18, '800', P.ink)}>인기 박스</Text>
              <MoreLink onPress={() => router.push('/cards/packs' as never)} />
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
              <MoreLink onPress={() => router.push('/cards/snkrdunk' as never)} />
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
                    <CardArt imageUrl={data?.imageUrl ?? null} fallbackIdx={i} width={46} height={46} radius={9} />
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
    </View>
  );
}
