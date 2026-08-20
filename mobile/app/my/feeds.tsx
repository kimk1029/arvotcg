import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { SectHd } from '@/components/cv/SectHd';
import { MyFeedRow } from '@/components/cv/MyRows';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { fetchMyFeeds } from '@/lib/myApi';
import { useSWR } from '@/lib/swr';

export default function MyFeedsScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { data, loading, error, refresh } = useSWR('me:feeds', fetchMyFeeds);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="내 피드" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }}>
        <View style={{ marginHorizontal: 14 }}>
          {loading && !data ? (
            <LoadingState />
          ) : error ? (
            <ErrorView error={error} onRetry={refresh} />
          ) : !data || data.length === 0 ? (
            <EmptyState
              icon="📝"
              title="아직 작성한 피드가 없어요"
              desc="첫 번째 글을 남겨보세요. 글을 쓰면 +10P 가 적립됩니다."
              ctaLabel="피드 글쓰기"
              onCtaPress={() => router.push('/write/feed' as never)}
            />
          ) : (
            <>
              <SectHd title={`내 피드 · ${data.length}건`} />
              <View style={{ gap: 8 }}>
                {data.map((p) => (
                  <MyFeedRow key={p.id} post={p} />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
