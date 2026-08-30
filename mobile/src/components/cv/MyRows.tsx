/**
 * /my/* 리스트용 행 컴포넌트.
 * 웹 src/components/{FeedRow, TradeCard} 와 동일한 정보 밀도.
 * 픽셀 테마는 잉크 테두리 사각, 클린·다크(플랫)는 무테 라운드.
 */
import { View, Image, Pressable } from 'react-native';
import { router } from 'expo-router';
import { PixelText } from '@/components/PixelText';
import { PixelPress } from '@/components/cv/PixelPress';
import { useTheme, useThemeColors } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import type { MyFeedPost, MyTrade } from '@/lib/myApi';
import { shotSource } from '@/lib/shotMode';

interface FeedRowProps {
  post: MyFeedPost;
  onPress?: () => void;
  onDelete?: () => void;
}

export function MyFeedRow({ post, onPress, onDelete }: FeedRowProps) {
  const tc = useThemeColors();
  const flat = isFlatTheme(useTheme().theme);
  return (
    <PixelPress
      onPress={onPress ?? (() => router.push(`/feed` as never))}
      bg={tc.white}
      borderWidth={2}
      shadow={3}
      hi={null}
      lo={null}
      inner={0}
    >
      <View style={{ flexDirection: 'row', padding: 12, gap: 10 }}>
        <View style={{ width: 36, height: 36, borderWidth: flat ? 0 : 2, borderColor: tc.ink, borderRadius: flat ? 10 : 0, backgroundColor: tc.pap2, alignItems: 'center', justifyContent: 'center' }}>
          <PixelText variant="pixel" size={16} color={tc.ink}>{post.user || '🐣'}</PixelText>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <PixelText variant="pixel" size={flat ? 11 : 9} color={tc.ink}>🗣 커뮤니티</PixelText>
            <PixelText variant="pixel" size={flat ? 10 : 8} color={tc.ink3}>{post.time}</PixelText>
          </View>
          {post.authorName ? (
            <PixelText variant="ko" size={9} color={tc.ink3} style={{ marginTop: 2 }} numberOfLines={1}>
              {post.authorName}
            </PixelText>
          ) : null}
          <PixelText variant="ko" size={11} color={tc.ink} style={{ marginTop: 6, lineHeight: 18 }} numberOfLines={3}>
            {post.text}
          </PixelText>
          {post.images && post.images.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
              {post.images.slice(0, 3).map((src, i) => (
                <Image key={i} source={shotSource(src)} style={{ width: 56, height: 56, borderWidth: flat ? 0 : 1, borderColor: tc.ink, borderRadius: flat ? 8 : 0 }} />
              ))}
            </View>
          ) : null}
          {onDelete ? (
            <Pressable onPress={onDelete} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 10, paddingVertical: 5, paddingHorizontal: 8 }}>
              <PixelText variant="ko" size={11} color={tc.red} weight="bold">게시물 삭제</PixelText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </PixelPress>
  );
}

interface TradeRowProps {
  trade: MyTrade;
  onPress?: () => void;
}

export function MyTradeRow({ trade, onPress }: TradeRowProps) {
  const tc = useThemeColors();
  const flat = isFlatTheme(useTheme().theme);
  const typeLabel: Record<MyTrade['type'], { bg: string; fg: string; label: string }> = {
    buy: { bg: tc.blu, fg: tc.white, label: '삽니다' },
    sell: { bg: tc.red, fg: tc.white, label: '팝니다' },
  };
  const statusLabel: Partial<Record<NonNullable<MyTrade['status']>, { bg: string; fg: string; label: string }>> = {
    reserved: { bg: tc.yel, fg: tc.ink, label: '예약중' },
    done: { bg: tc.ink3, fg: tc.white, label: '거래완료' },
    cancelled: { bg: tc.ink3, fg: tc.white, label: '취소' },
  };
  const t = typeLabel[trade.type];
  const s = trade.status ? statusLabel[trade.status] : null;
  const dim = trade.status === 'done' || trade.status === 'cancelled';
  const chip = { paddingHorizontal: 7, paddingVertical: 2, borderColor: tc.ink, borderWidth: flat ? 0 : 1, borderRadius: flat ? 6 : 0 } as const;
  return (
    <PixelPress
      onPress={onPress ?? (() => router.push(`/trade` as never))}
      bg={tc.white}
      borderWidth={2}
      shadow={3}
      hi={null}
      lo={null}
      inner={0}
    >
      <View style={{ padding: 12, opacity: dim ? 0.55 : 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <View style={[chip, { backgroundColor: t.bg }]}>
            <PixelText variant="pixel" size={flat ? 10 : 8} color={t.fg}>{t.label}</PixelText>
          </View>
          {s ? (
            <View style={[chip, { backgroundColor: s.bg }]}>
              <PixelText variant="pixel" size={flat ? 10 : 8} color={s.fg}>{s.label}</PixelText>
            </View>
          ) : null}
          {trade.place ? (
            <PixelText variant="pixel" size={flat ? 10 : 8} color={tc.ink3}>· {trade.place}</PixelText>
          ) : null}
          <View style={{ flex: 1 }} />
          <PixelText variant="pixel" size={flat ? 10 : 8} color={tc.ink3}>{trade.time}</PixelText>
        </View>
        <PixelText variant="ko" size={12} color={tc.ink} weight="bold" numberOfLines={2}>
          {trade.title}
        </PixelText>
        <PixelText variant="pixel" size={flat ? 12 : 10} color={tc.red} weight="bold" style={{ marginTop: 6, letterSpacing: flat ? 0 : 0.5 }}>
          {formatPrice(trade.price)}
        </PixelText>
      </View>
    </PixelPress>
  );
}

function formatPrice(raw: string): string {
  if (!raw) return '제안';
  const n = Number(raw.replace(/,/g, ''));
  if (Number.isFinite(n) && n > 0) return `₩${n.toLocaleString('ko-KR')}`;
  return raw;
}
