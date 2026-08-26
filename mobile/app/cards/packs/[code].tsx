/**
 * /cards/packs/[code] — 팩별 힛카드 풀 그리드 + 리스트 뷰 전환.
 */
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { SnkrdunkCardTile } from '@/components/cv/SnkrdunkCardTile';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { useThemeColors, useThemeTextVariant, useTheme } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { fetchPackHits, type PackHitCard, type PackWithHits } from '@/lib/myApi';
import { filterRarityOf, rarityMetaOf, resolveRarityGame, sortRarityIds, type RarityId } from '@/lib/cardRarity';
import { useSWR } from '@/lib/swr';
import { useCurrency } from '@/components/CurrencyProvider';

type SortMode = 'price' | 'recent' | 'listing' | 'name';
type ViewMode = 'grid' | 'list';

const SORT_OPTIONS: Array<{ key: SortMode; label: string }> = [
  { key: 'price', label: '가격 높은순' },
  { key: 'recent', label: '최근 거래순' },
  { key: 'listing', label: '매물 많은순' },
  { key: 'name', label: '이름순' },
];

/**
 * 목록에 표시할 시세 — 시세상세 헤드라인과 같은 대표 시세(거래 많은 등급의 최근 체결가).
 * 아직 계산 전이면 최저 매물 호가로 폴백한다. (웹 PackMarketSections 와 동일 규칙)
 */
function priceOf(hit: PackHitCard): number {
  return hit.headlinePrice > 0 ? hit.headlinePrice : hit.minPrice;
}

function priceLabel(hit: PackHitCard): string {
  if (hit.headlinePrice > 0) return `${hit.headlineBasis ?? 'RAW'} 최근 체결가`;
  return hit.minPrice > 0 ? '최저매물 호가' : '매물 없음';
}

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
  const [sortOpen, setSortOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('grid');
  // 빈 배열 = 전체. 등급(레어도)은 상품명에서 뽑는다 (shared/cardRarity 단일 소스).
  // 다중 선택 — 'SAR + UR' 처럼 여러 등급을 함께 볼 수 있다(웹 동일).
  const [selected, setSelected] = useState<RarityId[]>([]);
  // SWR — 팩 상세 재진입 즉시 페인트. fetchPackHits 자체 캐시(15분)와 같은 TTL.
  const { data, loading, error, refresh } = useSWR<PackWithHits | null>(
    `packs:detail:${code}`,
    // 웹 packs/[code]/page.tsx 와 동일한 호출 (limit=600).
    () => fetchPackHits(code, 600),
    { ttlMs: 15 * 60_000 },
  );
  // 웹 packs/[code]/page.tsx 동일 — itemKind 로 싱글/박스 분리.
  const singles = useMemo(() => (data?.hits ?? []).filter((h) => h.itemKind !== 'box'), [data?.hits]);
  const boxes = useMemo(() => (data?.hits ?? []).filter((h) => h.itemKind === 'box'), [data?.hits]);
  // 등급 사다리는 게임마다 다르다 — 카탈로그 우선, 없으면 카드명에서 추론(웹 packs/[code] 동일).
  const game = useMemo(
    () => resolveRarityGame(code, singles.map((h) => h.name)),
    [code, singles],
  );
  // 웹 PackMarketSections 동일 — 카드별 등급 + 등급별 개수(이 팩에 있는 고등급만, 높은 등급 먼저).
  const { rarityOf, rarityCounts } = useMemo(() => {
    const map = new Map<number, RarityId>();
    const counts = new Map<RarityId, number>();
    for (const hit of singles) {
      const id = filterRarityOf(game, hit.name, hit.koName);
      if (!id) continue;
      map.set(hit.apparelId, id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return {
      rarityOf: map,
      rarityCounts: sortRarityIds(game, [...counts.keys()]).map((id) => ({
        id,
        count: counts.get(id) ?? 0,
      })),
    };
  }, [singles, game]);
  const visibleSingles = useMemo(() => {
    if (selected.length === 0) return singles;
    return singles.filter((h) => {
      const id = rarityOf.get(h.apparelId);
      return !!id && selected.includes(id);
    });
  }, [singles, rarityOf, selected]);
  const toggleRarity = (id: RarityId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const cards = useMemo(() => sortHits(visibleSingles, sort), [visibleSingles, sort]);
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
                    {selected.length > 0 ? ` · ${selected.join('+')} ${visibleSingles.length}장` : ''}
                  </PixelText>
                </View>
              </View>
            </View>
          </View>

          {/* Sort 셀렉트 + 뷰 토글 — 웹 PackMarketSections 의 <select> 대응(작은 셀렉트박스),
              뷰 전환은 아이콘만 있는 단일 세그먼트 컨테이너(줄바꿈 없음). */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginHorizontal: 14,
              marginBottom: 14,
            }}
          >
            <Pressable
              onPress={() => setSortOpen(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                height: 32,
                paddingHorizontal: 10,
                backgroundColor: tc.white,
                borderWidth: 1,
                borderColor: flat ? tc.pap3 : tc.ink,
                borderRadius: flat ? 8 : 0,
              }}
            >
              <PixelText variant={txt} size={9} color={tc.ink}>
                {SORT_OPTIONS.find((o) => o.key === sort)?.label ?? '정렬'}
              </PixelText>
              <PixelText variant={txt} size={7} color={tc.ink3}>▼</PixelText>
            </Pressable>

            <View style={{ flex: 1 }} />

            <View
              style={{
                flexDirection: 'row',
                padding: 2,
                gap: 2,
                backgroundColor: flat ? tc.pap2 : tc.white,
                borderWidth: 1,
                borderColor: flat ? tc.pap3 : tc.ink,
                borderRadius: flat ? 8 : 0,
              }}
            >
              {([
                ['grid', '⊞'],
                ['list', '☰'],
              ] as const).map(([key, icon]) => {
                const on = view === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setView(key)}
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 4,
                      backgroundColor: on ? (flat ? tc.white : tc.ink) : 'transparent',
                      borderRadius: flat ? 6 : 0,
                    }}
                  >
                    <PixelText variant={txt} size={13} color={on ? (flat ? tc.ink : tc.gold) : tc.ink3}>
                      {icon}
                    </PixelText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 정렬 드롭다운 메뉴 */}
          <Modal transparent visible={sortOpen} animationType="fade" onRequestClose={() => setSortOpen(false)}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
              onPress={() => setSortOpen(false)}
            >
              <View
                style={{
                  marginTop: 160,
                  marginLeft: 14,
                  alignSelf: 'flex-start',
                  minWidth: 150,
                  backgroundColor: tc.white,
                  borderWidth: 1,
                  borderColor: flat ? tc.pap3 : tc.ink,
                  borderRadius: flat ? 12 : 0,
                  overflow: 'hidden',
                }}
              >
                {SORT_OPTIONS.map((o) => {
                  const on = sort === o.key;
                  return (
                    <Pressable
                      key={o.key}
                      onPress={() => {
                        setSort(o.key);
                        setSortOpen(false);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 11,
                        backgroundColor: on ? (flat ? tc.pap2 : tc.gold) : 'transparent',
                      }}
                    >
                      <PixelText variant={txt} size={10} weight={on ? 'bold' : 'normal'} color={tc.ink}>
                        {o.label}
                      </PixelText>
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          </Modal>

          {/* 등급 필터 칩 — 작은 라벨, 누르면 그 등급 카드만. 웹 PackMarketSections 의 RarityChips 대응.
              가로 ScrollView 는 안드로이드 Fabric 에서 높이가 NaN 이 되는 이슈가 있어 flexWrap 행으로. */}
          {rarityCounts.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                marginHorizontal: 14,
                marginBottom: 12,
              }}
            >
              <RarityChip
                label="전체"
                count={singles.length}
                on={selected.length === 0}
                flat={flat}
                onPress={() => setSelected([])}
              />
              {rarityCounts.map((opt) => {
                const meta = rarityMetaOf(opt.id);
                return (
                  <RarityChip
                    key={opt.id}
                    label={meta.label}
                    name={meta.name}
                    count={opt.count}
                    color={meta.bg}
                    textOn={meta.fg}
                    on={selected.includes(opt.id)}
                    flat={flat}
                    onPress={() => toggleRarity(opt.id)}
                  />
                );
              })}
            </View>
          ) : null}

          {/* Body */}
          <View style={{ marginHorizontal: 14 }}>
            {data.hits.length === 0 ? (
              <EmptyState icon="📭" title="매물 정보를 가져오지 못했어요" ctaLabel="다시 시도" onCtaPress={refresh} />
            ) : cards.length === 0 ? (
              <EmptyState icon="🔍" title={`${selected.join('+')} 등급 카드가 없어요`} ctaLabel="전체 보기" onCtaPress={() => setSelected([])} />
            ) : view === 'grid' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {cards.map((hit) => (
                  <View key={hit.apparelId} style={{ width: '32%' }}>
                    <SnkrdunkCardTile
                      onPress={() => router.push(`/cards/snkrdunk/${hit.apparelId}` as never)}
                      imageUrl={hit.imageUrl}
                      koName={hit.koName || hit.shortName}
                      subName={hit.name}
                      priceText={priceOf(hit) > 0 ? formatCurrency(priceOf(hit)) : null}
                      metaText={priceLabel(hit)}
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
                  <ListRow key={hit.apparelId} hit={hit} />
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
                    <ListRow key={hit.apparelId} hit={hit} />
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

/**
 * 등급 필터 칩 — 작은 라벨 + 개수. 여러 개를 눌러 함께 볼 수 있다(웹 RarityChips 대응).
 * 선택 = 등급색(RARITY_META) 그대로, 비선택 = 무채색으로 죽여 비활성처럼 보이게.
 */
function RarityChip({
  label,
  name,
  count,
  color,
  textOn,
  on,
  flat,
  onPress,
}: {
  label: string;
  name?: string;
  count: number;
  /** 등급색 — '전체' 칩은 없음(무채색 고정). */
  color?: string;
  textOn?: string;
  on: boolean;
  flat: boolean;
  onPress: () => void;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const bg = on ? (color ?? (flat ? tc.ink : tc.gold)) : tc.pap2;
  const fg = on ? (color ? (textOn ?? tc.white) : flat ? tc.white : tc.ink) : tc.ink3;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name ? `${label} ${name} ${count}개` : `${label} ${count}개`}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: on ? (flat ? bg : tc.ink) : flat ? tc.pap3 : tc.ink,
        borderRadius: flat ? 999 : 0,
      }}
    >
      <PixelText variant={txt} size={9} weight={on ? 'bold' : 'normal'} color={fg}>
        {label}
      </PixelText>
      <PixelText variant={txt} size={8} color={fg} style={{ opacity: 0.62 }}>
        {count}
      </PixelText>
    </Pressable>
  );
}

function ListRow({ hit }: { hit: PackHitCard }) {
  const { format: formatCurrency } = useCurrency();
  return (
    <SnkrdunkCardTile
      variant="row"
      onPress={() => router.push(`/cards/snkrdunk/${hit.apparelId}` as never)}
      imageUrl={hit.imageUrl}
      koName={hit.koName || hit.shortName}
      subName={hit.name}
      priceText={priceOf(hit) > 0 ? formatCurrency(priceOf(hit)) : null}
      metaText={priceLabel(hit)}
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
