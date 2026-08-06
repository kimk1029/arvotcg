import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { SectHd } from '@/components/cv/SectHd';
import { colors } from '@/theme/tokens';
import { useTheme, useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';

interface Notice {
  id: string;
  date: string;
  title: string;
  tag?: 'update' | 'event' | 'maintenance';
  body: string;
}

const NOTICES: Notice[] = [
  {
    id: 'n-2026-04-20',
    date: '2026.04.20',
    title: '아르보TCG 서비스 오픈',
    tag: 'event',
    body: '아르보TCG 웹 서비스가 정식 오픈했습니다. 현장 혼잡도 제보·거래·스탬프 랠리·오리파 모두 이용 가능합니다.',
  },
  {
    id: 'n-2026-04-15',
    date: '2026.04.15',
    title: '스탬프 6곳 주소 확정 안내',
    tag: 'update',
    body: '성수 일대 6개 포켓스탑 정식 주소가 확정되어 "실제 지도" 탭에 반영되었습니다. 각 지점 정보 참고하세요.',
  },
];

const TAG_STYLE: Record<NonNullable<Notice['tag']>, { bg: string; fg: string; label: string }> = {
  update: { bg: colors.grn, fg: colors.white, label: 'UPDATE' },
  event: { bg: colors.red, fg: colors.white, label: 'EVENT' },
  maintenance: { bg: colors.ink, fg: colors.gold, label: '점검' },
};

export default function NoticesScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="공지사항" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }}>
        <View style={{ marginHorizontal: 14 }}>
          <SectHd title={`공지사항 · ${NOTICES.length}건`} />
          <View style={{ gap: 10 }}>
            {NOTICES.length === 0 ? (
              <PixelFrame bg={tc.white} borderWidth={2} shadow={3} hi={null} lo={null}>
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <PixelText variant="ko" size={10} color={tc.ink3}>등록된 공지가 없어요</PixelText>
                </View>
              </PixelFrame>
            ) : (
              NOTICES.map((n) => <NoticeCard key={n.id} notice={n} />)
            )}
          </View>
        </View>
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
          {tag ? (
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: tag.bg, borderColor: tc.ink, borderWidth: flat ? 0 : 1, borderRadius: flat ? 6 : 0 }}>
              <PixelText variant={txt} size={8} color={tag.fg} style={{ letterSpacing: 0.5 }}>{tag.label}</PixelText>
            </View>
          ) : null}
          <PixelText variant={txt} size={8} color={tc.ink3} style={{ letterSpacing: 0.3 }}>{notice.date}</PixelText>
        </View>
        <PixelText variant="ko" size={12} weight="bold" color={tc.ink} style={{ marginBottom: 8, letterSpacing: 0.5 }}>{notice.title}</PixelText>
        <PixelText variant="ko" size={10} color={tc.ink2} style={{ lineHeight: 18 }}>{notice.body}</PixelText>
      </View>
    </PixelFrame>
  );
}
