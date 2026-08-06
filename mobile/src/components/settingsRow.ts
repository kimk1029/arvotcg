import type { ViewStyle } from 'react-native';
import { useTheme, useThemeColors } from './ThemeProvider';
import { isFlatTheme } from '@/lib/theme';

/**
 * 마이페이지 설정 행 공통 스타일 — 아이콘 박스(36) + 토글 스위치.
 * 픽셀 테마: 잉크 테두리 사각 / 클린·다크(플랫): 무테 라운드.
 * Currency·ShowPortfolio·GameFilter·NavStyle·Theme 설정 행이 공유.
 */
export function useSettingsRow() {
  const { theme } = useTheme();
  const tc = useThemeColors();
  const flat = isFlatTheme(theme);

  const icon = (bg: string): ViewStyle => ({
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: bg,
    borderWidth: flat ? 0 : 2,
    borderColor: tc.ink,
    borderRadius: flat ? 10 : 0,
  });

  const track = (bg: string): ViewStyle => ({
    width: 36,
    height: 20,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: bg,
    borderWidth: flat ? 0 : 1,
    borderColor: tc.ink,
  });

  const knob = (on: boolean): ViewStyle => ({
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    left: on ? 18 : 2,
    backgroundColor: tc.white,
    borderWidth: flat ? 0 : 1,
    borderColor: tc.ink,
  });

  return { flat, tc, icon, track, knob };
}

export const SETTINGS_ROW: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  paddingHorizontal: 14,
  paddingVertical: 14,
};
