import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { colors } from '@/theme/tokens';
import { StatusBar } from './StatusBar';
import { Tabbar } from './Tabbar';
import { useChrome } from './ChromeContext';
import { useThemeColors, useTheme } from './ThemeProvider';
import { useNavPrefs } from './NavPrefsProvider';
import { isFlatTheme } from '@/lib/theme';

interface Props {
  children: React.ReactNode;
}

/**
 * Phone shell — wraps every screen with status bar + content + tabbar.
 * Login is a fullscreen overlay that hides status/tabbar.
 */
export function PhoneShell({ children }: Props) {
  const pathname = usePathname();
  const { hidden } = useChrome();
  const { theme } = useTheme();
  const { navStyle } = useNavPrefs();
  const floating = navStyle === 'floating';
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  // 로그인/OAuth WebView 는 전체화면 — status/tabbar 숨김.
  const isLogin = pathname?.startsWith('/login') || pathname?.startsWith('/oauth');
  const isFullscreen = isLogin || hidden;
  // 클린·다크(모던 플랫) 테마는 픽셀 골드 상단 밴드를 쓰지 않는다 — 각 화면이
  // 자체 헤더를 갖고, SafeArea top 인셋만 페이퍼색으로 남긴다.
  const showStatusBand = !isFullscreen && !isFlatTheme(theme);
  return (
    <View style={[styles.root, { backgroundColor: c.pap2 }]}>
      <SafeAreaView
        style={[
          styles.shell,
          {
            backgroundColor: c.paper,
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
        {/* 플로팅: 탭바를 절대배치 오버레이로 띄워 컨텐츠가 바 뒤로 지나가게 한다.
            통합형: 기존처럼 플로우에 차지(컨텐츠와 안 겹침). */}
        {!isFullscreen ? (
          floating ? (
            <View style={[styles.floatDock, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
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
