/**
 * /events — 이벤트 게시판 목록. 웹 src/app/events/page.tsx 패리티:
 * GET /api/events, 진행상태(진행중/예정/상시/종료)·말머리·공지 배지,
 * 고정(📌)·기간 라벨·댓글 수, 로그인 시 작성(✍) 버튼.
 */
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { LoadingState } from '@/components/cv/ListState';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { api } from '@/lib/apiClient';
import { isAuthenticated } from '@/lib/session';
import { shotSource } from '@/lib/shotMode';
import {
  EVENT_CATEGORY_STYLE,
  EVENT_STATUS_LABEL,
  eventPeriodLabel,
  eventStatus,
  type EventPost,
} from '@/lib/events';

export default function EventsList() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const [posts, setPosts] = useState<EventPost[] | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ data: EventPost[] }>('/api/events', { auth: false });
      setPosts(r.data ?? []);
    } catch {
      setPosts([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar
        title="이벤트"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push((isAuthenticated() ? '/events/write' : '/login') as never)}
            hitSlop={8}
          >
            <PixelText variant={txt} size={14}>✍</PixelText>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: space.gap, gap: 14, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {posts === null ? (
          <View style={{ paddingTop: 30 }}><LoadingState /></View>
        ) : posts.length === 0 ? (
          <PixelFrame bg={tc.white} shadow={4} inner={3}>
            <View style={{ paddingVertical: 36, alignItems: 'center' }}>
              <PixelText variant="ko" size={12} color={tc.ink3}>진행 중인 이벤트가 없어요</PixelText>
            </View>
          </PixelFrame>
        ) : (
          posts.map((p) => <EventCard key={p.id} p={p} tc={tc} txt={txt} />)
        )}
      </ScrollView>
    </View>
  );
}

function EventCard({ p, tc, txt }: { p: EventPost; tc: ReturnType<typeof useThemeColors>; txt: 'pixel' | 'ko' }) {
  const status = eventStatus(p);
  const ended = status === 'ended';
  const cat = p.category ? EVENT_CATEGORY_STYLE[p.category] : null;
  return (
    <Pressable onPress={() => router.push(`/events/${p.id}` as never)} style={{ opacity: ended ? 0.65 : 1 }}>
      <PixelFrame bg={tc.white} shadow={5} inner={3}>
        <View>
          {p.imageUrl ? (
            <Image
              source={shotSource(p.imageUrl)}
              style={{ width: '100%', aspectRatio: 2, backgroundColor: tc.pap2 }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ padding: 13, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {p.pinned ? <PixelText variant={txt} size={9} weight="bold" color={tc.red}>📌 고정</PixelText> : null}
              {status !== 'always' ? (
                <View style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: status === 'ongoing' ? tc.red : tc.pap2 }}>
                  <PixelText variant={txt} size={8} weight="bold" color={status === 'ongoing' ? tc.white : status === 'ended' ? tc.ink3 : tc.ink}>
                    {EVENT_STATUS_LABEL[status]}
                  </PixelText>
                </View>
              ) : null}
              {p.category ? (
                <View style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: cat?.background ?? tc.pap2 }}>
                  <PixelText variant={txt} size={8} weight="bold" color={cat?.color ?? tc.ink}>{p.category}</PixelText>
                </View>
              ) : null}
              {!p.authorName ? (
                <View style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: tc.ink }}>
                  <PixelText variant={txt} size={8} weight="bold" color={tc.white}>공지</PixelText>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              <PixelText variant={txt} size={8} color={tc.ink3}>
                {p.authorName ? `✍ ${p.authorName} · ` : ''}{eventPeriodLabel(p) ? `${eventPeriodLabel(p)} · ` : ''}💬 {p.commentCount}
              </PixelText>
            </View>
            <PixelText variant="ko" size={13} weight="bold" color={tc.ink} style={{ lineHeight: 19 }}>
              {p.title}
            </PixelText>
            {p.body ? (
              <PixelText variant="ko" size={10} color={tc.ink3} numberOfLines={2} style={{ lineHeight: 15 }}>
                {p.body}
              </PixelText>
            ) : null}
          </View>
        </View>
      </PixelFrame>
    </Pressable>
  );
}
