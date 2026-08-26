import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { LoadingState } from '@/components/cv/ListState';
import { MarketListRow } from '@/components/cv/MarketListRow';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant, useInputFont } from '@/components/ThemeProvider';
import { bunjangSearchUrl, fetchBunjangItems, type BunjangItem } from '@/services/marketplace';
import { useListingFavorites, type ListingFavorite } from '@/lib/useListingFavorites';

const DEFAULT_QUERY = '포켓몬카드';
const BUNJANG_WEB = 'https://m.bunjang.co.kr';

/** 라이브 리스트에 없는 관심 매물을 fav 메타만으로 최소 렌더. */
function favToItem(f: ListingFavorite): BunjangItem {
  return {
    pid: f.externalId,
    name: f.title,
    price: f.price ?? 0,
    imageUrl: f.imageUrl,
    location: '',
    favCount: 0,
    updatedAt: 0,
    productUrl: `${BUNJANG_WEB}/products/${f.externalId}`,
  };
}

/** 리스트 항목 → 관심목록 저장 메타. */
function favFromItem(item: BunjangItem): ListingFavorite {
  return {
    source: 'bunjang',
    externalId: item.pid,
    title: item.name,
    imageUrl: item.imageUrl,
    price: item.price,
    url: `/cards/bunjang/${item.pid}`,
  };
}

export default function BunjangScreen() {
  // 클린·다크는 시스템 산세리프 — 인풋/placeholder 가 비트맵 폰트로 남지 않게.
  const inputFont = useInputFont();
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [submitted, setSubmitted] = useState(DEFAULT_QUERY);
  const [items, setItems] = useState<BunjangItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 기본 = 최신순(등록·갱신 시각 내림차순). '관련순' = 번개장터 API 원본 순서.
  const [sort, setSort] = useState<'latest' | 'relevant'>('latest');

  const { isFav, toggle, favorites } = useListingFavorites('bunjang');

  const load = useCallback(async (q: string, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setItems(await fetchBunjangItems(q, 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(submitted);
  }, [load, submitted]);

  // 관심 매물(상단 고정) + 나머지.
  const favIdSet = new Set(favorites.map((f) => f.externalId));
  const liveById = new Map(items.map((it) => [it.pid, it]));
  const pinned = favorites.map((f) => liveById.get(f.externalId) ?? favToItem(f));
  const restRaw = items.filter((it) => !favIdSet.has(it.pid));
  const rest =
    sort === 'latest'
      ? [...restRaw].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      : restRaw;

  const renderRow = (item: BunjangItem) => (
    <MarketRow key={item.pid} item={item} fav={isFav(item.pid)} onToggleFav={() => toggle(favFromItem(item))} />
  );

  const isEmpty = !loading && !error && items.length === 0 && pinned.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="국내마켓" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 110, gap: 6 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(submitted, true)} />}
        keyboardShouldPersistTaps="handled"
      >
        <PixelFrame bg={tc.red} borderWidth={3} shadow={6} hi="rgba(255,255,255,0.18)" lo="rgba(0,0,0,0.36)">
          <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 30 }}>🇰🇷</Text>
            <View style={{ flex: 1 }}>
              <PixelText variant={txt} size={11} color={tc.gold}>
                국내마켓
              </PixelText>
              <PixelText variant="ko" size={10} color={tc.white} style={{ marginTop: 6, lineHeight: 15 }}>
                번개장터 국내 매물을 실시간으로 확인합니다.
              </PixelText>
            </View>
          </View>
        </PixelFrame>

        <PixelFrame bg={tc.white} borderWidth={3} shadow={5}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
            <PixelText variant={txt} size={12} color={tc.ink3}>
              🔍
            </PixelText>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => setSubmitted(query.trim() || DEFAULT_QUERY)}
              returnKeyType="search"
              placeholder="검색어"
              placeholderTextColor={tc.ink4}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 8,
                color: tc.ink,
                fontFamily: inputFont,
                fontSize: 14,
              }}
            />
            <Pressable onPress={() => setSubmitted(query.trim() || DEFAULT_QUERY)}>
              <View style={{ backgroundColor: tc.ink, paddingHorizontal: 9, paddingVertical: 7, borderColor: tc.ink, borderWidth: 1 }}>
                <PixelText variant={txt} size={8} color={tc.gold}>
                  검색
                </PixelText>
              </View>
            </Pressable>
          </View>
        </PixelFrame>

        {pinned.length > 0 && (
          <>
            <PixelText variant={txt} size={9} color={tc.goldDk} style={{ marginTop: 2, letterSpacing: 0.5 }}>
              ★ 관심목록 {pinned.length}
            </PixelText>
            {pinned.map(renderRow)}
            <View style={{ height: 2, backgroundColor: tc.pap3, marginVertical: 2 }} />
          </>
        )}

        {/* 작은 정렬 필터 — 최신순 / 관련순 */}
        {items.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 0, marginBottom: 2 }}>
            {(['latest', 'relevant'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setSort(k)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  backgroundColor: sort === k ? tc.yel : 'transparent',
                  borderColor: tc.ink,
                  borderWidth: sort === k ? 1 : 0,
                }}
              >
                <PixelText variant={txt} size={8} color={sort === k ? tc.ink : tc.ink3}>
                  {k === 'latest' ? '최신순' : '관련순'}
                </PixelText>
              </Pressable>
            ))}
          </View>
        )}

        {rest.map(renderRow)}

        {isEmpty && (
          <View style={{ paddingVertical: 28, alignItems: 'center' }}>
            {loading ? (
              <ActivityIndicator color={tc.ink} />
            ) : (
              <PixelText variant="ko" size={12} color={tc.ink3}>
                {error ? `불러오기 오류: ${error}` : '검색 결과가 없습니다.'}
              </PixelText>
            )}
          </View>
        )}

        {loading && !isEmpty && <LoadingState />}

        {items.length > 0 && (
          <PixelPress onPress={() => Linking.openURL(bunjangSearchUrl(submitted))} bg={tc.ink} borderWidth={3} shadow={5}>
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <PixelText variant={txt} size={9} color={tc.gold}>
                번개장터에서 더 보기
              </PixelText>
            </View>
          </PixelPress>
        )}
      </ScrollView>
    </View>
  );
}

function MarketRow({ item, fav, onToggleFav }: { item: BunjangItem; fav: boolean; onToggleFav: () => void }) {
  const tc = useThemeColors();
  return (
    // 웹 .shop-card 재현: 썸네일 84 + 본문(제목 / 가격 빨강 / 메타). 별은 우상단 오버레이.
    <MarketListRow
      onPress={() => router.push(`/cards/bunjang/${item.pid}`)}
      imageUrl={item.imageUrl}
      title={item.name}
      titlePaddingRight={22}
      priceText={item.price > 0 ? `${item.price.toLocaleString('ko-KR')}원` : '가격문의'}
      metaText={`📍 ${item.location || '지역 미표기'}   ❤ ${item.favCount}`}
      shadow={6}
      rightSlot={
        /* 별 토글 — 우상단 오버레이 (행 onPress 보다 우선) */
        <Pressable onPress={onToggleFav} hitSlop={10} style={{ position: 'absolute', top: 8, right: 8, padding: 4, zIndex: 2 }}>
          <Text style={{ fontSize: 20, lineHeight: 22, color: fav ? tc.gold : tc.ink4 }}>
            {fav ? '★' : '☆'}
          </Text>
        </Pressable>
      }
    />
  );
}
