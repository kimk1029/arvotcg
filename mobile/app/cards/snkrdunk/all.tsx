import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { Chip } from '@/components/cv/Chip';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { useTheme, useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { fetchSnkrdunkBrowse, type SnkrdunkSearchResult } from '@/services/snkrdunk';
import { jaToKoBatch, jaToKoCached } from '@/lib/cardLang';

type SortKey = 'default' | 'priceDesc' | 'priceAsc' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  default: '기본',
  priceDesc: '가격↓',
  priceAsc: '가격↑',
  name: '이름',
};

const SORT_KEYS: SortKey[] = ['default', 'priceDesc', 'priceAsc', 'name'];

function parsePrice(text: string): number {
  if (!text) return 0;
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function shortenName(name: string): string {
  const cut = name.split(/[|｜]/)[0].trim();
  return cut.length > 40 ? cut.slice(0, 39) + '…' : cut;
}

export default function SnkrdunkAll() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { theme } = useTheme();
  // 클린·다크(플랫) — 픽셀 크롬(굵은 잉크 보더) 대신 소프트 구분선/보더리스 썸네일.
  const flat = isFlatTheme(theme);
  const [items, setItems] = useState<SnkrdunkSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const seenRef = useRef<Set<number>>(new Set());

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchSnkrdunkBrowse(p);
      // 표시명 일→한 — 서버 공통 엔진 배치 선번역(캐시), 렌더는 jaToKoCached 조회.
      await jaToKoBatch(results.map((r) => r.name)).catch(() => undefined);
      const fresh = results.filter((r) => !seenRef.current.has(r.apparelId));
      fresh.forEach((r) => seenRef.current.add(r.apparelId));
      if (fresh.length === 0) {
        setDone(true);
      } else {
        setItems((prev) => [...prev, ...fresh]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const onEndReached = useCallback(() => {
    if (loading || done) return;
    const next = page + 1;
    setPage(next);
    loadPage(next);
  }, [loading, done, page, loadPage]);

  const sortedItems = useMemo(() => {
    if (sortKey === 'default') return items;
    const copy = items.slice();
    if (sortKey === 'priceDesc') {
      copy.sort((a, b) => parsePrice(b.priceText) - parsePrice(a.priceText));
    } else if (sortKey === 'priceAsc') {
      copy.sort((a, b) => {
        const ap = parsePrice(a.priceText);
        const bp = parsePrice(b.priceText);
        // 가격 0(미상) 항목은 뒤로
        if (ap === 0 && bp !== 0) return 1;
        if (bp === 0 && ap !== 0) return -1;
        return ap - bp;
      });
    } else if (sortKey === 'name') {
      copy.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    }
    return copy;
  }, [items, sortKey]);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="스니덩크 전체 시세" />

      {/* Sort chips */}
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 8,
          backgroundColor: tc.paper,
          borderBottomWidth: flat ? 1 : 3,
          borderBottomColor: flat ? tc.pap3 : tc.ink,
        }}
      >
        {SORT_KEYS.map((k) => {
          const on = sortKey === k;
          return (
            <Chip
              key={k}
              on={on}
              onPress={() => setSortKey(k)}
              bg={on ? tc.ink : tc.white}
              fg={on ? tc.gold : tc.ink}
              size={9}
              px={10}
              py={5}
            >
              {SORT_LABELS[k]}
            </Chip>
          );
        })}
      </View>

      <FlatList
        data={sortedItems}
        keyExtractor={(it) => String(it.apparelId)}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: tc.pap3, marginHorizontal: 14 }} />
        )}
        ListFooterComponent={
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            {error ? (
              <Pressable onPress={() => loadPage(page)}>
                <PixelText variant={txt} size={9} color={tc.red}>
                  불러오기 오류: {error} · 재시도
                </PixelText>
              </Pressable>
            ) : loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color={tc.ink3} />
                <PixelText variant={txt} size={9} color={tc.ink3}>
                  불러오는 중…
                </PixelText>
              </View>
            ) : done ? (
              <PixelText variant={txt} size={9} color={tc.ink3}>
                {sortedItems.length === 0 ? '결과가 없습니다.' : '— 끝 —'}
              </PixelText>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => router.push(`/cards/snkrdunk/${item.apparelId}` as never)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 10,
              paddingHorizontal: 14,
              backgroundColor: pressed ? tc.pap2 : 'transparent',
            })}
          >
            <View
              style={{
                width: 22,
                alignItems: 'center',
              }}
            >
              <PixelText variant={txt} size={9} color={tc.ink3}>
                {String(index + 1).padStart(2, '0')}
              </PixelText>
            </View>
            {/* 썸네일 — 보더 없이 +50% 확대 (2026-08-09), 플랫은 라운드. */}
            <ThumbImage
              uri={item.imageUrl}
              size={66}
              emojiSize={26}
              style={{ marginLeft: 6, marginRight: 10, borderRadius: flat ? 10 : 0 }}
            />
            <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
              <PixelText
                variant="ko"
                size={10}
                weight="bold"
                numberOfLines={2}
                style={{ lineHeight: 13 }}
              >
                {shortenName(jaToKoCached(item.name))}
              </PixelText>
              <PixelText
                variant={txt}
                size={7}
                color={tc.ink3}
                numberOfLines={1}
                style={{ marginTop: 2 }}
              >
                {shortenName(item.name)}
              </PixelText>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
              <PixelText variant={txt} size={11} color={tc.red} numberOfLines={1}>
                {item.priceText || '—'}
              </PixelText>
              <PixelText variant={txt} size={8} color={tc.ink3} style={{ marginTop: 3 }}>
                ▶
              </PixelText>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
