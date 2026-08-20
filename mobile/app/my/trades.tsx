import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { SectHd } from '@/components/cv/SectHd';
import { MyTradeRow } from '@/components/cv/MyRows';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { fetchMyTrades } from '@/lib/myApi';
import { useSWR } from '@/lib/swr';

export default function MyTradesScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { data, loading, error, refresh } = useSWR('me:trades', fetchMyTrades);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="내가 쓴 거래글" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }}>
        <View style={{ marginHorizontal: 14 }}>
          {loading && !data ? (
            <LoadingState />
          ) : error ? (
            <ErrorView error={error} onRetry={refresh} />
          ) : !data || data.length === 0 ? (
            <EmptyState
              icon="🛒"
              title="아직 작성한 거래글이 없어요"
              desc="거래글을 작성하면 +10P, 거래가 성사되면 +50P 가 적립됩니다."
              ctaLabel="거래글 작성"
              onCtaPress={() => router.push('/write/trade' as never)}
            />
          ) : (
            <>
              <SectHd title={`내 거래 · ${data.length}건`} />
              <View style={{ gap: 8 }}>
                {data.map((t) => (
                  <MyTradeRow key={t.id} trade={t} />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
