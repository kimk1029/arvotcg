/**
 * 일반 링 로딩 스피너 (웹 .pf-pokeball-spinner 패리티).
 * 트랙(pap3) 위에 accent(red) 원호가 도는 표준 스피너 — 전 테마 공통.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useThemeColors } from './ThemeProvider';
import {
  LOADING_PROGRESS_TICK_MS,
  stepLoadingProgress,
} from '../../../shared/loadingProgress';

/**
 * 의사-진행률 훅 (웹 useLoadingProgress 패리티) — 99%까지 점점 느리게 오르고,
 * 100은 스스로 도달하지 않는다. 100%는 실제 로딩 완료 시점에만 표시한다.
 */
export function useLoadingProgress(): number {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setPct((p) => stepLoadingProgress(p)),
      LOADING_PROGRESS_TICK_MS,
    );
    return () => clearInterval(id);
  }, []);
  return Math.floor(pct);
}

interface Props {
  size?: number;
  thickness?: number;
}

export function Spinner({ size = 44, thickness }: Props) {
  const c = useThemeColors();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const sw = thickness ?? Math.max(2, Math.round(size * 0.07));
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.pap3} strokeWidth={sw} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.red}
          strokeWidth={sw}
          fill="none"
          strokeDasharray={`${circ * 0.28} ${circ * 0.72}`}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}
