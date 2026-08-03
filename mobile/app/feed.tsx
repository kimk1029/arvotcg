import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View, Pressable, Text, TextInput, Animated, Easing, Image, LayoutAnimation, Modal, Platform, RefreshControl, UIManager } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { useTheme, useThemeColors } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { ShopSection, SHOP_REGIONS } from '@/components/CommunityShop';
import { fonts } from '@/theme/tokens';
import { api } from '@/lib/apiClient';

/**
 * 커뮤니티 — Claude Design 'ARVOTCG 커뮤니티' 프로토타입 레이아웃 (네이티브).
 * 모든 테마가 같은 레이아웃을 쓰고 색/폰트만 테마별로 달라진다 — 클린은 프로토타입
 * 퍼플 팔레트 그대로, 그 외 테마는 테마 토큰(tc). 인기글·HOT키워드·공지는 정적 편집
 * 콘텐츠(웹과 동일), 글 목록·거래/나눔·댓글·북마크는 실데이터(웹 CommunityScreen 동일):
 * GET /api/feeds?limit=20 · GET /api/trades?limit=30 · /api/feeds/{id}/comments · /api/bookmarks.
 */

const PURPLE = '#6a3aff';
const RED = '#F5333F';

// 타이틀 스왑 LayoutAnimation (구 아키텍처 Android 활성화 필요)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Palette {
  pageBg: string;
  cardBg: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  accentDk: string;
  accentSoft: string;
  kwBg: string;
  red: string;
  redSoft: string;
  line: string;
  chip: string;
  chev: string;
}

const CLEAN_P: Palette = {
  pageBg: '#F7F7F9',
  cardBg: '#ffffff',
  ink: '#16161a',
  ink2: '#6B6B70',
  ink3: '#9A9AA0',
  accent: PURPLE,
  accentDk: '#5a3ad6',
  accentSoft: '#EFEBFF',
  kwBg: '#F1ECFF',
  red: RED,
  redSoft: '#FFECEC',
  line: '#F0F0F2',
  chip: '#F2F2F4',
  chev: '#C2C2C8',
};

type CatId = '전체' | '자유' | '시세/정보' | '질문' | '자랑' | '거래/나눔' | '꿀팁';
const CATS: CatId[] = ['전체', '자유', '시세/정보', '질문', '자랑', '거래/나눔', '꿀팁'];

type SortId = '최신순' | '추천순' | '댓글순';
const SORTS: SortId[] = ['최신순', '추천순', '댓글순'];

const TAG_COLOR: Record<string, { fg: string; bg: string }> = {
  '자유': { fg: '#5a3ad6', bg: '#EFEBFF' },
  '질문': { fg: '#1E8E5A', bg: '#E3F6EC' },
  '자랑': { fg: '#C2410C', bg: '#FFEDD5' },
  '꿀팁': { fg: '#2563EB', bg: '#E0EDFF' },
  '거래/나눔': { fg: '#7C3AED', bg: '#F1EAFF' },
  '시세/정보': { fg: '#0369A1', bg: '#E0F2FE' },
};

/* ---------------- 정적 편집 데이터 ---------------- */

interface FeatureItem {
  rank: number;
  title: string;
  comments: number;
  likes: string;
  bg: string;
  emoji: string;
  heat?: string;
}
const FEATURE_HOT: FeatureItem[] = [
  { rank: 1, title: 'PSA 10 리자몽 가격 미쳤네요...🔥', comments: 123, likes: '1,234', bg: '#ff5a2b', emoji: '🔥', heat: '999+' },
  { rank: 2, title: '포켓몬 카드 재테크 현실 수익률', comments: 89, likes: '987', bg: '#5a3aa0', emoji: '👻', heat: '999+' },
  { rank: 3, title: '이거 진짜 사야 하나요? 의견 부탁드려요', comments: 67, likes: '523', bg: '#c98ce0', emoji: '✨', heat: '999+' },
];
const FEATURE_BEST: FeatureItem[] = [
  { rank: 1, title: '초보자를 위한 포켓몬 카드 등급 가이드', comments: 45, likes: '1,234', bg: '#ff7a2f', emoji: '🦎' },
  { rank: 2, title: 'PSA 제출 전 꼭 알아야 할 10가지', comments: 32, likes: '987', bg: '#2a2a34', emoji: '📋' },
  { rank: 3, title: '2024년 상반기 포켓몬 카드 시세 총정리', comments: 25, likes: '523', bg: '#6a5ad0', emoji: '📊' },
];

const KEYWORDS = ['# 리자몽', '# PSA10', '# 흑염의지배자', '# 일본판', '# 시세폭등', '# 크림'];

interface NoticeItem {
  badge: string;
  red?: boolean;
  title: string;
  author: string;
  date: string;
  comments: number;
  likes: number;
}
const NOTICES: NoticeItem[] = [
  { badge: '공지', title: '커뮤니티 운영 규칙 안내', author: '관리자', date: '2024.05.20', comments: 123, likes: 999 },
  { badge: '필독', red: true, title: '시세 정보 글 작성 가이드 (필독)', author: '관리자', date: '2024.05.18', comments: 67, likes: 482 },
];

/* ---------------- 실데이터 타입 (웹 src/lib/types.ts 동일) ---------------- */

interface FeedPost {
  id: number;
  text: string;
  time: string;
  createdAt: string;
  user: string; // authorEmoji (아바타 id or 이모지)
  authorName?: string | null;
  authorBgId?: string;
  authorFrameId?: string;
  images?: string[];
  commentCount?: number;
  likeCount?: number;
}

interface Trade {
  id: number;
  type: 'sell' | 'buy';
  title: string;
  place: string;
  time: string;
  price: string;
  bumpCount?: number;
  authorName?: string;
  images?: string[];
}

/** 글의 카테고리 추정 — 웹 postCat 동일: 사진 유무로 자랑/자유 구분. */
function postCat(p: FeedPost): CatId {
  return (p.images?.length ?? 0) > 0 ? '자랑' : '자유';
}

function formatAbs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------------- 아이콘 ---------------- */

function Search({ c, s = 22 }: { c: string; s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round">
      <Circle cx={11} cy={11} r={7} /><Path d="m20 20-3.5-3.5" />
    </Svg>
  );
}
function Bell({ c, s = 22 }: { c: string; s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Svg>
  );
}
function Edit({ c, s = 16 }: { c: string; s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20h9" /><Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
}
function Chat({ c, s = 14 }: { c: string; s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}
function Like({ stroke, fill, s = 14 }: { stroke: string; fill: string; s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </Svg>
  );
}
function ChevR({ c, s = 13 }: { c: string; s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m9 6 6 6-6 6" />
    </Svg>
  );
}
function ChevD({ c, s = 13 }: { c: string; s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m6 9 6 6 6-6" />
    </Svg>
  );
}
function Refresh({ c, s = 13 }: { c: string; s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><Path d="M21 3v5h-5" /><Path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><Path d="M3 21v-5h5" />
    </Svg>
  );
}

export default function CommunityScreen() {
  const { theme } = useTheme();
  const tc = useThemeColors();
  const flat = isFlatTheme(theme);
  const pixel = !flat;
  const isClean = theme === 'clean';

  const P: Palette = isClean
    ? CLEAN_P
    : {
        pageBg: tc.pap2,
        cardBg: tc.paper,
        ink: tc.ink,
        ink2: tc.ink2,
        ink3: tc.ink3,
        accent: tc.gold,
        accentDk: tc.gold,
        accentSoft: tc.pap3,
        kwBg: tc.pap3,
        red: tc.red,
        redSoft: tc.pap2,
        line: tc.pap3,
        chip: tc.pap2,
        chev: tc.ink3,
      };

  const fontReg = flat ? undefined : fonts.ko;
  const fontBold = flat ? undefined : fonts.koBold;
  const ts = (size: number, weight: '400' | '500' | '600' | '700' | '800' | '900', color: string) => ({
    fontFamily: Number(weight) >= 700 ? fontBold : fontReg,
    fontSize: size,
    fontWeight: weight,
    color,
    lineHeight: Math.round(size * 1.35),
  });

  const tagStyle = (label: string) => (isClean ? TAG_COLOR[label] ?? TAG_COLOR['자유'] : { fg: P.accentDk, bg: P.accentSoft });

  const [mode, setMode] = useState<'feed' | 'shop'>('feed');
  const [region, setRegion] = useState('전체');
  const [cat, setCat] = useState<CatId>('전체');
  const [sort, setSort] = useState<SortId>('최신순');
  const [feature, setFeature] = useState<'hot' | 'best'>('hot');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [keywords, setKeywords] = useState<string[]>(KEYWORDS);
  const isShop = mode === 'shop';
  const switchMode = (m: 'feed' | 'shop') => {
    if (m === mode) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(300, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.scaleXY));
    setMode(m);
  };

  // 실데이터 — 웹 feed/page.tsx 와 동일한 두 요청.
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [f, t] = await Promise.all([
      api<{ items: FeedPost[] }>('/api/feeds?limit=20', { auth: false }).catch(() => ({ items: [] as FeedPost[] })),
      api<{ data: Trade[] }>('/api/trades?limit=30', { auth: false }).catch(() => ({ data: [] as Trade[] })),
    ]);
    setFeed(f.items ?? []);
    setTrades(t.data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const isMarket = cat === '거래/나눔';
  const featureItems = feature === 'hot' ? FEATURE_HOT : FEATURE_BEST;

  // 검색 + 카테고리 필터 + 정렬을 실제 목록에 적용 (웹 CommunityScreen 동일).
  const visiblePosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? feed.filter(
          (p) =>
            (p.text ?? '').toLowerCase().includes(q) ||
            (p.authorName ?? '').toLowerCase().includes(q),
        )
      : feed;
    if (cat !== '전체') list = list.filter((p) => postCat(p) === cat);
    const sorted = [...list];
    if (sort === '추천순') sorted.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));
    else if (sort === '댓글순') sorted.sort((a, b) => (b.commentCount ?? 0) - (a.commentCount ?? 0));
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [feed, cat, sort, query]);

  // 새로고침 — HOT 키워드 순서 셔플.
  const shuffleKeywords = () =>
    setKeywords((prev) => {
      const a = [...prev];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });

  // 카테고리 탭 슬라이딩 밑줄 — 탭 레이아웃을 측정해 인디케이터를 이동.
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const indLeft = useRef(new Animated.Value(0)).current;
  const indWidth = useRef(new Animated.Value(0)).current;
  const indReady = useRef(false);
  const moveIndicator = (c: CatId, animate: boolean) => {
    const l = tabLayouts.current[c];
    if (!l) return;
    if (!animate) {
      indLeft.setValue(l.x);
      indWidth.setValue(l.width);
    } else {
      Animated.parallel([
        Animated.timing(indLeft, { toValue: l.x, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(indWidth, { toValue: l.width, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start();
    }
  };
  useEffect(() => {
    if (tabLayouts.current[cat]) {
      moveIndicator(cat, indReady.current);
      indReady.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  // 카드 컨테이너 — 픽셀: PixelFrame(직각·하드섀도) / 플랫: 둥근 소프트.
  const Card = ({ children, style }: { children: ReactNode; style?: object }) =>
    pixel ? (
      <View style={style}>
        <PixelFrame borderWidth={3} shadow={5} inner={3} bg={tc.white}>
          {children}
        </PixelFrame>
      </View>
    ) : (
      <View
        style={[
          {
            backgroundColor: P.cardBg,
            borderRadius: 18,
            borderWidth: isClean ? 0 : 1,
            borderColor: P.line,
            shadowColor: '#000',
            shadowOpacity: isClean ? 0.05 : 0,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 },
          },
          style,
        ]}
      >
        {children}
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: P.pageBg }}>
      {/* header */}
      <View style={{ backgroundColor: P.cardBg, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 8 }}>
          {/* 커뮤니티 ↔ Shop 모드 토글 — 활성 타이틀이 왼쪽 큰 자리로, 비활성이
              오른쪽 작은 자리로 서로 위치를 교환하며 애니메이션(LayoutAnimation) */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
            {(isShop ? (['shop', 'feed'] as const) : (['feed', 'shop'] as const)).map((m) => {
              const active = m === mode;
              const label = m === 'feed' ? '커뮤니티' : 'Shop';
              return (
                <Pressable key={m} onPress={() => switchMode(m)} hitSlop={6}>
                  <Text style={ts(active ? 22 : 16, '900', active ? P.ink : isClean ? '#C7C7CC' : P.chev)}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flex: 1 }} />
          {!isShop ? (
            <Pressable onPress={() => setSearchOpen((v) => !v)} hitSlop={8}><Search c={searchOpen ? P.accent : P.ink} /></Pressable>
          ) : null}
          <Pressable onPress={() => router.push('/my/messages' as never)} hitSlop={8} style={{ position: 'relative' }}>
            <Bell c={P.ink} />
            <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, paddingHorizontal: 3, backgroundColor: P.red, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: P.cardBg }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>3</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push((isMarket ? '/write/trade' : '/write/feed') as never)} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Edit c="#fff" />
          </Pressable>
        </View>

        {/* search bar (검색 토글) */}
        {!isShop && searchOpen ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Search c={P.ink3} s={18} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="제목·내용·작성자 검색"
                placeholderTextColor={P.ink3}
                autoFocus
                style={[ts(14, '600', P.ink), { flex: 1, padding: 0 }]}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}><Text style={ts(16, '800', P.ink3)}>×</Text></Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* shop 모드: 지역 칩 / feed 모드: 카테고리 탭 */}
        {isShop ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}
            style={{ borderBottomWidth: 1, borderBottomColor: P.line }}
          >
            {SHOP_REGIONS.map((rg) => {
              const on = region === rg;
              return (
                <Pressable key={rg} onPress={() => setRegion(rg)} style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 18, backgroundColor: on ? P.ink : P.chip }}>
                  <Text style={ts(13, '700', on ? P.cardBg : P.ink3)}>{rg}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', gap: 18, paddingHorizontal: 16, paddingTop: 4 }}
        >
          {CATS.map((c) => {
            const on = cat === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCat(c)}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  tabLayouts.current[c] = { x, width };
                  if (c === cat && !indReady.current) {
                    moveIndicator(cat, false);
                    indReady.current = true;
                  }
                }}
                style={{ paddingTop: 8, paddingBottom: 12 }}
              >
                <Text style={ts(15, on ? '800' : '600', on ? P.accent : P.ink2)}>{c}</Text>
              </Pressable>
            );
          })}
          <View style={{ paddingBottom: 10 }}><ChevD c={P.ink3} s={18} /></View>
          {/* 슬라이딩 밑줄 인디케이터 */}
          <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 0, height: 2.5, borderRadius: 2, backgroundColor: P.accent, left: indLeft, width: indWidth }} />
        </ScrollView>
        )}
      </View>

      {isShop ? (
        <ShopSection P={P} ts={ts} />
      ) : (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {/* 전체 탭에서만 인기글 + HOT 키워드 노출. 그 외 카테고리는 목록만. */}
        {cat === '전체' ? (
          <>
        {/* feature card */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
          <Card>
            <View style={{ padding: 16, paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 7 }}>
                  {(['hot', 'best'] as const).map((id) => {
                    const on = feature === id;
                    return (
                      <Pressable key={id} onPress={() => setFeature(id)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 11, backgroundColor: on ? P.ink : P.chip }}>
                        <Text style={ts(13.5, '800', on ? P.cardBg : P.ink3)}>{id === 'hot' ? '🔥 불타는 글' : '👍 개념글'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                  <Text style={ts(12, '700', P.ink3)}>더보기</Text>
                  <ChevR c={P.ink3} s={12} />
                </View>
              </View>
              {featureItems.map((f) => (
                <View key={f.rank} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 11, borderTopWidth: 1, borderTopColor: P.line }}>
                  <Text style={[ts(19, '900', f.heat ? P.red : P.ink), { width: 15, textAlign: 'center' }]}>{f.rank}</Text>
                  <View style={{ width: 46, height: 62, borderRadius: 7, backgroundColor: f.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24 }}>{f.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={2} style={ts(14, '700', P.ink)}>{f.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                      <Meta icon={<Chat c={P.chev} s={12} />} label={String(f.comments)} P={P} ts={ts} />
                      <Meta icon={<Like stroke={P.chev} fill="none" s={12} />} label={f.likes} P={P} ts={ts} />
                    </View>
                  </View>
                  {f.heat ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: P.redSoft, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 14 }}>
                      <Text style={ts(12, '800', P.red)}>🔥 {f.heat}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* HOT keyword */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ backgroundColor: P.kwBg, borderRadius: 16, padding: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <Text style={ts(14.5, '900', P.accent)}>실시간 HOT 키워드</Text>
              <Text style={ts(11.5, '600', P.ink3)}>지금 많이 언급되는 키워드</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 13 }}>
              <KeywordMarquee keywords={keywords} P={P} isClean={isClean} ts={ts} />
              <Pressable onPress={shuffleKeywords} hitSlop={6} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: P.cardBg, borderRadius: 17 }}>
                <Refresh c={P.ink3} s={15} />
              </Pressable>
            </View>
          </View>
        </View>
          </>
        ) : null}

        {/* sort row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 }}>
          {SORTS.map((s, i) => {
            const on = sort === s;
            return (
              <Pressable key={s} onPress={() => setSort(s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={ts(13.5, on ? '800' : '600', on ? P.accent : P.ink3)}>{s}</Text>
                {i === 0 ? <ChevD c={on ? P.accent : P.ink3} s={13} /> : null}
              </Pressable>
            );
          })}
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push('/my/feeds' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 16, height: 16, borderWidth: 1.5, borderColor: P.chev, borderRadius: 5 }} />
            <Text style={ts(12.5, '600', P.ink3)}>내가 쓴 글 보기</Text>
          </Pressable>
        </View>

        {/* post list */}
        <View style={{ paddingHorizontal: pixel ? 16 : 0 }}>
          <Card style={pixel ? undefined : { borderRadius: 0, borderWidth: 0, marginHorizontal: 0 }}>
            <View style={{ backgroundColor: pixel ? tc.white : P.cardBg }}>
              {cat === '전체' && NOTICES.map((n) => (
                <View key={n.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: P.line }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ backgroundColor: n.red ? P.red : P.accent, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7 }}>
                        <Text style={ts(11, '800', '#fff')}>{n.badge}</Text>
                      </View>
                      <Text numberOfLines={1} style={[ts(14.5, '800', P.ink), { flex: 1 }]}>{n.title}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 }}>
                      <Text style={ts(12, '600', P.ink3)}>{n.author}</Text>
                      <Text style={ts(12, '600', P.ink3)}>{n.date}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                    <Meta icon={<Chat c={P.chev} />} label={String(n.comments)} P={P} ts={ts} />
                    <Meta icon={<Like stroke={P.chev} fill="none" />} label={String(n.likes)} P={P} ts={ts} />
                  </View>
                </View>
              ))}

              {loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={ts(13, '600', P.ink3)}>불러오는 중...</Text>
                </View>
              ) : isMarket ? (
                trades.length === 0 ? (
                  <EmptyRow
                    label={'거래/나눔 글이 없어요.'}
                    cta="＋ 거래글 작성"
                    onPress={() => router.push('/write/trade' as never)}
                    P={P}
                    ts={ts}
                  />
                ) : (
                  trades.map((t) => {
                    const isSell = t.type === 'sell';
                    return (
                      <Pressable key={t.id} onPress={() => router.push(`/trade/${t.id}` as never)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: P.line }}>
                        <View style={{ width: 62, height: 84, borderRadius: 8, backgroundColor: P.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {t.images && t.images.length > 0 ? (
                            <Image source={{ uri: t.images[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          ) : (
                            <Text style={{ fontSize: 26 }}>{isSell ? '🏷' : '🛒'}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={2} style={ts(15, '800', P.ink)}>{t.title}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
                            <View style={{ backgroundColor: isSell ? P.red : isClean ? '#2563EB' : tc.blu, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 }}>
                              <Text style={ts(11, '800', '#fff')}>{isSell ? '팝니다' : '삽니다'}</Text>
                            </View>
                            {t.place ? <Text style={ts(12, '600', P.ink3)}>📍 {t.place}</Text> : null}
                            <Text style={ts(12, '500', P.ink3)}>{t.time}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                            <Text style={ts(14.5, '900', isClean ? '#0A7A56' : tc.grn)}>{t.price}</Text>
                            <Text style={ts(11.5, '600', P.ink3)}>
                              {typeof t.bumpCount === 'number' && t.bumpCount > 0 ? `↑ ${t.bumpCount} · ` : ''}{t.authorName ?? '익명'}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })
                )
              ) : visiblePosts.length === 0 ? (
                <EmptyRow
                  label={'아직 글이 없어요.'}
                  cta="＋ 첫 번째가 되어보세요"
                  onPress={() => router.push('/write/feed' as never)}
                  P={P}
                  ts={ts}
                />
              ) : (
                visiblePosts.map((p) => (
                  <PostRow key={p.id} post={p} P={P} ts={ts} tagStyle={tagStyle} />
                ))
              )}
            </View>
          </Card>
        </View>
      </ScrollView>
      )}
    </View>
  );
}

type TsFn = (s: number, w: '400' | '500' | '600' | '700' | '800' | '900', c: string) => object;

function Meta({ icon, label, P, ts }: { icon: ReactNode; label: string; P: Palette; ts: TsFn }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {icon}
      <Text style={ts(11.5, '700', P.ink3)}>{label}</Text>
    </View>
  );
}

function EmptyRow({ label, cta, onPress, P, ts }: { label: string; cta: string; onPress: () => void; P: Palette; ts: TsFn }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 46, paddingHorizontal: 20, gap: 8 }}>
      <Text style={ts(14, '500', P.ink3)}>{label}</Text>
      <Pressable onPress={onPress}>
        <Text style={ts(14, '700', P.accent)}>{cta}</Text>
      </Pressable>
    </View>
  );
}

/* ---------------- 글 행 (펼침: 사진 + 댓글) — 웹 PostRow 동일 로직 ---------------- */

function PostRow({ post, P, ts, tagStyle }: { post: FeedPost; P: Palette; ts: TsFn; tagStyle: (label: string) => { fg: string; bg: string } }) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const images = post.images ?? [];
  const hasThumb = images.length > 0;
  const cat = hasThumb ? '자랑' : '자유';
  const tgs = tagStyle(cat);

  const toggle = () =>
    setOpen((v) => {
      if (!v) setOpened(true);
      return !v;
    });

  return (
    <Pressable onPress={toggle} style={{ flexDirection: 'row', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: P.line }}>
      {/* avatar — 앱은 아바타 에셋 합성이 없어 이모지 폴백 */}
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: P.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 21 }}>{emojiOf(post.user)}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View style={{ backgroundColor: tgs.bg, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 }}>
            <Text style={ts(11, '800', tgs.fg)}>{cat}</Text>
          </View>
          <Text numberOfLines={1} style={[ts(12, '700', P.ink), { flexShrink: 1 }]}>{post.authorName ?? '익명'}</Text>
          <Text style={ts(12, '500', P.ink3)}>{post.time}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 11, marginTop: 9 }}>
          <Text numberOfLines={open ? undefined : 2} style={[ts(13.5, '400', P.ink2), { flex: 1 }]}>{post.text}</Text>
          {hasThumb && !open ? (
            <View style={{ width: 62, height: 84, borderRadius: 8, backgroundColor: P.accentSoft, overflow: 'hidden' }}>
              <Image source={{ uri: images[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
          ) : null}
        </View>

        {/* expand: images + comments */}
        {opened && open ? (
          <View>
            {hasThumb ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>
                {images.map((url, i) => (
                  <Pressable key={url} onPress={() => setLightbox(i)} style={{ width: `${images.length === 1 ? 100 : images.length === 2 ? 48 : 31}%`, aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: P.accentSoft }}>
                    <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <FeedComments feedId={post.id} dateLabel={formatAbs(post.createdAt)} P={P} ts={ts} />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 11 }}>
          <Pressable onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Chat c={P.chev} s={15} />
            <Text style={ts(12.5, '700', P.ink3)}>댓글{post.commentCount ? ` ${post.commentCount}` : ''}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <BookmarkHeart feedId={post.id} />
            {(post.likeCount ?? 0) > 0 ? <Text style={ts(12.5, '700', P.ink3)}>{post.likeCount}</Text> : null}
          </View>
          {hasThumb ? <Text style={ts(12.5, '700', P.ink3)}>📷 {images.length}</Text> : null}
        </View>
      </View>

      {lightbox !== null ? <Lightbox urls={images} startIdx={lightbox} onClose={() => setLightbox(null)} /> : null}
    </Pressable>
  );
}

function emojiOf(v: string | null | undefined): string {
  if (!v) return '🙂';
  if (/^[\p{Emoji}\p{Extended_Pictographic}]/u.test(v)) return v;
  return '🙂';
}

/* ---------------- 북마크(추천) — 웹 BookmarkButton 동일: POST /api/bookmarks 토글 ---------------- */

function BookmarkHeart({ feedId, tradeId }: { feedId?: number; tradeId?: number }) {
  const [bookmarked, setBookmarked] = useState(false);
  const pendingRef = useRef(false);
  const toggle = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      const data = await api<{ bookmarked: boolean }>('/api/bookmarks', { method: 'POST', body: { feedId, tradeId } });
      setBookmarked(data.bookmarked);
    } catch {
      // 미로그인(401) 포함 — 웹과 동일하게 조용히 무시
    } finally {
      pendingRef.current = false;
    }
  };
  return (
    <Pressable onPress={toggle} hitSlop={6} style={{ padding: 4 }}>
      <Text style={{ fontSize: 18, lineHeight: 20 }}>{bookmarked ? '💛' : '🤍'}</Text>
    </Pressable>
  );
}

/* ---------------- 댓글 — 웹 FeedComments 동일: 펼침 시 lazy 로드 ---------------- */

interface FeedComment {
  id: number;
  text: string;
  authorName: string;
  createdAt: string;
}

function FeedComments({ feedId, dateLabel, P, ts }: { feedId: number; dateLabel: string; P: Palette; ts: TsFn }) {
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ data?: FeedComment[] }>(`/api/feeds/${feedId}/comments`, { auth: false })
      .then((j) => alive && setComments(j.data ?? []))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [feedId]);

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setHint(null);
    try {
      const j = await api<{ data: FeedComment }>(`/api/feeds/${feedId}/comments`, { method: 'POST', body: { text: t } });
      setComments((prev) => [...(prev ?? []), j.data]);
      setText('');
    } catch (e) {
      const status = e && typeof e === 'object' && 'status' in e ? (e as { status: number }).status : 0;
      setHint(status === 401 ? '댓글을 쓰려면 로그인이 필요해요' : '등록에 실패했어요. 잠시 후 다시 시도해주세요');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={ts(11.5, '700', P.ink3)}>
        댓글 {comments?.length ?? 0} · {dateLabel}
      </Text>
      {(comments ?? []).map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', gap: 7, marginTop: 9, alignItems: 'flex-start' }}>
          <Text style={[ts(12, '800', P.ink), { flexShrink: 0 }]}>{c.authorName}</Text>
          <Text style={[ts(12.5, '400', P.ink2), { flex: 1 }]}>{c.text}</Text>
        </View>
      ))}
      {hint ? <Text style={[ts(11.5, '600', P.red), { marginTop: 8 }]}>{hint}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: P.chip, borderRadius: 18, paddingHorizontal: 12 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="댓글 달기..."
          placeholderTextColor={P.ink3}
          style={[ts(12.5, '500', P.ink), { flex: 1, paddingVertical: 8 }]}
          maxLength={300}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable onPress={submit} disabled={sending || !text.trim()} hitSlop={6}>
          <Text style={ts(12.5, '800', sending || !text.trim() ? P.ink3 : P.accent)}>등록</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ---------------- 라이트박스 — 웹 Lightbox 대응(풀스크린 모달) ---------------- */

function Lightbox({ urls, startIdx, onClose }: { urls: string[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}>
        <Image source={{ uri: urls[idx] }} style={{ width: '94%', height: '76%' }} resizeMode="contain" />
        {urls.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
            <Pressable onPress={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + urls.length) % urls.length); }} hitSlop={10}>
              <Text style={{ color: '#fff', fontSize: 22 }}>‹</Text>
            </Pressable>
            <Text style={{ color: '#fff', fontSize: 13, alignSelf: 'center' }}>{idx + 1} / {urls.length}</Text>
            <Pressable onPress={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % urls.length); }} hitSlop={10}>
              <Text style={{ color: '#fff', fontSize: 22 }}>›</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

/** HOT 키워드 자동 마퀴 — 키워드 2세트를 translateX 로 끊김 없이 저속 슬라이드. */
function KeywordMarquee({ keywords, P, isClean, ts }: { keywords: string[]; P: Palette; isClean: boolean; ts: (s: number, w: '400' | '500' | '600' | '700' | '800' | '900', c: string) => object }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (w <= 0) return;
    x.setValue(0);
    const anim = Animated.loop(
      Animated.timing(x, { toValue: -w, duration: Math.max(6000, Math.round(w * 28)), easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [w, keywords, x]);

  const chipStyle = { backgroundColor: P.cardBg, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 18, marginRight: 7 } as const;
  const chipText = ts(12.5, '700', isClean ? '#5a3ad6' : P.ink);

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
        <View style={{ flexDirection: 'row' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {keywords.map((k, i) => (
            <View key={`a-${k}-${i}`} style={chipStyle}><Text style={chipText}>{k}</Text></View>
          ))}
        </View>
        <View style={{ flexDirection: 'row' }}>
          {keywords.map((k, i) => (
            <View key={`b-${k}-${i}`} style={chipStyle}><Text style={chipText}>{k}</Text></View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
