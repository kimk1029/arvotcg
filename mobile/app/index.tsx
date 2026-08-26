import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, View, Pressable, Text, TextInput } from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { AppBar, ABtn } from '@/components/AppBar';
import { PortfolioHero } from '@/components/PortfolioHero';
import { HeroBanner, type HeroSlideData } from '@/components/HeroBanner';
import { useHomePrefs } from '@/components/HomePrefsProvider';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { SectHd } from '@/components/cv/SectHd';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { Chip } from '@/components/cv/Chip';
import { RarBadge } from '@/components/cv/RarBadge';
import { GradeBadge } from '@/components/cv/GradeBadge';
import { colors } from '@/theme/tokens';
import { useThemeColors, useTheme, useThemeTextVariant, useInputFont } from '@/components/ThemeProvider';
import { CleanHomeScreen } from '@/components/CleanHomeScreen';
import { isFlatTheme } from '@/lib/theme';
import { isAuthenticated, subscribeSession } from '@/lib/session';

/** 로그인 상태를 반응형으로 구독. */
function useAuthed(): boolean {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  useEffect(() => {
    const sync = () => setAuthed(isAuthenticated());
    const unsub = subscribeSession(sync);
    sync();
    return unsub;
  }, []);
  return authed;
}
import { RARS, gameColors, fmt, priceLabel, displayCardName, inferCardCurrency, cardKrw, cardJpy, cardPrice, type Game, type Rarity } from '@/data/cardvault';
import { updateCard, useCollection } from '@/lib/collection';
import { localizeCardName } from '@/lib/cardNameKo';
import { api } from '@/lib/apiClient';
import { usePriceMode } from '@/lib/priceMode';
import { useCurrency } from '@/components/CurrencyProvider';
import { fetchPortfolio, type PortfolioSummary } from '@/lib/myApi';
import {
  fetchSnkrdunkApparel,
  fetchSnkrdunkBrowse,
  fetchSnkrdunkSalesHistory,
  recentTransactionMedian,
  recoverSnkrdunkApparelId,
  SNKRDUNK_FEATURED_CARDS,
  type SnkrdunkApparel,
  type SnkrdunkCardSeed,
} from '@/services/snkrdunk';
import { CARD_PACKS } from '@/data/cardPacks';
// PackHitsRow 섹션 제거됨 — 웹 메인과 동일 구조로 정렬

const SNKR_CAT_BG: Record<SnkrdunkCardSeed['category'], string> = {
  SAR: colors.orn,
  프로모: colors.pur,
  SR: colors.red,
  원피스: colors.grnDk,
};

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

// 이름만으로 박스 판별 (인기 카드 섹션에서 박스류 제외용). 웹 snkrdunk.ts
// classifySnkrdunkName / DashboardScreen BOX_NAME_RE 와 마커 일치시킬 것.
const BOX_NAME_RE = /ボックス|box|booster|ブースター|デッキビルド|スターター|拡張パック|ハイクラスパック|ポケモンセンターセット|シュリンク/i;
function isBoxName(name: string): boolean {
  return BOX_NAME_RE.test(name || '');
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const POINTS = 1280;
const LEVEL_LABEL = 'LV.12 다이아 컬렉터';
const XP_CURRENT = 340;
const XP_MAX = 500;
const TRADES = 3;


const ACTIVITY: { icon: string; c: string; txt: string; time: string; pt: string }[] = [
  { icon: '🔥', c: colors.grn, txt: '보유 카드 가격 ▲ +8%', time: '10분 전', pt: '+5P' },
  { icon: '📷', c: colors.blu, txt: '신규 카드 스캔 완료', time: '1시간 전', pt: '+10P' },
  { icon: '🤝', c: colors.gold, txt: '관심 카드 거래 완료', time: '3시간 전', pt: '+15P' },
  { icon: '⭐', c: colors.pur, txt: '레벨업! LV.12 달성', time: '어제', pt: '+50P' },
];

export default function Home() {
  // 모든 테마가 프로토타입 메인화면(CleanHomeScreen)을 쓴다 — 색/폰트만 테마별로 다름.
  return <CleanHomeScreen />;
}

// 이전 픽셀 레이아웃 — 현재 미사용(필요 시 참조용으로 보존).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyHome() {
  const authed = useAuthed();
  // 클린·다크는 시스템 산세리프 — 인풋/placeholder 가 비트맵 폰트로 남지 않게.
  const inputFont = useInputFont();
  const tc = useThemeColors();
  const { theme } = useTheme();
  const txt = useThemeTextVariant();
  const { format: formatCurrency } = useCurrency();
  const { showPortfolioOnMain } = useHomePrefs();
  const [activeGame, setActiveGame] = useState<string>('전체');
  const [homeSearch, setHomeSearch] = useState('');
  // 관심 카드(favorite=true)는 포트폴리오 합계 / 차트 / 통계에서 제외.
  const ownedAll = useCollection();
  const owned = ownedAll.filter((c) => !c.favorite);

  // 서버 일별 스냅샷 (KST 정각 reset) — totalJpy / changePct / history.
  // 인증 시에만 동작. 미인증 / 실패 시 폴백으로 로컬 useCollection 사용.
  const [serverPortfolio, setServerPortfolio] = useState<PortfolioSummary | null>(null);
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    fetchPortfolio()
      .then((d) => alive && d && d.totalCount > 0 && setServerPortfolio(d))
      .catch(() => undefined);
    return () => { alive = false; };
  }, [authed]);
  const { mode: globalPriceMode } = usePriceMode();
  // Force singles when no card in the collection has any PSA10 data —
  // the toggle isn't shown in that case but we still want totals to use
  // singles consistently.
  const hasAnyPsa10 = owned.some((c) => (c.pricePsa10 ?? 0) > 0);
  const priceMode = hasAnyPsa10 ? globalPriceMode : 'single';
  // Portfolio totals always in KRW — JPY entries (snkrdunk-matched cards)
  // are converted via toKrw() so they don't get summed at face value. The
  // global priceMode picks singles vs PSA-10 medians per card.
  const totalVal = owned.reduce((a, c) => a + cardKrw(c, priceMode), 0);
  // 통화-반영 표시용 합계(JPY). format() 가 엔/원 설정에 맞게 변환한다.
  const totalJpy = owned.reduce((a, c) => a + cardJpy(c, priceMode), 0);
  const prevVal = Math.round(totalVal * 0.88);
  const changePct = prevVal > 0 ? Math.round(((totalVal - prevVal) / prevVal) * 100) : 0;
  const graded = owned.filter((c) => c.grade != null);
  const topCards = [...owned].sort((a, b) => cardKrw(b, priceMode) - cardKrw(a, priceMode)).slice(0, 3);

  const rarDist = RARS.map((r) => ({ r, n: owned.filter((c) => c.rar === r).length })).filter(
    (x) => x.n > 0,
  );
  const rarMax = Math.max(...rarDist.map((x) => x.n), 1);

  const presentGames = Array.from(new Set(owned.map((c) => c.game))) as Game[];
  const gameDist = presentGames.map((g) => ({
    g,
    n: owned.filter((c) => c.game === g).length,
    val: owned.filter((c) => c.game === g).reduce((a, c) => a + cardJpy(c, priceMode), 0),
  }));

  const gradedPct = owned.length > 0 ? Math.round((graded.length / owned.length) * 100) : 0;

  // Background refresh: for every owned card with a snkrdunkApparelId (or
  // a recoverable signal — imageUrl / promo name pattern), fetch the latest
  // snkrdunk min price and rewrite the stored price. Without this, the
  // portfolio total drifts away from market value because cards keep the
  // price that was current when they were scanned. Recovery uses the
  // precise setCode+number match in recoverSnkrdunkApparelId — sibling
  // prints can't sneak in.
  useEffect(() => {
    let alive = true;
    (async () => {
      const tasks = owned.map(async (c) => {
        if (!alive) return;
        let apparelId = c.snkrdunkApparelId ?? null;
        const looksLikeSnkr =
          apparelId != null ||
          (c.imageUrl && /snkrdunk\.com/i.test(c.imageUrl)) ||
          /\[[A-Za-z]+-P\b|プロモ/.test(c.name ?? '');
        if (!looksLikeSnkr) return;
        if (!apparelId) {
          apparelId = await recoverSnkrdunkApparelId({
            name: c.name,
            set: c.set,
            num: c.num,
            imageUrl: c.imageUrl,
          });
        }
        if (!apparelId) return;
        const [apparel, history] = await Promise.all([
          fetchSnkrdunkApparel(apparelId),
          fetchSnkrdunkSalesHistory(apparelId),
        ]);
        if (!alive) return;
        // Same logic as detail: store BOTH segment medians so the home
        // portfolio total can flip between singles and PSA10 instantly
        // without re-fetching every card.
        const singleP = recentTransactionMedian(history, 'single') ?? apparel?.minPrice ?? 0;
        const psa10P = recentTransactionMedian(history, 'psa10') ?? 0;
        if (singleP <= 0 && psa10P <= 0) return;
        const needsUpdate =
          (singleP > 0 && c.priceSingle !== singleP) ||
          (psa10P > 0 && c.pricePsa10 !== psa10P) ||
          c.priceCurrency !== 'JPY' ||
          c.snkrdunkApparelId !== apparelId;
        if (!needsUpdate) return;
        const patch: Partial<typeof c> = {
          priceCurrency: 'JPY',
          snkrdunkApparelId: apparelId,
        };
        if (singleP > 0) {
          patch.priceSingle = singleP;
          patch.price = singleP;
          patch.trend = [singleP];
        }
        if (psa10P > 0) patch.pricePsa10 = psa10P;
        updateCard(c.id, patch);
      });
      await Promise.allSettled(tasks);
    })();
    return () => { alive = false; };
    // Owned changes drive a re-sync; the price-comparison guards prevent
    // an infinite update loop after the first pass converges.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned.length]);

  const [snkrRows, setSnkrRows] = useState<SnkrRow[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      // 검색 HTML 풀에서 6장을 매번 다르게 픽. 실패하면 큐레이션된 시드로 폴백.
      // 인기 카드 섹션은 싱글만 — 박스류는 제외(별도 인기 박스 섹션에서 노출).
      const pool = (await fetchSnkrdunkBrowse(1)).filter((r) => !isBoxName(r.name));
      const seeds: SnkrDisplaySeed[] =
        pool.length > 0
          ? shuffle(pool)
              .slice(0, 6)
              .map((r) => {
                const curated = FEATURED_BY_ID.get(r.apparelId);
                return curated
                  ? { apparelId: r.apparelId, shortName: curated.shortName, category: curated.category }
                  : {
                      apparelId: r.apparelId,
                      // 웹과 동일하게 JA→KO 변환 후 단축 (앱에서 일본어로 나오던 문제 수정)
                      shortName: shortenSnkrName(localizeCardName(r.name)),
                      category: inferSnkrCategory(r.name),
                    };
              })
          : shuffle(SNKRDUNK_FEATURED_CARDS)
              .slice(0, 6)
              .map((s) => ({ apparelId: s.apparelId, shortName: s.shortName, category: s.category }));

      const rows = await Promise.all(
        seeds.map(async (seed) => ({
          seed,
          data: await fetchSnkrdunkApparel(seed.apparelId),
        })),
      );
      // 이름 마커 없는 박스도 상세 itemKind 로 확정 제외 — 인기 카드는 싱글만.
      if (alive) setSnkrRows(rows.filter((r) => r.data?.itemKind !== 'box'));
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 인기 박스 — 최근 포켓몬 팩의 대표 '박스'(apparelCategoryId=14)로 구성.
  // 검색 이름 추측이 아니라 박스 전용 카테고리 조회라 싱글카드가 섞이지 않는다.
  const [snkrBoxRows, setSnkrBoxRows] = useState<SnkrRow[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const pool = CARD_PACKS
        .filter((p) => (p.game ?? 'pokemon') === 'pokemon' && p.apparelGroupId > 0)
        .sort((a, b) => (b.releasedAt ?? '').localeCompare(a.releasedAt ?? ''))
        .slice(0, 12);
      const picked = shuffle(pool).slice(0, 8);
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
  }, []);

  // 히어로 배너 (웹과 동일하게 /api/banners). 실패/빈 경우 영역 미표시.
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
    return () => { alive = false; };
  }, []);

  const submitHomeSearch = () => {
    const q = homeSearch.trim();
    if (!q) return;
    router.push(`/cards/snkrdunk/search?q=${encodeURIComponent(q)}` as never);
  };

  // 메인 상단 재배치 대상 — ON: 검색→바로가기→레벨, OFF: 레벨→바로가기→검색(→인기).
  const searchNode = (
    <>
        {/* Section: 카드 검색 — 웹 메인과 동일하게 포트폴리오 바로 아래 */}
        <View style={{ marginHorizontal: 14, marginBottom: 6 }}>
          <SectHd title="카드 검색" />
          <PixelFrame borderWidth={3} shadow={5} inner={3}>
            <View
              style={{
                height: 44,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: tc.white,
              }}
            >
              <PixelText variant={txt} size={12} color={tc.ink3} style={{ marginLeft: 12 }}>
                🔍
              </PixelText>
              <TextInput
                value={homeSearch}
                onChangeText={setHomeSearch}
                onSubmitEditing={submitHomeSearch}
                returnKeyType="search"
                inputMode="search"
                placeholder="카드 검색 (예: 카드명·세트코드)"
                placeholderTextColor={tc.ink4}
                numberOfLines={1}
                style={{
                  flex: 1,
                  height: '100%',
                  paddingHorizontal: 9,
                  color: tc.ink,
                  fontFamily: inputFont,
                  fontSize: 11,
                }}
              />
              {homeSearch ? (
                <Pressable
                  onPress={() => setHomeSearch('')}
                  style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
                >
                  <PixelText variant={txt} size={10} color={tc.ink3}>
                    X
                  </PixelText>
                </Pressable>
              ) : null}
              <Pressable
                onPress={submitHomeSearch}
                style={{
                  width: 32,
                  height: 32,
                  marginRight: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tc.ink,
                  borderColor: tc.ink,
                  borderWidth: 1,
                }}
              >
                <PixelText variant={txt} size={12} color={tc.gold}>
                  ▶
                </PixelText>
              </Pressable>
            </View>
          </PixelFrame>
        </View>
    </>
  );
  const shortcutsNode = (
    <>
        {/* Section: 바로가기 (Quick Actions) */}
        <View style={{ marginHorizontal: 14 }}>
          <SectHd title="바로가기" />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginHorizontal: 14,
            marginBottom: 6,
          }}
        >
          <QuickBtn icon="📷" kind="scan" label="스캔" bg={tc.grn} href="/cards/grading" />
          <QuickBtn icon="¥" kind="price" label="시세확인" bg={tc.gold} href="/cards/packs" />
          <QuickBtn icon="🔨" kind="auction" label="MVC경매" bg={tc.blu} href="/cards/mvc-auction" />
          <QuickBtn icon={<KoreaMarketIcon />} kind="market" label="국내마켓" bg={tc.red} href="/cards/bunjang" />
          <QuickBtn icon="🤝" kind="trade" label="거래" bg={tc.grn} href="/trade" />
        </View>
    </>
  );
  const levelNode = (
    <>
        {/* XP / Level — 한 줄짜리 컴팩트 (LV · XP바 · XP · 포인트) */}
        <View style={{ marginHorizontal: 14, marginBottom: 6 }}>
          <PixelFrame bg={tc.white}>
            <View style={{ paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <PixelText variant={txt} size={10} color={tc.ink} numberOfLines={1} style={{ flexShrink: 0 }}>
                {LEVEL_LABEL}
              </PixelText>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  backgroundColor: tc.pap3,
                  borderColor: tc.ink,
                  borderWidth: 1,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.round((XP_CURRENT / XP_MAX) * 100)}%`,
                    height: '100%',
                    backgroundColor: tc.pur,
                  }}
                />
              </View>
              <PixelText variant={txt} size={9} color={tc.ink3} style={{ flexShrink: 0 }}>
                {XP_CURRENT}/{XP_MAX}
              </PixelText>
              <PixelText variant={txt} size={10} color={tc.goldDk} style={{ flexShrink: 0 }}>
                🪙{POINTS.toLocaleString()}
              </PixelText>
            </View>
          </PixelFrame>
        </View>
    </>
  );
  const popularNode =
    snkrRows.length > 0 ? (
      <PopularCardsSection rows={snkrRows} theme={theme} tc={tc} txt={txt} autoScroll={!showPortfolioOnMain} />
    ) : null;
  const popularBoxNode =
    snkrBoxRows.length > 0 ? (
      <PopularCardsSection
        rows={snkrBoxRows}
        theme={theme}
        tc={tc}
        txt={txt}
        autoScroll={!showPortfolioOnMain}
        title="📦 인기 박스들"
        darkTitle="박스 시세"
        moreHref="/cards/packs"
      />
    ) : null;
  // 레벨 아래 컴팩트 히어로 배너 (웹과 동일 위치). DB 배너 없으면 컴포넌트가 폴백 노출.
  const bannerNode = <HeroBanner slides={banners} />;

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar right={<ABtn onPress={() => router.push('/my' as never)}>👤</ABtn>} />
      {/* 다크(주식창): 실시간 인기 티커 바 */}
      {theme === 'dark' && snkrRows.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, backgroundColor: tc.pap2, borderBottomColor: tc.pap3, borderBottomWidth: 1 }}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          <View style={{ paddingHorizontal: 14, paddingVertical: 9, borderRightColor: tc.pap3, borderRightWidth: 1 }}>
            <PixelText variant={txt} size={11} weight="bold" color={tc.blu}>🔥 실시간 인기</PixelText>
          </View>
          {snkrRows.slice(0, 8).map(({ seed, data }) => (
            <Pressable
              key={seed.apparelId}
              onPress={() => router.push(`/cards/snkrdunk/${seed.apparelId}` as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRightColor: tc.pap3, borderRightWidth: 1 }}
            >
              <PixelText variant={txt} size={11} color={tc.ink2} numberOfLines={1} style={{ maxWidth: 92 }}>{seed.shortName}</PixelText>
              <PixelText variant={txt} size={11} weight="bold" color={tc.ink}>
                {data && data.minPrice > 0 ? `¥${data.minPrice.toLocaleString('ja-JP')}` : '—'}
              </PixelText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — 메인 표시 ON 일 때만 (기본 off) */}
        {showPortfolioOnMain ? <PortfolioHero /> : null}

        {/* 상단 그룹 — ON: 검색→바로가기→레벨 / OFF: 레벨→바로가기→검색→인기 */}
        {showPortfolioOnMain ? (
          <>
            {searchNode}
            {shortcutsNode}
            {levelNode}
            {bannerNode}
          </>
        ) : (
          <>
            {levelNode}
            {bannerNode}
            {shortcutsNode}
            {searchNode}
            {popularNode}
            {popularBoxNode}
          </>
        )}

        {/* Section: 핵심 지표 */}
        <View style={{ marginHorizontal: 14 }}>
          <SectHd title="핵심 지표" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 14, marginBottom: 6 }}>
          <Block label="컬렉션 가치" value={formatCurrency(serverPortfolio?.totalJpy ?? totalJpy)} sub={`▲ +${changePct}% 지난주`} color={tc.goldDk} icon="💰" />
          <Block label="그레이딩률" value={`${gradedPct}%`} sub={`${graded.length} / ${owned.length}장`} color={tc.pur} icon="🏆" />
          <Block label="최고가 카드" value={formatCurrency(topCards[0] ? cardJpy(topCards[0], priceMode) : 0)} sub={topCards[0] ? displayCardName(topCards[0].name) : undefined} color={tc.grnDk} icon="🎯" />
          <Block label="이번주 거래" value={`${TRADES}건`} sub="+45P 포인트 획득" color={tc.blu} icon="🤝" onPress={() => router.push('/feed' as never)} />
        </View>

        {/* Section: 게임별 현황 */}
        <View style={{ marginHorizontal: 14 }}>
          <SectHd title="게임별 현황" />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}
          style={{ marginBottom: 10 }}
        >
          {(['전체', ...presentGames] as string[]).map((g) => {
            const on = activeGame === g;
            const bg = on ? tc.ink : g !== '전체' ? gameColors[g as Game] : tc.white;
            const fg = on ? tc.gold : g !== '전체' ? tc.white : tc.ink;
            return (
              <Chip key={g} on={on} onPress={() => setActiveGame(g)} bg={bg} fg={fg} size={9} px={11} py={6}>
                {g === '전체' ? 'ALL' : g}
              </Chip>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 14, marginBottom: 6 }}>
          {(activeGame === '전체' ? gameDist : gameDist.filter((x) => x.g === activeGame)).map(({ g, n, val }) => {
            const pct = owned.length > 0 ? Math.round((n / owned.length) * 100) : 0;
            const gGraded = owned.filter((c) => c.game === g && c.grade != null).length;
            return (
              <View key={g} style={{ width: '48%' }}>
                <PixelFrame>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      height: 138,
                      borderTopWidth: 4,
                      borderTopColor: gameColors[g],
                    }}
                  >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <PixelText variant={txt} size={12} style={{ flex: 1 }}>
                      {g}
                    </PixelText>
                    <PixelText variant={txt} size={11} color={tc.ink3}>
                      {pct}%
                    </PixelText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
                    <PixelText variant={txt} size={20} style={{ letterSpacing: -1 }}>
                      {n}
                    </PixelText>
                    <PixelText variant={txt} size={11} color={tc.ink3} style={{ marginLeft: 4 }}>
                      장
                    </PixelText>
                  </View>
                  <PixelText variant={txt} size={11} color={tc.grnDk} style={{ marginBottom: 8 }}>
                    {formatCurrency(val)}
                  </PixelText>
                  <View style={{ flexDirection: 'row', height: 8 }}>
                    {RARS.map((r) => {
                      const rn = owned.filter((c) => c.game === g && c.rar === r).length;
                      if (!rn) return null;
                      return <View key={r} style={{ flex: rn, backgroundColor: rarColor(r) }} />;
                    })}
                  </View>
                  {gGraded > 0 ? (
                    <PixelText variant={txt} size={9} color={tc.goldDk} style={{ marginTop: 6 }}>
                      🏆 그레이딩 {gGraded}건
                    </PixelText>
                  ) : null}
                </View>
                </PixelFrame>
              </View>
            );
          })}
        </View>

        {/* 인기 카드들 — ON: 지표·게임 뒤 / OFF: 검색 다음(자동 좌측 스크롤) */}
        {showPortfolioOnMain ? popularNode : null}
        {showPortfolioOnMain ? popularBoxNode : null}

        {/* Section: 최근 활동 */}
        <View style={{ marginHorizontal: 14 }}>
          <SectHd title="최근 활동" />
        </View>
        <View style={{ marginHorizontal: 14, marginBottom: 6 }}>
          <PixelFrame bg={tc.white}>
            <View style={{ padding: 14, paddingBottom: 6 }}>
              {ACTIVITY.map((a, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 10,
                    borderBottomWidth: i < ACTIVITY.length - 1 ? 2 : 0,
                    borderBottomColor: tc.pap3,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: a.c,
                      borderColor: tc.ink,
                      borderWidth: 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{a.icon}</Text>
                  </View>
                  <PixelText variant={txt} size={10} style={{ flex: 1, lineHeight: 15 }}>
                    {a.txt}
                  </PixelText>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <PixelText variant={txt} size={10} color={tc.goldDk}>
                      {a.pt}
                    </PixelText>
                    <PixelText variant={txt} size={9} color={tc.ink3}>
                      {a.time}
                    </PixelText>
                  </View>
                </View>
              ))}
            </View>
          </PixelFrame>
        </View>

      </ScrollView>
    </View>
  );
}

function rarColor(r: Rarity): string {
  return r === 'C' ? '#475569'
    : r === 'U' ? '#22C55E'
    : r === 'R' ? '#3A5BD9'
    : r === 'SR' ? '#7C3AED'
    : r === 'HR' ? '#EC4899'
    : '#FFD23F';
}

function Block({
  label,
  value,
  sub,
  color,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: string;
  onPress?: () => void;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const content = (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 14,
        height: 88,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {icon ? (
        <Text
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            fontSize: 18,
            opacity: 0.15,
          }}
        >
          {icon}
        </Text>
      ) : null}
      <PixelText variant={txt} size={10} color={tc.ink3} numberOfLines={1}>
        {label}
      </PixelText>
      <PixelText
        variant={txt}
        size={18}
        color={color ?? tc.ink}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ letterSpacing: -1, marginVertical: 5 }}
      >
        {value}
      </PixelText>
      {sub ? (
        <PixelText variant={txt} size={9} color={tc.ink3} numberOfLines={1}>
          {sub}
        </PixelText>
      ) : null}
    </View>
  );
  return (
    <View style={{ width: '48%' }}>
      {onPress ? (
        <PixelPress onPress={onPress}>{content}</PixelPress>
      ) : (
        <PixelFrame>{content}</PixelFrame>
      )}
    </View>
  );
}

function KoreaMarketIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Rect x={3} y={7} width={16} height={12} fill={colors.ink} />
      <Rect x={5} y={9} width={12} height={8} fill={colors.white} />
      <Rect x={7} y={4} width={8} height={3} fill={colors.ink} />
      <Rect x={8} y={2} width={6} height={3} fill={colors.white} />
      <Rect x={9} y={11} width={4} height={4} fill={colors.red} />
      <Rect x={11} y={13} width={4} height={4} fill={colors.blu} />
      <Rect x={6} y={11} width={2} height={2} fill={colors.ink} />
      <Rect x={15} y={14} width={2} height={2} fill={colors.ink} />
    </Svg>
  );
}

type QuickKind = 'scan' | 'price' | 'auction' | 'market' | 'trade';

/** 클린·다크 테마용 바로가기 라인 아이콘 (웹 클린 테마와 동일 톤). */
function QuickCleanIcon({ kind, color }: { kind: QuickKind; color: string }) {
  const p = { stroke: color, strokeWidth: 1.8, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {kind === 'scan' && (
        <>
          <Path d="M4 9V6.5A1.5 1.5 0 0 1 5.5 5H8" {...p} />
          <Path d="M16 5h2.5A1.5 1.5 0 0 1 20 6.5V9" {...p} />
          <Path d="M20 15v2.5a1.5 1.5 0 0 1-1.5 1.5H16" {...p} />
          <Path d="M8 19H5.5A1.5 1.5 0 0 1 4 17.5V15" {...p} />
          <Circle cx={12} cy={12} r={3} {...p} />
        </>
      )}
      {kind === 'price' && (
        <>
          <Path d="M4 13.5 11.5 6H18a1 1 0 0 1 1 1v6.5L11.5 21z" {...p} />
          <Circle cx={14.5} cy={9.5} r={1.2} fill={color} stroke="none" />
        </>
      )}
      {kind === 'auction' && (
        <>
          <Path d="M13.5 3.5 19 9l-2.5 2.5L11 6z" {...p} />
          <Path d="M11.5 7.5 5 14" {...p} />
          <Path d="M8 10.5 12 14.5" {...p} />
          <Path d="M4 20.5h9" {...p} />
        </>
      )}
      {kind === 'market' && (
        <>
          <Path d="M4.5 9 6 5h12l1.5 4" {...p} />
          <Path d="M4.5 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 3 0" {...p} />
          <Path d="M5.5 11v8h13v-8" {...p} />
          <Path d="M10 19v-4h4v4" {...p} />
        </>
      )}
      {kind === 'trade' && (
        <>
          <Path d="M5 8h12" {...p} />
          <Path d="M14 5 17 8l-3 3" {...p} />
          <Path d="M19 16H7" {...p} />
          <Path d="M10 13 7 16l3 3" {...p} />
        </>
      )}
    </Svg>
  );
}

function QuickBtn({ icon, kind, label, bg, href }: { icon: ReactNode; kind: QuickKind; label: string; bg: string; href: string }) {
  const tc = useThemeColors();
  const { theme } = useTheme();
  const flat = isFlatTheme(theme);
  const txt = useThemeTextVariant();
  return (
    <View style={{ width: '19%' }}>
      <PixelPress onPress={() => router.push(href as never)} borderWidth={3} shadow={5} inner={3}>
        <View style={{ paddingVertical: 8, paddingHorizontal: 0, alignItems: 'center', gap: 5, minWidth: 0 }}>
          {flat ? (
            // 클린·다크 — 소프트 틴트 라운드 타일 + 라인 아이콘
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 13,
                backgroundColor: `${bg}22`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QuickCleanIcon kind={kind} color={bg} />
            </View>
          ) : (
            <View
              style={{
                width: 32,
                height: 32,
                backgroundColor: bg,
                borderColor: tc.ink,
                borderWidth: 2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {typeof icon === 'string' ? <Text style={{ fontSize: 17 }}>{icon}</Text> : icon}
            </View>
          )}
          <PixelText variant={txt} size={11} color={tc.ink} numberOfLines={1} adjustsFontSizeToFit style={{ textAlign: 'center' }}>
            {label}
          </PixelText>
        </View>
      </PixelPress>
    </View>
  );
}

/**
 * 인기 카드 섹션 — 다크=실시간 시세 종목 리스트 / 그 외=가로 캐러셀.
 * autoScroll=true 면 캐러셀이 자동으로 천천히 왼쪽으로 무한 스크롤(로테이션).
 * 카드를 두 벌 이어붙이고 절반 지점에서 offset 을 되돌려 끊김 없이 루프한다.
 */
function PopularCardsSection({
  rows,
  theme,
  tc,
  txt,
  autoScroll,
  title = '🔥 인기 카드들',
  darkTitle = '실시간 시세',
  moreHref = '/cards/snkrdunk',
}: {
  rows: SnkrRow[];
  theme: string;
  tc: typeof colors;
  txt: 'pixel' | 'ko';
  autoScroll: boolean;
  title?: string;
  darkTitle?: string;
  moreHref?: string;
}) {
  const carousel = theme !== 'dark';
  const flat = theme === 'clean' || theme === 'dark';
  // 웹처럼 끊김 없이 흐르는 슬라이드 — 네이티브 드라이버 translateX.
  // UI 스레드에서만 돌아 JS 부하 0 → 바로가기/카드 탭이 안 막힌다.
  const tx = useRef(new Animated.Value(0)).current;
  const txVal = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const STEP = 118; // 카드 폭(112) + marginRight(6)
  const setWidth = rows.length * STEP; // 카드 한 벌(원본) 폭

  // tx 현재값 추적 (터치로 멈췄다 이어갈 때 사용).
  useEffect(() => {
    const id = tx.addListener(({ value }) => { txVal.current = value; });
    return () => tx.removeListener(id);
  }, [tx]);

  // fromTx(현재 tx, 음수) → -setWidth 까지 등속 이동 후 0부터 무한 반복.
  // 카드를 두 벌 이어붙였으므로 -setWidth 와 0 의 화면이 동일 → 리셋이 안 보임.
  const runMarquee = (fromTx: number) => {
    if (!autoScroll || !carousel || setWidth <= 0) return;
    let v = fromTx % setWidth; // (-setWidth, 0]
    if (v > 0) v -= setWidth;
    const dist = setWidth + v; // v∈[-setWidth,0] → dist∈[0,setWidth]
    if (dist <= 0.5) { tx.setValue(0); runMarquee(0); return; }
    tx.setValue(v);
    animRef.current = Animated.timing(tx, {
      toValue: -setWidth,
      duration: (dist / 22) * 1000, // ~22px/s (웹과 비슷한 속도)
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animRef.current.start(({ finished }) => { if (finished) runMarquee(0); });
  };

  useEffect(() => {
    runMarquee(0);
    return () => {
      animRef.current?.stop();
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll, carousel, setWidth]);

  const pauseMarquee = () => {
    animRef.current?.stop();
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const resumeMarqueeSoon = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { runMarquee(txVal.current); }, 1600);
  };

  if (theme === 'dark') {
    return (
      <View style={{ marginHorizontal: 14, marginBottom: 6 }}>
        <SectHd title={darkTitle} more="전체보기 →" onMore={() => router.push(moreHref as never)} />
        <View style={{ backgroundColor: tc.white, borderColor: tc.pap3, borderWidth: 1, borderRadius: 14, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: tc.pap2, borderBottomColor: tc.pap3, borderBottomWidth: 1 }}>
            <PixelText variant={txt} size={9} color={tc.ink4} style={{ width: 18, textAlign: 'center' }}>#</PixelText>
            <PixelText variant={txt} size={9} color={tc.ink4} style={{ flex: 1 }}>카드명</PixelText>
            <PixelText variant={txt} size={9} color={tc.ink4}>현재가</PixelText>
          </View>
          {rows.slice(0, 10).map(({ seed, data }, i, arr) => (
            <Pressable
              key={seed.apparelId}
              onPress={() => router.push(`/cards/snkrdunk/${seed.apparelId}` as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomColor: tc.pap3, borderBottomWidth: i < arr.length - 1 ? 1 : 0 }}
            >
              <PixelText variant={txt} size={12} weight="bold" color={i < 3 ? tc.red : tc.ink4} style={{ width: 18, textAlign: 'center' }}>{i + 1}</PixelText>
              <ThumbImage uri={data?.imageUrl} style={{ width: 34, height: 46, borderRadius: 6 }} emojiSize={16} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <PixelText variant={txt} size={13} weight="bold" color={tc.ink} numberOfLines={1}>{seed.shortName}</PixelText>
                <PixelText variant={txt} size={10} color={tc.ink3} numberOfLines={1} style={{ marginTop: 3 }}>
                  {(seed.category ?? '카드')}{data?.listingCountText ? ` · 매물 ${data.listingCountText}건` : ''}
                </PixelText>
              </View>
              <PixelText variant={txt} size={13} weight="bold" color={tc.ink}>
                {data && data.minPrice > 0 ? `¥${data.minPrice.toLocaleString('ja-JP')}` : '—'}
              </PixelText>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // 캐러셀 — 자동 스크롤 시 카드를 두 벌 이어붙여 끊김 없이 루프.
  const displayRows = autoScroll ? [...rows, ...rows] : rows;
  return (
    <>
      <View style={{ marginHorizontal: 14 }}>
        <SectHd title={title} more="전체보기 →" onMore={() => router.push(moreHref as never)} />
      </View>
      <View
        style={{ marginBottom: 6, overflow: 'hidden' }}
        onTouchStart={pauseMarquee}
        onTouchEnd={resumeMarqueeSoon}
        onTouchCancel={resumeMarqueeSoon}
      >
        <Animated.View style={{ flexDirection: 'row', paddingLeft: 14, transform: [{ translateX: tx }] }}>
        {displayRows.map(({ seed, data }, idx) => {
          const bg = seed.category ? SNKR_CAT_BG[seed.category] : tc.ink2;
          const priceText = data && data.minPrice > 0 ? `¥${data.minPrice.toLocaleString('ja-JP')}` : '—';
          return (
            <View key={`${seed.apparelId}-${idx}`} style={{ width: 112, marginRight: 6 }}>
              <PixelPress
                onPress={() => router.push(`/cards/snkrdunk/${seed.apparelId}` as never)}
                innerStyle={{ ...(flat ? {} : { borderTopWidth: 4, borderTopColor: bg }), height: 222 }}
              >
                <View style={{ flex: 1 }}>
                  <ThumbImage uri={data?.imageUrl} style={{ height: 118 }} emojiSize={28} />
                  <View style={{ padding: 8, flex: 1, ...(flat ? {} : { borderTopColor: tc.ink, borderTopWidth: 3 }) }}>
                    <View style={{ height: 18, marginBottom: 4 }}>
                      {seed.category ? (
                        <View style={{ alignSelf: 'flex-start', backgroundColor: bg, paddingHorizontal: 4, paddingVertical: 2, borderColor: tc.ink, borderWidth: 1 }}>
                          <PixelText variant={txt} size={8} color={tc.white}>{seed.category}</PixelText>
                        </View>
                      ) : null}
                    </View>
                    <PixelText variant={txt} size={11} weight="bold" color={tc.ink} numberOfLines={1} style={{ marginBottom: 4 }}>
                      {seed.shortName}
                    </PixelText>
                    <PixelText variant={txt} size={10} color={tc.red} numberOfLines={1}>
                      {priceText}
                    </PixelText>
                    <PixelText variant={txt} size={8} color={tc.ink3} numberOfLines={1} style={{ marginTop: 'auto' }}>
                      {data?.listingCountText ? `매물 ${data.listingCountText}건` : ' '}
                    </PixelText>
                  </View>
                </View>
              </PixelPress>
            </View>
          );
        })}
        </Animated.View>
      </View>
    </>
  );
}



