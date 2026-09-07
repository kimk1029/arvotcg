/**
 * 온보딩 벡터 애니메이션 프리미티브 — 웹 온보딩(globals.css 의 ob* keyframes)과
 * 같은 타이밍/궤적을 RN Animated 로 재현한다. 값은 전부 JS 드라이버(react-native-svg
 * 속성까지 같은 값을 공유하기 위해).
 *
 *  · useYoyo   : 0→1→0 반복 (obFloat / obFloat2 / obBob / obPulse / obGlow)
 *  · useRestart: 0→1 뒤 즉시 0 으로 되감기 반복 (obSpin / obPing / obSweep)
 *  · useOnce   : 0→1 한 번 (obIn / obDraw / obRise)
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

const SINE = Easing.inOut(Easing.sin);

export function useYoyo(duration: number, delay = 0): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: duration / 2, easing: SINE, useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration: duration / 2, easing: SINE, useNativeDriver: false }),
      ]),
    );
    const t = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [v, duration, delay]);
  return v;
}

export function useRestart(
  duration: number,
  delay = 0,
  easing: (n: number) => number = Easing.linear,
): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    const t = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [v, duration, delay, easing]);
  return v;
}

export function useOnce(
  duration: number,
  delay = 0,
  easing: (n: number) => number = Easing.out(Easing.cubic),
): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [v, duration, delay, easing]);
  return v;
}

/** CSS cubic-bezier(.2,.9,.3,1) — obRise 의 튀어오르는 이징. */
export const RISE_EASING = Easing.bezier(0.2, 0.9, 0.3, 1);
export const EASE_OUT = Easing.out(Easing.quad);
