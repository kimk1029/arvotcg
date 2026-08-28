import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { fetchAllPacksWithHits, type PackWithHits } from '@/lib/myApi';
import { useSWR } from '@/lib/swr';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant, useInputFont } from '@/components/ThemeProvider';
import { shotSource } from '@/lib/shotMode';

type SortMode = 'default' | 'name' | 'price';

export default function PriceInfoScreen() {
  // 클린·다크는 시스템 산세리프 — 인풋/placeholder 가 비트맵 폰트로 남지 않게.
  const inputFont = useInputFont();
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('default');
  // SWR(디스크) — 서버 팩 히트가 DB 캐시라 15분 TTL 로 충분. 재진입/콜드 스타트 즉시.
  const { data, loading, error, refresh } = useSWR<PackWithHits[]>(
    'packs:hits:1',
    () => fetchAllPacksWithHits(1),
    { ttlMs: 15 * 60_000, persist: true },
  );

  const packs = data ?? [];
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = q
      ? packs.filter((p) =>
          [p.name, p.shortName, p.boxKoName, p.boxName, p.code]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : packs;

    if (sort === 'name') rows = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    if (sort === 'price') {
      rows = [...rows].sort((a, b) => packTopPrice(b) - packTopPrice(a));
    }
    return rows;
  }, [packs, query, sort]);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="시세확인" />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginHorizontal: 14, marginTop: 14, marginBottom: 12 }}>
          <PixelFrame bg={tc.white} borderWidth={3} shadow={5} hi={null} lo={null}>
            <View style={{ padding: 14 }}>
              <PixelText variant={txt} size={12} color={tc.ink} style={{ letterSpacing: 0.8 }}>
                카드 박스
              </PixelText>
              <PixelText variant="ko" size={10} color={tc.ink3} style={{ marginTop: 7, lineHeight: 16 }}>
                박스를 선택하면 해당 박스에 포함된 싱글카드 시세를 확인할 수 있습니다.
              </PixelText>
            </View>
          </PixelFrame>
        </View>

        <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
          <PixelFrame bg={tc.white} borderWidth={3} shadow={4}>
            <View style={styles.searchBox}>
              <PixelText variant={txt} size={13} color={tc.ink3}>🔍</PixelText>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="박스명, 팩명 검색..."
                placeholderTextColor={tc.ink4}
                style={[styles.searchInput, { fontFamily: inputFont }]}
              />
            </View>
          </PixelFrame>
        </View>

        <View style={styles.sortRow}>
          {([
            ['default', '최신/추천'],
            ['price', '가격 높은순'],
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
                <View style={styles.sortBtnInner}>
                  <PixelText variant={txt} size={9} color={on ? tc.gold : tc.ink}>
                    {label}
                  </PixelText>
                </View>
              </PixelPress>
            );
          })}
        </View>

        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <View style={{ marginHorizontal: 14, marginTop: 6 }}>
            <ErrorView error={error} onRetry={refresh} />
          </View>
        ) : visible.length === 0 ? (
          <View style={{ marginHorizontal: 14, marginTop: 6 }}>
            <EmptyState icon="📦" title="표시할 박스가 없어요" ctaLabel="다시 불러오기" onCtaPress={refresh} />
          </View>
        ) : (
          <View style={{ marginHorizontal: 14, gap: 10 }}>
            {visible.map((pack) => (
              <PackRow key={pack.code} pack={pack} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PackRow({ pack }: { pack: PackWithHits }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const topPrice = packTopPrice(pack);
  const firstHit = pack.hits[0] ?? null;
  return (
    <PixelPress
      onPress={() => router.push(`/cards/packs/${pack.code}` as never)}
      bg={tc.white}
      borderWidth={3}
      shadow={5}
      hi={null}
      lo={null}
    >
      <View style={styles.packRow}>
        <View style={[styles.thumb, { backgroundColor: pack.bg }]}>
          {pack.boxImageUrl ? (
            <Image source={shotSource(pack.boxImageUrl, 'box')} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: 34 }}>{pack.emoji}</Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText variant="ko" size={12} weight="bold" numberOfLines={1}>
            {pack.name}
          </PixelText>
          <PixelText variant="ko" size={9} color={tc.ink3} style={{ marginTop: 5, lineHeight: 14 }} numberOfLines={2}>
            {pack.boxKoName || pack.boxName || pack.shortName}
          </PixelText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
            <PricePill text={topPrice > 0 ? `대표 ¥${topPrice.toLocaleString('ja-JP')}` : '시세 확인 중'} />
            {pack.releasedAt ? <MetaPill text={`${pack.releasedAt} 출시`} /> : null}
            {firstHit?.listingCountText ? <MetaPill text={`매물 ${firstHit.listingCountText}건`} /> : null}
          </View>
        </View>
        <PixelText variant={txt} size={14} color={tc.ink3}>›</PixelText>
      </View>
    </PixelPress>
  );
}

function PricePill({ text }: { text: string }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={[styles.pill, { backgroundColor: tc.gold }]}>
      <PixelText variant={txt} size={8} color={tc.ink}>{text}</PixelText>
    </View>
  );
}

function MetaPill({ text }: { text: string }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={[styles.pill, { backgroundColor: tc.pap2 }]}>
      <PixelText variant={txt} size={8} color={tc.ink3}>{text}</PixelText>
    </View>
  );
}

function packTopPrice(pack: PackWithHits): number {
  // 대표 시세 = 시세상세 헤드라인(headlinePrice). 미계산 스냅샷이면 최저 매물 폴백.
  return Math.max(0, ...pack.hits.map((h) => (h.headlinePrice > 0 ? h.headlinePrice : h.minPrice) || 0));
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: 'Galmuri11',
    color: colors.ink,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginLeft: 14,
    marginRight: 18,
    marginBottom: 16,
  },
  sortBtnInner: {
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  thumb: {
    width: 84,
    height: 84,
    borderColor: colors.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '108%',
    height: '108%',
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderColor: colors.ink,
    borderWidth: 1,
  },
});
