/**
 * Loading / Error / Empty 상태 컴포넌트.
 * /my/* 모든 리스트 페이지가 공유.
 */
import { View } from 'react-native';
import { router } from 'expo-router';
import { ApiError } from '@/lib/apiClient';
import { isAuthenticated } from '@/lib/session';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { Spinner, useLoadingProgress } from '@/components/Spinner';
import { colors } from '@/theme/tokens';

export function LoadingState() {
  const pct = useLoadingProgress();
  return (
    <View style={{ paddingVertical: 60, alignItems: 'center' }}>
      <Spinner size={48} />
      <PixelText variant="pixel" size={9} color={colors.ink3} style={{ marginTop: 12 }}>
        불러오는 중… {pct}%
      </PixelText>
    </View>
  );
}

interface EmptyProps {
  icon?: string;
  title: string;
  desc?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function EmptyState({ icon = '📭', title, desc, ctaLabel, onCtaPress }: EmptyProps) {
  return (
    <PixelFrame bg={colors.white} borderWidth={2} shadow={3} hi={null} lo={null}>
      <View style={{ paddingVertical: 30, paddingHorizontal: 20, alignItems: 'center', gap: 10 }}>
        <PixelText variant="pixel" size={28} color={colors.ink}>{icon}</PixelText>
        <PixelText variant="ko" size={11} color={colors.ink} weight="bold">{title}</PixelText>
        {desc ? (
          <PixelText variant="ko" size={9} color={colors.ink3} style={{ textAlign: 'center', lineHeight: 16 }}>
            {desc}
          </PixelText>
        ) : null}
        {ctaLabel && onCtaPress ? (
          <View style={{ marginTop: 8 }}>
            <PixelPress onPress={onCtaPress} bg={colors.gold} hi={colors.goldLt} lo={colors.goldDk} shadow={4}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                <PixelText variant="pixel" size={10} color={colors.ink}>{ctaLabel}</PixelText>
              </View>
            </PixelPress>
          </View>
        ) : null}
      </View>
    </PixelFrame>
  );
}

interface ErrorProps {
  error: Error;
  onRetry: () => void;
}

export function ErrorView({ error, onRetry }: ErrorProps) {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 401) {
    return (
      <EmptyState
        icon="🔐"
        title="로그인이 필요해요"
        desc="이 메뉴는 로그인 후 이용할 수 있습니다."
        ctaLabel="로그인 하러 가기"
        onCtaPress={() => router.push('/login' as never)}
      />
    );
  }
  if (status === 0) {
    return (
      <EmptyState
        icon="📡"
        title="서버에 연결할 수 없어요"
        desc="네트워크 연결을 확인하거나 잠시 후 다시 시도해 주세요."
        ctaLabel="다시 시도"
        onCtaPress={onRetry}
      />
    );
  }
  return (
    <EmptyState
      icon="⚠️"
      title="불러오기에 실패했어요"
      desc={error.message ?? '잠시 후 다시 시도해 주세요.'}
      ctaLabel="다시 시도"
      onCtaPress={onRetry}
    />
  );
}

/** auth 상태 체크 + ErrorView 합쳐서 분기 — 페이지에서 더 짧게 쓸 수 있게. */
export function RequireAuthEmpty({ title, message, callbackPath }: { title: string; message: string; callbackPath?: string }) {
  if (isAuthenticated()) return null;
  return (
    <EmptyState
      icon="🔐"
      title={title}
      desc={message}
      ctaLabel="로그인 하러 가기"
      onCtaPress={() => router.push(callbackPath ? `/login?callback=${callbackPath}` : ('/login' as never))}
    />
  );
}
