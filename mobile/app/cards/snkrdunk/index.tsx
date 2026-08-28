/**
 * /cards/snkrdunk — 스니덩크 시세 랜딩. 웹 src/app/cards/snkrdunk/page.tsx 패리티:
 * 검색바 + HOT 카드 목록 + 전체 보기(/cards/snkrdunk/all) 링크.
 * 목록은 홈 HOT 캐러셀 공유 스토어(homeHotStore)를 그대로 재사용해 같은 항목·순서로
 * 즉시 뜬다(진입 속도 개선). 홈을 안 거치면 browse 상단 10종 폴백.
 * 스파크라인 차트는 목록이 뜬 뒤 점진 로드. ('SNKRDUNK 일본시세' 배너는 2026-08-09 제거.)
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { LoadingState } from '@/components/cv/ListState';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { fonts, space } from '@/theme/tokens';
import { useTheme, useThemeColors, useThemeTextVariant, useInputFont } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import {
  downsamplePricePoints,
  fetchSnkrdunkApparel,
  fetchSnkrdunkBrowse,
  fetchSnkrdunkSalesChart,
  fetchSnkrdunkSalesHistory,
  searchSnkrdunkByQuery,
  SNKRDUNK_FEATURED_CARDS,
  type SnkrdunkApparel,
  type SnkrdunkSalesChart,
  type SnkrdunkSearchResult,
} from '@/services/snkrdunk';
import { jaToKoBatch, jaToKoCached } from '@/lib/cardLang';
import { getHomeHotRows } from '@/lib/homeHotStore';
import { SNKRDUNK_GAME_KEYWORD } from '../../../../shared/gameKeyword';
import { headlineFromHistory } from '../../../../shared/snkrdunkPrice';

type Category = 'SAR' | '프로모' | 'SR' | '원피스';

interface DisplaySeed {
  apparelId: number;
  shortName: string;
  localizedName?: string;
  category: Category | null;
}

interface CardRow {
  seed: DisplaySeed;
  apparel: SnkrdunkApparel | null;
  chart: SnkrdunkSalesChart | null;
  /** 대표 시세(시세상세 헤드라인) + 기준. 없으면 minPrice(최저 매물) 폴백 표시. */
  price?: number;
  basis?: string;
}

const FEATURED_BY_ID = new Map(SNKRDUNK_FEATURED_CARDS.map((s) => [s.apparelId, s]));

function fmtYen(n: number): string {
  if (!n) return '—';
  return `¥${n.toLocaleString('ja-JP')}`;
}

/** 웹 inferCategory 동일. */
function inferCategory(name: string): Category | null {
  if (/プロモ|PROMO/i.test(name)) return '프로모';
  if (/\bSAR\b/.test(name)) return 'SAR';
  if (/\bSR\b/.test(name)) return 'SR';
  return null;
}

/** 웹 shortenName 동일. */
function shortenName(name: string): string {
  const cut = name.split(/[|｜]/)[0].trim();
  return cut.length > 28 ? cut.slice(0, 27) + '…' : cut;
}

function searchToSeed(r: SnkrdunkSearchResult): DisplaySeed {
  const jp = shortenName(r.name);
  const curated = FEATURED_BY_ID.get(r.apparelId);
  if (curated) {
    return { apparelId: r.apparelId, shortName: curated.shortName, localizedName: jp, category: curated.category };
  }
  return {
    apparelId: r.apparelId,
    shortName: shortenName(jaToKoCached(r.name)),
    localizedName: jp,
    category: inferCategory(r.name),
  };
}

export default function SnkrdunkLanding() {
  // 클린·다크는 시스템 산세리프 — 인풋/placeholder 가 비트맵 폰트로 남지 않게.
  const inputFont = useInputFont();
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { theme } = useTheme();
  const flat = isFlatTheme(theme);
  // 홈에서 선택한 게임(IP) — ?game= 으로 넘어온다. 전체보기에도 그대로 실어 보낸다.
  const { game: gameParam } = useLocalSearchParams<{ game?: string }>();
  const game = typeof gameParam === 'string' && gameParam ? gameParam : 'pokemon';
  const [rows, setRows] = useState<CardRow[] | null>(null);
  const [q, setQ] = useState('');

  const CATEGORY_BG: Record<Category, string> = useMemo(
    () => ({ SAR: '#E8842C', 프로모: tc.pur, SR: tc.red, 원피스: tc.grnDk }),
    [tc],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      // 홈 HOT 캐러셀 공유 스토어 우선 — 같은 게임(IP)일 때만 재사용해 같은 항목·순서로 즉시 표시.
      const stored = getHomeHotRows();
      let base: CardRow[];
      if (stored && stored.game === game) {
        base = stored.rows.map((r) => ({
          seed: {
            apparelId: r.apparelId,
            shortName: r.shortName,
            localizedName: r.localizedName,
            category: null,
          },
          apparel: {
            id: r.apparelId,
            name: r.localizedName ?? r.shortName,
            localizedName: r.localizedName ?? '',
            imageUrl: r.imageUrl,
            itemKind: 'single',
            minPrice: r.minPrice,
            regularPrice: 0,
            displayPrice: '',
            listingCount: 0,
            listingCountText: r.listingCountText ?? '',
            releasedAt: null,
            productNumber: '',
          } as SnkrdunkApparel,
          chart: null,
          price: r.recentPrice,
        }));
      } else {
        // 폴백 — 홈을 안 거친 직접 진입/다른 게임 요청: 해당 게임 상단 10종 (웹 동일).
        let seeds: DisplaySeed[];
        try {
          const kw = SNKRDUNK_GAME_KEYWORD[game];
          const pool = kw ? await searchSnkrdunkByQuery(kw) : await fetchSnkrdunkBrowse(1);
          // 일→한 표시명 — 서버 공통 엔진 배치 선번역(캐시).
          await jaToKoBatch(pool.slice(0, 10).map((r) => r.name)).catch(() => undefined);
          seeds =
            pool.length > 0
              ? pool.slice(0, 10).map(searchToSeed)
              : SNKRDUNK_FEATURED_CARDS.slice(0, 10).map((s) => ({ apparelId: s.apparelId, shortName: s.shortName, category: s.category }));
        } catch {
          seeds = SNKRDUNK_FEATURED_CARDS.slice(0, 10).map((s) => ({ apparelId: s.apparelId, shortName: s.shortName, category: s.category }));
        }
        base = await Promise.all(
          seeds.map(async (seed) => ({
            seed,
            apparel: await fetchSnkrdunkApparel(seed.apparelId).catch(() => null),
            chart: null as SnkrdunkSalesChart | null,
          })),
        );
      }
      if (!alive) return;
      setRows(base);
      // 스파크라인 차트 — 목록이 뜬 뒤 점진 로드 (진입을 막지 않음).
      base.forEach(async (row) => {
        const [chart, hist] = await Promise.all([
          fetchSnkrdunkSalesChart(row.seed.apparelId).catch(() => null),
          row.price ? Promise.resolve(null) : fetchSnkrdunkSalesHistory(row.seed.apparelId).catch(() => null),
        ]);
        if (!alive) return;
        // 대표 시세 — 시세상세 헤드라인과 같은 계산(shared headlineFromHistory).
        const head = hist ? headlineFromHistory(hist.history, row.apparel?.minPrice ?? 0) : null;
        setRows((prev) =>
          prev
            ? prev.map((r) =>
                r.seed.apparelId === row.seed.apparelId
                  ? { ...r, chart: chart ?? r.chart, price: head && head.price > 0 ? head.price : r.price, basis: head?.basis ?? r.basis }
                  : r,
              )
            : prev,
        );
      });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  const goSearch = () => {
    const t = q.trim();
    if (!t) return;
    router.push(`/cards/snkrdunk/search?q=${encodeURIComponent(t)}` as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="스니덩크 시세" />
      <ScrollView contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* 검색바 */}
        <View style={{ marginHorizontal: space.gap, marginBottom: 14 }}>
          <PixelFrame bg={tc.white} shadow={5} inner={3}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
              <PixelText variant={txt} size={13}>🔍</PixelText>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="카드 검색 (예: 카드명·세트코드)"
                placeholderTextColor={tc.ink3}
                style={{ flex: 1, fontFamily: inputFont, fontSize: 14, color: tc.ink, paddingVertical: 11 }}
                onSubmitEditing={goSearch}
                returnKeyType="search"
              />
              <Pressable onPress={goSearch} hitSlop={8}>
                <PixelText variant={txt} size={12} color={tc.blu}>▶</PixelText>
              </Pressable>
            </View>
          </PixelFrame>
        </View>

        {/* HOT 카드 — 홈 캐러셀과 동일 목록 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: space.gap, marginBottom: 10 }}>
          <PixelText variant="ko" size={14} weight="bold" color={tc.ink}>HOT 카드</PixelText>
          <Pressable
            onPress={() => router.push(`/cards/snkrdunk/all${game !== 'pokemon' ? `?game=${game}` : ''}` as never)}
            hitSlop={6}
          >
            <PixelText variant={txt} size={10} color={tc.blu}>전체 보기 ▶</PixelText>
          </Pressable>
        </View>

        {rows === null ? (
          <View style={{ paddingTop: 20 }}><LoadingState /></View>
        ) : (
          <View style={{ marginHorizontal: space.gap, gap: 8 }}>
            {rows.map(({ seed, apparel, chart, price, basis }) => {
              const pts = downsamplePricePoints([...(chart?.points ?? [])].sort((a, b) => a[0] - b[0]));
              return (
                <PixelPress
                  key={seed.apparelId}
                  onPress={() => router.push(`/cards/snkrdunk/${seed.apparelId}` as never)}
                  bg={tc.white}
                  borderWidth={3}
                  shadow={5}
                  inner={3}
                >
                  <View style={{ flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' }}>
                    {/* 썸네일 — 보더 없이 +50% 확대 (2026-08-09), 플랫은 라운드. */}
                    <ThumbImage uri={apparel?.imageUrl} style={{ width: 84, height: 117, borderRadius: flat ? 10 : 0 }} emojiSize={30} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {seed.category ? (
                        <View style={{ alignSelf: 'flex-start', backgroundColor: CATEGORY_BG[seed.category], paddingHorizontal: 6, paddingVertical: 2 }}>
                          <PixelText variant={txt} size={7} color={tc.white}>{seed.category}</PixelText>
                        </View>
                      ) : null}
                      <PixelText variant="ko" size={12} weight="bold" color={tc.ink} numberOfLines={2} style={{ marginTop: 4, lineHeight: 17 }}>
                        {seed.shortName}
                      </PixelText>
                      {seed.localizedName && seed.localizedName !== seed.shortName ? (
                        <PixelText variant={txt} size={8} color={tc.ink3} numberOfLines={1} style={{ marginTop: 3 }}>
                          {seed.localizedName}
                        </PixelText>
                      ) : null}
                      <PixelText variant={txt} size={11} weight="bold" color={tc.red} style={{ marginTop: 5 }}>
                        {price && price > 0 ? `${basis ? basis + ' ' : ''}${fmtYen(price)}` : `최저 ${fmtYen(apparel?.minPrice ?? 0)}`}
                      </PixelText>
                    </View>
                    <Sparkline points={pts} tc={tc} txt={txt} />
                  </View>
                </PixelPress>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** 추천 카드 우측 미니 스파크라인 — 웹 landing Sparkline 동일. */
function Sparkline({ points, tc, txt }: { points: Array<[number, number]>; tc: ReturnType<typeof useThemeColors>; txt: 'pixel' | 'ko' }) {
  const width = 90;
  const height = 34;
  if (points.length < 2) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center', backgroundColor: tc.pap2 }}>
        <PixelText variant={txt} size={7} color={tc.ink3}>이력 부족</PixelText>
      </View>
    );
  }
  const ys = points.map((p) => p[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const yOf = (v: number) => height - ((v - min) / range) * height;
  const d = ys.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  const trendUp = ys[ys.length - 1] >= ys[0];
  const color = trendUp ? tc.red : tc.blu;
  return (
    <View style={{ backgroundColor: tc.pap2 }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={(points.length - 1) * stepX} cy={yOf(ys[ys.length - 1])} r={2.2} fill={color} />
      </Svg>
    </View>
  );
}
