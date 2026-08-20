/**
 * /my/favorites — 관심카드 (서버 동기).
 *
 * /api/me/favorites/with-prices 에서 스니덩크 image/name/¥ 시세 enriched 행을
 * 가져와 그리드로 표시. 항목 제거 시 DELETE /api/me/favorites/:apparelId.
 * 통화 모드 (jpy/krw) 에 맞춰 가격 자동 변환.
 */
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { SnkrdunkCardTile } from '@/components/cv/SnkrdunkCardTile';
import { InlineLoginGate } from '@/components/InlineLoginGate';
import { useCurrency } from '@/components/CurrencyProvider';
import { useToast } from '@/components/ToastProvider';
import { space } from '@/theme/tokens';
import { useTheme, useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import {
  fetchMyFavorites,
  removeFavorite,
  type MyFavoriteRow,
} from '@/lib/myApi';
import { useSWR } from '@/lib/swr';
import { isAuthenticated, subscribeSession } from '@/lib/session';

function useAuthed(): boolean {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  useEffect(() => subscribeSession(() => setAuthed(isAuthenticated())), []);
  return authed;
}

export default function FavoritesScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const flat = isFlatTheme(useTheme().theme);
  const authed = useAuthed();
  const { format } = useCurrency();
  const toast = useToast();

  // SWR — 재진입 즉시 페인트(디스크 캐시) + TTL 내 재조회 생략.
  const { data, loading, error, refresh } = useSWR<MyFavoriteRow[]>('me:favorites', fetchMyFavorites, {
    persist: true,
    enabled: authed,
    deps: [authed],
  });

  if (!authed) {
    return (
      <InlineLoginGate
        title="관심카드"
        feature="관심카드"
        description="관심 표시한 카드를 한눈에 보고, 시세 변동을 추적해보세요."
        icon="⭐"
      />
    );
  }

  const rows = data ?? [];
  const totalJpy = rows.reduce((s, r) => s + r.minPriceJpy, 0);

  const onRemove = (apparelId: number) => {
    Alert.alert('관심카드 제거', '이 카드를 관심카드에서 제거할까요?', [
      { text: '취소' },
      {
        text: '제거',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFavorite(apparelId);
            toast.success('관심카드에서 제거되었습니다');
            refresh();
          } catch {
            toast.error('제거 실패');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="관심카드" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {loading && !data ? (
          <View style={{ paddingTop: 30 }}><LoadingState /></View>
        ) : error ? (
          <View style={{ marginHorizontal: 14, marginTop: 14 }}>
            <ErrorView error={error} onRetry={refresh} />
          </View>
        ) : rows.length === 0 ? (
          <View style={{ marginHorizontal: 14, marginTop: 30 }}>
            <EmptyState
              icon="⭐"
              title="관심카드가 없어요"
              desc="시세 상세 페이지의 [관심카드] 버튼으로 추가하세요."
              ctaLabel="가격 탐색"
              onCtaPress={() => router.push('/cards/packs' as never)}
            />
          </View>
        ) : (
          <>
            {/* 요약 — 포트폴리오 합계에는 포함되지 않음을 명시 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: tc.ink2, padding: 14, marginHorizontal: 14, marginTop: 14, marginBottom: 12, borderWidth: flat ? 0 : 3, borderColor: tc.ink, borderRadius: flat ? 14 : 0 }}>
              <Text style={{ fontSize: 36 }}>⭐</Text>
              <View style={{ flex: 1 }}>
                <PixelText variant="ko" size={13} weight="bold" color={tc.white}>
                  관심 카드 {rows.length}장
                </PixelText>
                <PixelText
                  variant={txt}
                  size={9}
                  color="rgba(255,255,255,0.65)"
                  style={{ marginTop: 6, lineHeight: 14 }}
                >
                  합산 시세 {format(totalJpy)}
                </PixelText>
                <PixelText variant="ko" size={9} color={tc.gold} style={{ marginTop: 4, opacity: 0.85 }}>
                  ※ 포트폴리오 가치에는 포함되지 않습니다
                </PixelText>
              </View>
            </View>

            {/* 그리드 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gap, gap: 8 }}>
              {rows.map((r) => (
                <View key={r.id} style={{ width: '31%', backgroundColor: tc.white, borderWidth: flat ? 1 : 3, borderColor: flat ? tc.pap3 : tc.ink, borderRadius: flat ? 12 : 0, overflow: 'hidden', marginBottom: 8 }}>
                  <SnkrdunkCardTile
                    plainPress
                    onPress={() => router.push(`/cards/snkrdunk/${r.snkrdunkApparelId}` as never)}
                    imageUrl={r.imageUrl}
                    koName={r.name ?? '(이름 없음)'}
                    priceText={r.minPriceJpy > 0 ? format(r.minPriceJpy) : null}
                    priceChip
                    thumbAspect={63 / 88}
                    nameSize={10}
                    nameBold={false}
                    infoPadding={7}
                    emojiSize={29}
                  />
                  <Pressable onPress={() => onRemove(r.snkrdunkApparelId)} style={{ paddingVertical: 5, alignItems: 'center', borderTopWidth: flat ? 1 : 2, borderTopColor: flat ? tc.pap3 : tc.ink }}>
                    <PixelText variant={txt} size={9} color={tc.red}>✕ 제거</PixelText>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

