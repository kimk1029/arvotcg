/**
 * /my/notices — 공지사항. 웹 src/app/my/notices/page.tsx 패리티:
 * GET /api/notices (어드민에서 등록), 태그 배지·고정(📌)·발행일.
 */
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { SectHd } from '@/components/cv/SectHd';
import { LoadingState } from '@/components/cv/ListState';
import { colors } from '@/theme/tokens';
import { useTheme, useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { api } from '@/lib/apiClient';
import { NOTICE_TAG_LABEL, noticeDateLabel, type Notice, type NoticeTag } from '@/lib/notices';

const TAG_STYLE: Record<NoticeTag, { bg: string; fg: string }> = {
  update: { bg: colors.grn, fg: colors.white },
  event: { bg: colors.red, fg: colors.white },
  maintenance: { bg: colors.ink, fg: colors.gold },
};

export default function NoticesScreen() {
  const tc = useThemeColors();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ data: Notice[] }>('/api/notices', { auth: false });
      setNotices(r.data ?? []);
    } catch {
      setNotices([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="공지사항" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {notices === null ? (
          <LoadingState />
        ) : (
          <View style={{ marginHorizontal: 14 }}>
            <SectHd title={`공지사항 · ${notices.length}건`} />
            <View style={{ gap: 10 }}>
              {notices.length === 0 ? (
                <PixelFrame bg={tc.white} borderWidth={2} shadow={3} hi={null} lo={null}>
                  <View style={{ padding: 30, alignItems: 'center' }}>
                    <PixelText variant="ko" size={10} color={tc.ink3}>등록된 공지가 없어요</PixelText>
                  </View>
                </PixelFrame>
              ) : (
                notices.map((n) => <NoticeCard key={n.id} notice={n} />)
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function NoticeCard({ notice }: { notice: Notice }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const flat = isFlatTheme(useTheme().theme);
  const tag = notice.tag ? TAG_STYLE[notice.tag] : null;
  return (
    <PixelFrame bg={tc.white} borderWidth={2} shadow={3} hi={null} lo={null}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          {notice.pinned ? (
            <PixelText variant={txt} size={8} color={tc.ink3}>📌</PixelText>
          ) : null}
          {tag && notice.tag ? (
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: tag.bg, borderColor: tc.ink, borderWidth: flat ? 0 : 1, borderRadius: flat ? 6 : 0 }}>
              <PixelText variant={txt} size={8} color={tag.fg} style={{ letterSpacing: 0.5 }}>{NOTICE_TAG_LABEL[notice.tag]}</PixelText>
            </View>
          ) : null}
          <PixelText variant={txt} size={8} color={tc.ink3} style={{ letterSpacing: 0.3 }}>{noticeDateLabel(notice.publishedAt)}</PixelText>
        </View>
        <PixelText variant="ko" size={12} weight="bold" color={tc.ink} style={{ marginBottom: 8, letterSpacing: 0.5 }}>{notice.title}</PixelText>
        <PixelText variant="ko" size={10} color={tc.ink2} style={{ lineHeight: 18 }}>{notice.body}</PixelText>
      </View>
    </PixelFrame>
  );
}
