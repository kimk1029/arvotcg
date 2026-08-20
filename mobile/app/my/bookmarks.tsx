import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { SectHd } from '@/components/cv/SectHd';
import { MyFeedRow, MyTradeRow } from '@/components/cv/MyRows';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { fetchMyBookmarks } from '@/lib/myApi';
import { useSWR } from '@/lib/swr';

export default function BookmarksScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { data, loading, error, refresh } = useSWR('me:bookmarks', fetchMyBookmarks);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="찜한 글" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }}>
        <View style={{ marginHorizontal: 14, gap: 14 }}>
          {loading && !data ? (
            <LoadingState />
          ) : error ? (
            <ErrorView error={error} onRetry={refresh} />
          ) : !data || (data.trades.length === 0 && data.feeds.length === 0) ? (
            <EmptyState
              icon="🔖"
              title="아직 찜한 글이 없어요"
              desc="거래글·피드를 둘러보다가 마음에 드는 글에 찜 버튼을 눌러보세요."
              ctaLabel="거래 둘러보기"
              onCtaPress={() => router.push('/trade' as never)}
            />
          ) : (
            <>
              {data.trades.length > 0 ? (
                <View>
                  <SectHd title={`찜한 거래글 · ${data.trades.length}건`} />
                  <View style={{ gap: 8 }}>
                    {data.trades.map((t) => (
                      <MyTradeRow key={`t-${t.id}`} trade={t} />
                    ))}
                  </View>
                </View>
              ) : null}
              {data.feeds.length > 0 ? (
                <View>
                  <SectHd title={`찜한 피드 · ${data.feeds.length}건`} />
                  <View style={{ gap: 8 }}>
                    {data.feeds.map((p) => (
                      <MyFeedRow key={`f-${p.id}`} post={p} />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
