import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { APP_VERSION } from '../../../shared/version';
import { PixelText } from './PixelText';
import { useThemeColors, useTheme, useThemeTextVariant } from './ThemeProvider';

/**
 * Cardvault status — gold band with logo + ♥×3 + v버전.
 * 버전은 웹 StatusBar 와 동일하게 커밋마다 자동 +1 (shared/version.ts, pre-commit 생성).
 */
export function StatusBar() {
  const c = useThemeColors();
  const { theme } = useTheme();
  const textVariant = useThemeTextVariant();
  return (
    <View style={[styles.bar, { backgroundColor: c.gold, borderBottomColor: c.ink }]}>
      <PixelText variant={textVariant} size={9} color={c.ink} style={{ letterSpacing: 1 }}>
        {theme === 'onepiece' ? '☠ GRAND LINE' : theme === 'sports' ? 'SCORE BOARD' : '🃏 ARVOTCG'}
      </PixelText>
      <PixelText variant={textVariant} size={9} color={c.ink} style={{ letterSpacing: 1 }}>
        {theme === 'onepiece' ? `☀×3   v${APP_VERSION}` : theme === 'sports' ? `Q4   v${APP_VERSION}` : `♥×3   v${APP_VERSION}`}
      </PixelText>
      <View pointerEvents="none" style={[styles.hi, { backgroundColor: c.goldLt }]} />
      <View pointerEvents="none" style={[styles.lo, { backgroundColor: c.goldDk }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 30,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gold,
    borderBottomWidth: 3,
    borderBottomColor: colors.ink,
  },
  hi: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.goldLt,
  },
  lo: {
    position: 'absolute',
    bottom: 3,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.goldDk,
  },
});
