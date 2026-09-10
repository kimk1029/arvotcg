import { useState } from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { StatusBar as SystemStatusBar } from 'expo-status-bar';
import { colors } from '@/theme/tokens';
import { StatusBar } from './StatusBar';
import { Tabbar } from './Tabbar';
import { useChrome } from './ChromeContext';
import { useThemeColors, useTheme } from './ThemeProvider';
import { useNavPrefs } from './NavPrefsProvider';
import { AdBanner } from './AdBanner';
import { isFlatTheme } from '@/lib/theme';

interface Props {
  children: React.ReactNode;
}

/** 로그인·카드쇼 화면의 고정 배경(테마 무관) — 해당 화면의 backgroundColor 와 같은 값. */
const DARK_CHROME_BG = '#0F172A';

/**
 * Phone shell — wraps every screen with status bar + content + tabbar.
 * Login is a fullscreen overlay that hides status/tabbar.
 */
export function PhoneShell({ children }: Props) {
  const pathname = usePathname();
  // 배너 실제 높이 — 플로팅 탭바를 이만큼 위로 올려 배너를 가리지 않게 한다.
  const [adHeight, setAdHeight] = useState(0);
  const { hidden } = useChrome();
  const { theme } = useTheme();
  const { navStyle } = useNavPrefs();
  const floating = navStyle === 'floating';
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  // 로그인/OAuth WebView/온보딩은 전체화면 — status/tabbar 숨김.
  const isLogin = pathname?.startsWith('/login') || pathname?.startsWith('/oauth');
  const isOnboarding = pathname?.startsWith('/onboarding') ?? false;
  const isFullscreen = isLogin || isOnboarding || hidden;
  // 테마와 무관하게 항상 어두운 배경인 화면(로그인·카드쇼 WebView·카메라 스캔) — 시스템
  // 상태바 글자를 흰색으로. 그 외에는 테마 페이퍼색 기준(다크 테마 → 흰 글자, 라이트 → 검정).
  // OS 상태바 스타일을 정하는 곳은 여기 한 군데뿐이다 — 개별 화면에서 StatusBar 를 두지 말 것.
  // 예약형 이벤트 WebView(카드쇼·트레이드 데이)는 웹 페이지가 어두운 배경이라 항상 다크 크롬.
  const isDarkChrome = pathname?.startsWith('/event/') ?? false;
  const forceLightBar = pathname?.startsWith('/login') || isDarkChrome || hidden;
  // 온보딩은 테마 무관 흰 배경 → 상태바 글자 검정.
  const systemBarStyle: 'light' | 'dark' = isOnboarding ? 'dark' : forceLightBar || theme === 'dark' ? 'light' : 'dark';
  const shellPaper = isDarkChrome ? DARK_CHROME_BG : isOnboarding ? '#ffffff' : c.paper;
  // 클린·다크(모던 플랫) 테마는 픽셀 골드 상단 밴드를 쓰지 않는다 — 각 화면이
  // 자체 헤더를 갖고, SafeArea top 인셋만 페이퍼색으로 남긴다.
  const showStatusBand = !isFullscreen && !isFlatTheme(theme);
  // 광고 배너 — 홈만 제외하고 모든 화면 하단에 붙인다(로그인·온보딩 등 전체화면 제외).
  // 화면마다 넣지 않고 여기 한 곳에서만 그린다.
  const isHome = pathname === '/' || pathname === '/index';
  const showAd = !isFullscreen && !isHome;
  return (
    <View style={[styles.root, { backgroundColor: c.pap2 }]}>
      <SystemStatusBar style={systemBarStyle} animated />
      <SafeAreaView
        style={[
          styles.shell,
          {
            backgroundColor: shellPaper,
            ...(Platform.OS === 'web'
              ? {
                  borderColor: c.ink,
                  shadowColor: theme === 'onepiece' ? c.ornDk : c.ink,
                }
              : {}),
          },
        ]}
        edges={isFullscreen ? [] : floating ? ['top'] : ['top', 'bottom']}
      >
        {showStatusBand ? <StatusBar /> : null}
        <View style={styles.screen}>{children}</View>
        {/* 광고 배너는 플로우에 자리를 차지한다 — 컨텐츠를 덮지 않으므로 화면마다
            하단 여백을 손볼 필요가 없다. 광고가 없으면(홈·구 바이너리) 높이 0. */}
        {showAd ? (
          <View
            style={{ backgroundColor: c.pap2, paddingBottom: floating ? insets.bottom : 0 }}
            onLayout={(e) => setAdHeight(e.nativeEvent.layout.height)}
          >
            <AdBanner marginVertical={0} />
          </View>
        ) : null}
        {/* 플로팅: 탭바를 절대배치 오버레이로 띄워 컨텐츠가 바 뒤로 지나가게 한다.
            배너가 있으면 그 높이만큼 위로 올려 탭바가 배너를 덮지 않게 한다.
            통합형: 기존처럼 플로우에 차지(컨텐츠와 안 겹침). */}
        {!isFullscreen ? (
          floating ? (
            <View
              style={[
                styles.floatDock,
                adHeight > 0 ? { bottom: adHeight } : { paddingBottom: insets.bottom },
              ]}
              pointerEvents="box-none"
            >
              <Tabbar />
            </View>
          ) : (
            <Tabbar />
          )
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pap2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 414 : undefined,
    backgroundColor: colors.paper,
    ...(Platform.OS === 'web'
      ? {
          borderWidth: 6,
          borderColor: colors.ink,
          shadowColor: colors.ink,
          shadowOffset: { width: 10, height: 10 },
          shadowOpacity: 1,
          shadowRadius: 0,
        }
      : {}),
  },
  screen: { flex: 1 },
  // 플로팅 탭바 도크 — 화면 하단에 겹쳐 띄운다. box-none 으로 양옆 여백은 터치 통과.
  floatDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
