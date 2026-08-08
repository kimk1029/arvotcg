import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme/tokens';
import { PixelText } from '../PixelText';
import { useTheme, useThemeColors } from '../ThemeProvider';
import { isFlatTheme } from '@/lib/theme';

interface Props {
  on?: boolean;
  onPress?: () => void;
  bg?: string;
  fg?: string;
  size?: number;
  px?: number;
  py?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Chip({
  on = false,
  onPress,
  bg,
  fg,
  size = 10,
  px = 10,
  py = 8,
  style,
  children,
}: Props) {
  const { theme } = useTheme();
  const tc = useThemeColors();
  // 플랫 테마(clean·dark 등) — 픽셀 하드섀도/직각 대신 라운드 알약 칩.
  // 호출부의 bg/fg 는 픽셀 팔레트 기준이라 무시하고 클린 표준(on=잉크/off=소프트)을 쓴다.
  if (isFlatTheme(theme)) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          {
            alignSelf: 'flex-start',
            borderRadius: 999,
            backgroundColor: on ? tc.ink : tc.pap2,
            borderWidth: 1,
            borderColor: on ? tc.ink : tc.pap3,
            paddingHorizontal: px + 3,
            height: 30,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <PixelText variant="ko" size={size + 2} weight="bold" color={on ? tc.paper : tc.ink2}>
          {children as string}
        </PixelText>
      </Pressable>
    );
  }
  const shadow = 3;
  const finalBg = on ? colors.gold : bg || colors.white;
  const finalFg = on ? colors.ink : fg || colors.ink;
  return (
    <Pressable onPress={onPress} style={[styles.wrap, { marginRight: shadow, marginBottom: shadow }, style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: colors.ink,
            top: shadow,
            left: shadow,
            right: -shadow,
            bottom: -shadow,
          },
        ]}
      />
      <View
        style={{
          backgroundColor: finalBg,
          borderColor: colors.ink,
          borderWidth: 2,
          paddingHorizontal: px,
          height: 30,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PixelText variant="pixel" size={size} color={finalFg}>
          {children as string}
        </PixelText>
        {on ? (
          <>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: colors.goldLt,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: colors.goldDk,
              }}
            />
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', alignSelf: 'flex-start' },
});
