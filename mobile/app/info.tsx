import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { useThemeColors } from '@/components/ThemeProvider';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { useFloatNavInset } from '@/components/NavPrefsProvider';
import { api } from '@/lib/apiClient';
import type { InfoPostsPage } from '../../shared/infoPosts';

export default function InfoScreen() {
  const tc = useThemeColors();
  const inset = useFloatNavInset();
  const [data, setData] = useState<InfoPostsPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const busy = useRef(false);
  const requestedPage = useRef(1);
  const controller = useRef<AbortController | null>(null);

  async function load(page: number) {
    if (busy.current) return;
    busy.current = true;
    requestedPage.current = page;
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 15_000);
    setLoading(true);
    setError(null);
    try {
      const next = await api<InfoPostsPage>(`/api/info-posts?page=${page}`, { signal: abort.signal });
      if (!abort.signal.aborted) setData(previous => ({ ...next, posts: page === 1 ? next.posts : [...(previous?.posts ?? []), ...next.posts.filter(p => !previous?.posts.some(old => old.id === p.id))] }));
    } catch (e) {
      setError(e instanceof Error ? e : new Error('글을 불러오지 못했어요.'));
    } finally {
      clearTimeout(timer);
      busy.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void load(1), 0);
    return () => { clearTimeout(timer); controller.current?.abort(); };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="정보 글" onBack={() => router.back()} />
      <FlatList
        data={data?.posts ?? []}
        keyExtractor={item => item.id}
        refreshing={loading && !!data}
        onRefresh={() => void load(1)}
        contentContainerStyle={{ padding: 18, paddingBottom: inset + 30, flexGrow: 1 }}
        ListHeaderComponent={<View style={{ marginBottom: 18, gap: 6 }}><Text style={{ color: tc.ink, fontSize: 20, fontWeight: '800' }}>카드 소식과 가이드</Text><Text style={{ color: tc.ink3, fontSize: 12 }}>규타쿠의 오타쿠 활동로그 · 포켓몬카드</Text></View>}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/web', params: { url: item.url, title: '정보 글' } } as never)} style={({ pressed }) => ({ paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: tc.ink3, opacity: pressed ? 0.6 : 1, gap: 10 })}>
            <Text style={{ color: tc.ink, fontSize: 16, fontWeight: '700', lineHeight: 24 }}>{item.title}</Text>
            <Text style={{ color: tc.ink3, fontSize: 12 }}>{item.date} · 네이버 블로그  ›</Text>
          </Pressable>
        )}
        ListEmptyComponent={loading ? <LoadingState /> : !error ? <EmptyState title="등록된 정보 글이 없어요" /> : null}
        ListFooterComponent={error ? <ErrorView error={error} onRetry={() => void load(requestedPage.current)} /> : data?.hasMore ? <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load(data.page + 1)} style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: tc.ink }}>{loading ? '불러오는 중…' : '글 더 보기'}</Text></Pressable> : null}
      />
    </View>
  );
}
