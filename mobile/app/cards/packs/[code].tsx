/**
 * /cards/packs/[code] — 팩별 힛카드 풀 그리드 + 리스트 뷰 전환.
 */
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelPress } from '@/components/cv/PixelPress';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { SnkrdunkCardTile } from '@/components/cv/SnkrdunkCardTile';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { useThemeColors, useThemeTextVariant, useTheme } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { fetchPackHits, type PackHitCard, type PackWithHits } from '@/lib/myApi';
import { useAsync } from '@/lib/useAsync';
import { useCurrency } from '@/components/CurrencyProvider';

type SortMode = 'price' | 'recent' | 'listing' | 'name';
type ViewMode = 'grid' | 'list';

export default function PackDetailScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  // 클린·다크(플랫) — 웹 clean 디자인셋과 동일하게 픽셀 보더/직각을 라운드+소프트로.
  const { theme } = useTheme();
  const flat = isFlatTheme(theme);
  const { format: formatCurrency } = useCurrency();
  const params = useLocalSearchParams<{ code: string }>();
  const code = params.code ?? '';
  const [sort, setSort] = useState<SortMode>('price');
  const [view, setView] = useState<ViewMode>('grid');
  const { data, loading, error, refresh } = useAsync<PackWithHits | null>(
    // 웹 packs/[code]/page.tsx 와 동일한 호출 (limit=600).
    () => fetchPackHits(code, 600),
    [code],
  );
  // 웹 packs/[code]/page.tsx 동일 — itemKind 로 싱글/박스 분리.
  const singles = useMemo(() => (data?.hits ?? []).filter((h) => h.itemKind !== 'box'), [data?.hits]);
  const boxes = useMemo(() => (data?.hits ?? []).filter((h) => h.itemKind === 'box'), [data?.hits]);
  const cards = useMemo(() => sortHits(singles, sort), [singles, sort]);
  const sortedBoxes = useMemo(() => sortHits(boxes, 'price'), [boxes]);

  return (
    <View style={{ flex: 1, backgroundColor: tc.bg }}>
      <AppBar onBack={() => router.back()} title={data?.shortName ?? '카드팩'} />
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <View style={{ margin: 14 }}>
          <ErrorView error={error} onRetry={refresh} />
        </View>
      ) : !data ? (
        <View style={{ margin: 14 }}>
          <EmptyState icon="📦" title="팩을 찾지 못했어요" desc={`code=${code}`} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
          {/* Pack header — 박스 이미지 + 정보. 플랫은 웹 clean 디자인셋(라운드 --r=18, ink 보더 없음). */}
          <View style={{ marginHorizontal: 14, marginTop: 14, marginBottom: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'stretch',
                gap: 12,
                padding: 12,
                backgroundColor: data.bg,
                borderColor: tc.ink,
                borderWidth: flat ? 0 : 3,
                borderRadius: flat ? 18 : 0,
              }}
            >
              {/* 박스 대표 이미지 — 플랫은 라운드(--r-sm=14) + 보더 없음 */}
              <ThumbImage
                uri={data.boxImageUrl}
                size={110}
                bg="rgba(0,0,0,0.18)"
                borderColor={flat ? undefined : tc.ink}
                style={flat ? { borderRadius: 14 } : undefined}
                emoji={data.emoji}
                emojiSize={48}
              />
              {/* 정보 */}
              <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between', paddingVertical: 2 }}>
                <View>
                  <PixelText
                    variant="ko"
                    size={13}
                    weight="bold"
                    color={tc.white}
                    style={{ letterSpacing: 0.5 }}
                    numberOfLines={2}
                  >
                    {data.name}
                  </PixelText>
                  {data.boxKoName ? (
                    <PixelText
                      variant="ko"
                      size={10}
                      color={tc.white}
                      style={{ marginTop: 4, opacity: 0.85, lineHeight: 14 }}
                      numberOfLines={2}
                    >
                      {data.boxKoName}
                    </PixelText>
                  ) : null}
                </View>
                <View style={{ gap: 4 }}>
                  {data.releasedAt ? (
                    <PixelText variant={txt} size={8} color={tc.white} style={{ opacity: 0.85, letterSpacing: 0.3 }} numberOfLines={1}>
                      📅 {data.releasedAt} 출시
                    </PixelText>
                  ) : null}
                  <PixelText variant={txt} size={8} color={tc.white} style={{ opacity: 0.85, letterSpacing: 0.3 }} numberOfLines={1}>
                    🎴 가격 있는 카드 {data.hits.length}장
                  </PixelText>
                </View>
              </View>
            </View>
          </View>

          {/* Sort + view toggle */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 4,
              marginLeft: 14,
              marginRight: 18,
              marginBottom: 14,
              alignItems: 'center',
            }}
          >
            {([
              ['price', '가격 높은순'],
              ['recent', '최근 거래순'],
              ['listing', '매물 많은순'],
              ['name', '이름순'],
            ] as const).map(([key, label]) => {
              const on = sort === key;
              return (
                <PixelPress
                  key={key}
                  onPress={() => setSort(key)}
                  bg={on ? tc.ink : tc.white}
                  borderWidth={3}
                  shadow={4}
                  hi={on ? null : 'rgba(255,255,255,0.95)'}
                  lo={on ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.32)'}
                  inner={3}
                >
                  <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                    {/* 픽셀=골드 온 텍스트, 플랫=웹 clean .chip.on(흰 글씨) */}
                    <PixelText variant={txt} size={9} color={on ? (flat ? tc.paper : tc.gold) : tc.ink}>
                      {label}
                    </PixelText>
                  </View>
                </PixelPress>
              );
            })}

            <View style={{ flex: 1 }} />

            {([
              ['grid', '⊞'],
              ['list', '☰'],
            ] as const).map(([key, icon]) => {
              const on = view === key;
              return (
                <PixelPress
                  key={key}
                  onPress={() => setView(key)}
                  bg={on ? tc.ink : tc.white}
                  borderWidth={3}
                  shadow={4}
                  hi={on ? null : 'rgba(255,255,255,0.95)'}
                  lo={on ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.32)'}
                  inner={3}
                >
                  <View style={{ paddingHorizontal: 9, paddingVertical: 6 }}>
                    <PixelText variant={txt} size={14} color={on ? (flat ? tc.paper : tc.gold) : tc.ink}>
                      {icon}
                    </PixelText>
                  </View>
                </PixelPress>
              );
            })}
          </View>

          {/* Body */}
          <View style={{ marginHorizontal: 14 }}>
            {data.hits.length === 0 ? (
              <EmptyState icon="📭" title="매물 정보를 가져오지 못했어요" ctaLabel="다시 시도" onCtaPress={refresh} />
            ) : view === 'grid' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {cards.map((hit) => (
                  <View key={hit.apparelId} style={{ width: '32%' }}>
                    <SnkrdunkCardTile
                      onPress={() => router.push(`/cards/snkrdunk/${hit.apparelId}` as never)}
                      accentColor={data.bg}
                      imageUrl={hit.imageUrl}
                      koName={hit.koName || hit.shortName}
                      subName={hit.name}
                      priceText={hit.minPrice > 0 ? formatCurrency(hit.minPrice) : null}
                      metaText={hit.listingCountText ? `매물 ${hit.listingCountText}건` : '매물 없음'}
                      nameMinHeight={30}
                      nameLineHeight={15}
                      thumbResizeMethod="resize"
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {cards.map((hit) => (
                  <ListRow key={hit.apparelId} hit={hit} accent={data.bg} />
                ))}
              </View>
            )}

            {/* 박스/팩 섹션 — 웹 PackMarketSections 동일(가격순 고정) */}
            {sortedBoxes.length > 0 ? (
              <View style={{ marginTop: 18 }}>
                <PixelText variant="ko" size={13} weight="bold" color={tc.ink} style={{ marginBottom: 8 }}>
                  📦 박스 · 팩 {sortedBoxes.length}
                </PixelText>
                <View style={{ gap: 8 }}>
                  {sortedBoxes.map((hit) => (
                    <ListRow key={hit.apparelId} hit={hit} accent={data.bg} />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function ListRow({ hit, accent }: { hit: PackHitCard; accent: string }) {
  const { format: formatCurrency } = useCurrency();
  return (
    <SnkrdunkCardTile
      variant="row"
      onPress={() => router.push(`/cards/snkrdunk/${hit.apparelId}` as never)}
      accentColor={accent}
      imageUrl={hit.imageUrl}
      koName={hit.koName || hit.shortName}
      subName={hit.name}
      priceText={hit.minPrice > 0 ? formatCurrency(hit.minPrice) : null}
      metaText={hit.listingCountText ? `매물 ${hit.listingCountText}건` : '매물 없음'}
      thumbResizeMethod="resize"
    />
  );
}

function sortHits<T extends { minPrice: number; listingCount: number; koName?: string; shortName: string; lastSaleSort?: number }>(
  hits: T[],
  sort: SortMode,
): T[] {
  if (sort === 'recent') return [...hits].sort((a, b) => (b.lastSaleSort ?? 0) - (a.lastSaleSort ?? 0) || (b.minPrice || 0) - (a.minPrice || 0));
  if (sort === 'listing') return [...hits].sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0));
  if (sort === 'name') return [...hits].sort((a, b) => (a.koName || a.shortName).localeCompare(b.koName || b.shortName, 'ko'));
  return [...hits].sort((a, b) => (b.minPrice || 0) - (a.minPrice || 0));
}
