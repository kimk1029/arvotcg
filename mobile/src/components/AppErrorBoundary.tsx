/**
 * 앱 최상위 에러 경계.
 *
 * RN 은 렌더 중 던져진 예외를 잡아 주지 않는다 — 릴리즈 빌드에서는 그대로
 * 빈 화면(또는 강제 종료)이 되고 사용자는 앱이 죽었다고 느낀다. 여기서 잡아
 * "다시 시도" 를 주면 최소한 홈으로 돌아올 수 있다.
 *
 * 개발 중에는 원래 에러를 그대로 콘솔에 남겨 디버깅을 방해하지 않는다.
 */
import { Component, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { colors } from '@/theme/tokens';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // 릴리즈 빌드에서도 adb logcat 으로 원인을 볼 수 있게 남긴다.
    console.error('[AppErrorBoundary]', error?.message, info?.componentStack ?? '');
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center', padding: 24 }}>
        <PixelText variant="ko" size={15} weight="bold" color={colors.ink} style={{ marginBottom: 10 }}>
          문제가 발생했어요
        </PixelText>
        <PixelText variant="ko" size={11} color={colors.ink3} style={{ lineHeight: 18, marginBottom: 16 }}>
          화면을 그리는 중 오류가 생겼습니다. 다시 시도해도 같은 화면이 나오면 앱을 껐다 켜 주세요.
        </PixelText>
        <ScrollView style={{ maxHeight: 140, marginBottom: 18 }}>
          <PixelText variant="pixel" size={9} color={colors.ink3}>
            {String(error?.message ?? error)}
          </PixelText>
        </ScrollView>
        <Pressable
          onPress={this.reset}
          style={{
            paddingVertical: 13,
            alignItems: 'center',
            backgroundColor: colors.gold,
            borderWidth: 2,
            borderColor: colors.ink,
          }}
        >
          <PixelText variant="ko" size={12} weight="bold" color={colors.ink}>다시 시도</PixelText>
        </Pressable>
      </View>
    );
  }
}
