/**
 * 워프 스타필드 — 로그인 화면 배경 (웹 WarpStars 와 동일 파라미터).
 * 별들이 소실점(히어로 문구 중앙)에서 바깥으로 가속하며 흘러나가 "우주를 앞으로
 * 나아가는" 느낌. 캔버스가 없으므로 별 하나 = 방사 방향으로 회전한 얇은 막대 View,
 * 진행도(0→1)에 ease-in 을 걸어 translate·길이(scaleX)·불투명도를 함께 키운다.
 * 전부 네이티브 드라이버(transform/opacity)라 JS 스레드 부담이 없다.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const COUNT = 56;
const TINTS = ['#FFFFFF', '#FFD27A', '#7CE0FF', '#B27CFF'];

interface StarSpec {
  angle: number;
  duration: number;
  delay: number;
  tint: string;
  /** 스트릭 최대 길이(px). */
  len: number;
}

function makeStars(): StarSpec[] {
  return Array.from({ length: COUNT }, () => ({
    angle: Math.random() * Math.PI * 2,
    duration: 2200 + Math.random() * 2600,
    delay: Math.random() * 3000,
    tint: TINTS[Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 3)],
    len: 18 + Math.random() * 16,
  }));
}

function Star({ spec, cx, cy, radius }: { spec: StarSpec; cx: number; cy: number; radius: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: spec.duration, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const t = setTimeout(() => loop.start(), spec.delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [v, spec]);

  const dx = Math.cos(spec.angle);
  const dy = Math.sin(spec.angle);
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [cx, cx + dx * radius] });
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [cy, cy + dy * radius] });
  // 길이: 점(0.1) → 스트릭(1). 불투명도: 태어날 때 살짝 → 멀어질수록 밝게.
  const scaleX = v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.1, 0.35, 1] });
  const opacity = v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.35, 0.9, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -spec.len / 2,
        top: -1,
        width: spec.len,
        height: 2,
        borderRadius: 1,
        backgroundColor: spec.tint,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate: `${spec.angle}rad` }, { scaleX }],
      }}
    />
  );
}

/** 소실점(cx, cy)과 화면 크기를 받아 별을 방사한다. 부모는 position 기준 컨테이너여야 한다. */
export function WarpStars({ cx, cy, width, height }: { cx: number; cy: number; width: number; height: number }) {
  const stars = useMemo(makeStars, []);
  const radius = Math.hypot(width, height) * 0.62;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((s, i) => (
        <Star key={i} spec={s} cx={cx} cy={cy} radius={radius} />
      ))}
    </View>
  );
}
