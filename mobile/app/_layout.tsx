import { useEffect, useState } from 'react';
import { Slot, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, ActivityIndicator, LogBox } from 'react-native';

// 구 아키텍처에서 react-native-screens 헤더 설정이 던지는 무해한(캐치되는) 예외.
// 헤더를 쓰지 않아(headerShown:false) 기능 영향 없음 — 개발 LogBox 만 소음이라 억제.
// (프로덕션 빌드에는 LogBox 가 없고 예외도 RN 이 잡아서 무시한다.)
// 스크린샷 촬영 세션(마스킹 모드 또는 시작 라우트 지정)에선 개발용 경고
// 토스트("Open debugger…")까지 전부 숨긴다.
if (process.env.EXPO_PUBLIC_SHOT_MODE === '1' || process.env.EXPO_PUBLIC_SHOT_ROUTE) {
  LogBox.ignoreAllLogs(true);
}
LogBox.ignoreLogs([
  /Exception thrown while executing UI block/,
  /Animated node with tag \d+ does not exist/,
  /Error setting property 'color' of RNSScreenStackHeaderConfig/,
]);
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  useFonts as usePressStart2P,
  PressStart2P_400Regular,
} from '@expo-google-fonts/press-start-2p';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { PhoneShell } from '@/components/PhoneShell';
import { ActionTracker } from '@/components/ActionTracker';
import { ChromeProvider } from '@/components/ChromeContext';
import { PriceModeProvider } from '@/lib/priceMode';
import { CurrencyProvider } from '@/components/CurrencyProvider';
import { HomePrefsProvider } from '@/components/HomePrefsProvider';
import { GamePrefsProvider } from '@/components/GamePrefsProvider';
import { NavPrefsProvider } from '@/components/NavPrefsProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/ToastProvider';
import { extractOAuthToken, persistTokenAndGoHome } from '@/lib/oauth';
import { colors } from '@/theme/tokens';

/**
 * OAuth 딥링크 (pokefesta30://auth?token=…) 폴백 처리.
 *
 * 정상 흐름에서는 로그인 화면의 WebBrowser.openAuthSessionAsync 가 리다이렉트를
 * 가로채 토큰을 직접 받는다. 하지만 OS 가 cold-start 로 앱을 pokefesta30://auth
 * 딥링크로 직접 열거나 인증 세션이 리다이렉트를 놓친 경우를 대비해 여기서도
 * 토큰을 잡아 세션 저장 후 홈으로 보낸다.
 */
function useOAuthDeepLink() {
  const handle = (incoming: string | null | undefined) => {
    const token = extractOAuthToken(incoming ?? null);
    if (!token) return;
    try {
      persistTokenAndGoHome(token);
    } catch (e) {
      console.warn('[deeplink] persist token failed', e);
    }
  };

  // 1) reactive useURL — cold-start 초기 URL 및 일부 warm 이벤트.
  const url = Linking.useURL();
  useEffect(() => {
    handle(url);
  }, [url]);

  // 2) addEventListener + getInitialURL — warm 재전달(onNewIntent) 보강.
  // 실제 OAuth 플로우는 브라우저가 앱을 foreground 로 끌어올리는 warm 전달이라
  // useURL() 이 놓치는 경우가 있어 직접 구독한다.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url: u }) => handle(u));
    Linking.getInitialURL().then(handle).catch(() => {});
    return () => sub.remove();
  }, []);
}

// preventAutoHideAsync 를 호출하지 않음 → splash 가 JS 로드되면 자동으로 사라짐.
// 폰트는 백그라운드로 로딩되며, 로딩 전엔 시스템 폰트로 폴백.

export default function RootLayout() {
  useOAuthDeepLink();
  // 스토어 스크린샷 모드 전용 — EXPO_PUBLIC_SHOT_ROUTE 로 시작 화면 지정.
  // (simctl openurl 딥링크는 확인 다이얼로그에 막혀 자동 촬영에 못 쓴다.)
  // 프로덕션 빌드에서는 SHOT_MODE 미설정이라 아무 동작 없음.
  useEffect(() => {
    const route = process.env.EXPO_PUBLIC_SHOT_ROUTE;
    if (route) {
      const t = setTimeout(() => {
        try {
          router.replace(route as never);
        } catch {
          // ignore — 잘못된 라우트면 홈 유지
        }
      }, 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);
  const [pixelLoaded, pixelError] = usePressStart2P({ PressStart2P_400Regular });
  const [koLoaded, koError] = useFonts({
    Galmuri11: require('../assets/fonts/Galmuri11.ttf'),
    Galmuri11_Bold: require('../assets/fonts/Galmuri11-Bold.ttf'),
  });
  const fontsReady = pixelLoaded && koLoaded;
  // 5초 안에 폰트 로딩이 안 끝나면 시스템 폰트로 폴백 (앱이 영원히 스플래시에 갇히지 않도록).
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (fontsReady) return undefined;
    const t = setTimeout(() => {
      console.warn('[RootLayout] font load timed out at 5s — falling back to system fonts');
      setTimedOut(true);
    }, 5000);
    return () => clearTimeout(t);
  }, [fontsReady]);

  const proceed = fontsReady || timedOut || pixelError != null || koError != null;

  // 안전망: 어떤 경우든 마운트 후 splash 강제 숨김.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!proceed) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {/* 렌더 예외를 여기서 잡아 빈 화면 대신 복구 UI 를 보여준다. */}
      <AppErrorBoundary>
      <ThemeProvider>
        <CurrencyProvider>
          <ToastProvider>
            <ChromeProvider>
              <HomePrefsProvider>
              <GamePrefsProvider>
              <NavPrefsProvider>
              <PriceModeProvider>
                <PhoneShell>
                <ActionTracker>
            {/*
             * Stack 으로 전환해 라우트 변경 시 네이티브 슬라이드/페이드 트랜지션 적용.
             * PhoneShell 이 외부에 있으므로 StatusBar / Tabbar 는 고정되고,
             * 페이지 컨텐츠 영역만 애니메이션된다.
             */}
            {/*
             * Slot(일반 View 아울렛) 사용 — react-native-screens 네이티브 스택(Stack)은
             * PhoneShell(StatusBar 밴드+SafeArea) 래퍼와 조합 시 화면 터치 판정이
             * 어긋나 모든 버튼이 눌리지 않는 치명적 문제가 있었다 (iOS 네이티브 빌드).
             * 전환 애니메이션은 잃지만 터치가 100% 보장되는 구조.
             */}
            <Slot />
                </ActionTracker>
                </PhoneShell>
              </PriceModeProvider>
              </NavPrefsProvider>
              </GamePrefsProvider>
              </HomePrefsProvider>
            </ChromeProvider>
          </ToastProvider>
        </CurrencyProvider>
      </ThemeProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.pap2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
