import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  View,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '@/theme/tokens';
import { useThemeColors, useTheme } from '../ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { PixelDeco } from './PixelDeco';

interface Props extends PressableProps {
  bg?: string;
  border?: string;
  borderWidth?: number;
  shadow?: number;
  hi?: string | null;
  lo?: string | null;
  inner?: number;
  innerStyle?: StyleProp<ViewStyle>;
  /** Pressable wrap style (margins, alignSelf, etc) */
  wrapStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * 웹 globals.css `.my-item` / `.pri-btn` 의 누름 가능한 픽셀 버튼을 재현.
 *
 * 평상시: 4방향 ink 테두리(꼭지점 한 칸 빔) + 상/좌 하이라이트 + 하/우 음영 + 꼭지점 빈 단일 하드 드롭섀도.
 * 누를 때: 웹 `:active{transform:translate(Npx,Npx); box-shadow ... Npx Npx 0 ink}` 처럼
 *          면(face)이 드롭섀도 위로 내려앉으며 그림자가 줄어든다.
 *
 * 핵심: **드롭섀도 평면의 바깥(우하단) 코너는 항상 고정**이고 면만 그 위로 내려간다
 *       (웹 box-shadow 와 동일 — translate + 잔여그림자 = 원래 그림자). 예전엔 그림자 평면 자체를
 *       위로 끌어올려 면이 더 많이 내려가면서 **그림자 좌상단이 노출**되는 버그가 있었다.
 *       또한 면 이동을 Animated 로 부드럽게 보간해 "살짝 눌리는" 느낌을 준다.
 * 모서리는 radius 가 아니라 꼭지점 한 칸을 비운 큰 픽셀 노치(배경 노출).
 */
export function PixelPress({
  bg = colors.white,
  border = colors.ink,
  borderWidth = 4,
  shadow: shadowProp = 6,
  hi = 'rgba(255,255,255,0.85)',
  lo = 'rgba(0,0,0,0.18)',
  inner = 3,
  innerStyle,
  wrapStyle,
  children,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const c = useThemeColors();
  const { theme } = useTheme();
  const faceBg = bg === colors.white ? c.white : bg;
  const edge = border === colors.ink ? c.ink : border;
  const loThick = Math.max(2, inner + 1);
  const cut = borderWidth;
  // 앱은 ink 테두리(면 안쪽) + 드롭섀도(바깥)가 같은 색이라 합쳐져 웹보다 두껍게 보인다.
  // 드롭 오프셋을 2px 줄여 그림자를 얇게(웹 체감과 비슷하게). 0 은 그대로(섀도 없음).
  const shadow = shadowProp > 0 ? Math.max(1, shadowProp - 2) : 0;

  // 누른 상태에서 남는 잔여 그림자(웹: rest 5→active 2, rest 8→active 4 ≈ 절반).
  // 면은 (shadow - 잔여) 만큼 우하단으로 내려가 그림자 위에 안착한다 → 좌상단엔 그림자가 안 보이고
  // 우하단에 잔여 그림자만 남는다(=그림자 바깥 코너 고정).
  const pressedShadow = Math.max(1, Math.floor(shadow / 2));
  const travel = shadow - pressedShadow;

  const [pressed, setPressed] = useState(false);
  const press = useRef(new Animated.Value(0)).current;

  const handleIn = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(true);
      Animated.timing(press, { toValue: 1, duration: 70, useNativeDriver: true }).start();
      onPressIn?.(e);
    },
    [onPressIn, press],
  );
  const handleOut = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(false);
      Animated.timing(press, { toValue: 0, duration: 110, useNativeDriver: true }).start();
      onPressOut?.(e);
    },
    [onPressOut, press],
  );

  const shift = press.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
  const styleVal = typeof style === 'function' ? style({ pressed, hovered: false } as never) : style;

  // 플랫(clean·dark) — 픽셀 데코/드롭섀도 대신 라인보더+라운드, 누르면 살짝 투명.
  // (clean 직각 예외는 2026-08-06 제거 — PixelFrame 과 동일.)
  // borderWidth=0 && shadow=0 은 컨테이너 안 "bare row" 용례 — 무테·무라운드 유지.
  if (isFlatTheme(theme)) {
    const bare = borderWidth === 0 && shadowProp === 0;
    const radius = bare ? 0 : 12;
    return (
      <Pressable
        {...rest}
        onPressIn={handleIn}
        onPressOut={handleOut}
        style={({ pressed: p }) => [{ opacity: p ? 0.85 : 1 }, wrapStyle, styleVal]}
      >
        <View
          style={[
            { backgroundColor: faceBg, borderWidth: bare ? 0 : 1, borderColor: c.pap3, borderRadius: radius },
            theme === 'clean' && shadowProp > 0 ? pressStyles.flatShadow : null,
          ]}
        >
          <View style={[{ padding: Math.max(2, inner + 1) }, innerStyle]}>{children as React.ReactNode}</View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable {...rest} onPressIn={handleIn} onPressOut={handleOut}>
      <View style={[styles.wrap, { marginRight: shadow, marginBottom: shadow }, wrapStyle, styleVal]}>
        {/* 꼭지점 빈 단일 하드 드롭섀도 — 위치 고정. 면이 이 위로 내려앉는다. */}
        {shadow > 0 ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { top: shadow, left: shadow, right: -shadow, bottom: -shadow }]}
          >
            <PixelDeco faceBg={edge} edge={edge} cut={cut} border={false} />
          </View>
        ) : null}
        <Animated.View style={[styles.face, { transform: [{ translateX: shift }, { translateY: shift }] }]}>
          <PixelDeco
            faceBg={faceBg}
            edge={edge}
            cut={cut}
            hi={hi}
            lo={lo}
            inner={inner}
            loThick={loThick}
            pressed={pressed}
          />
          {/* 투명 테두리로 콘텐츠를 테두리 안쪽으로 들여놓는다(기존 borderWidth 와 동일한 인셋) */}
          <View style={[{ borderWidth: cut, borderColor: 'transparent', backgroundColor: 'transparent' }, innerStyle]}>
            {children as React.ReactNode}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  face: { position: 'relative' },
});

const pressStyles = StyleSheet.create({
  flatShadow: {
    shadowColor: '#11141A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
