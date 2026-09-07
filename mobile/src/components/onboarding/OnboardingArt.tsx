/**
 * 온보딩 일러스트 4종 — 웹 OnboardingScreen 의 HTML/SVG 를 react-native-svg + Animated 로
 * 1:1 재현. 250×250 박스 안에 220 viewBox SVG 를 깔고, 그 위에 절대배치 카드/배지를 올린다
 * (웹과 동일한 좌표계). 애니메이션 타이밍은 anim.ts 참조.
 *
 * 웹의 CSS 애니메이션 transform 은 인라인 static transform 을 덮어쓰므로(카드의 rotate(-14deg)
 * 등은 실제로 보이지 않음) 여기서도 애니메이션 transform 만 적용한다 — 렌더 결과 패리티.
 */
import type { ReactNode } from 'react';
import { Animated, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { EASE_OUT, RISE_EASING, useOnce, useRestart, useYoyo } from './anim';

const ART = 250;
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

/* ───────── 공통 래퍼 ───────── */

/** obFloat(a) / obFloat2(b) — 떠다니는 카드·배지. */
function Float({
  kind = 'a',
  duration = 4000,
  delay = 0,
  style,
  children,
}: {
  kind?: 'a' | 'b';
  duration?: number;
  delay?: number;
  style?: ViewStyle;
  children: ReactNode;
}) {
  const v = useYoyo(duration, delay);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: kind === 'a' ? [0, -13] : [-6, 8] });
  const rotate = v.interpolate({
    inputRange: [0, 1],
    outputRange: kind === 'a' ? ['-3deg', '2deg'] : ['4deg', '-2deg'],
  });
  return <Animated.View style={[style, { transform: [{ translateY }, { rotate }] }]}>{children}</Animated.View>;
}

/** obBob — 위아래 7px. */
function Bob({ duration = 3000, delay = 0, style, children }: { duration?: number; delay?: number; style?: ViewStyle; children: ReactNode }) {
  const v = useYoyo(duration, delay);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  return <Animated.View style={[style, { transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** obPulse — 일러스트 뒤 원형 글로우. */
function Glow({ inset, colors, duration }: { inset: number; colors: [string, string]; duration: number }) {
  const v = useYoyo(duration);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.12] });
  const size = ART - inset * 2;
  return (
    <Animated.View style={{ position: 'absolute', left: inset, top: inset, width: size, height: size, opacity, transform: [{ scale }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="0.7" stopColor={colors[1]} />
            <Stop offset="1" stopColor={colors[1]} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill="url(#glow)" />
      </Svg>
    </Animated.View>
  );
}

/** 그라디언트 면 — 웹 linear-gradient(150~160deg, a, b[, c]) 근사. */
function Grad({
  id,
  stops,
  radius,
  style,
  radial,
  children,
}: {
  id: string;
  stops: Array<[number, string]>;
  radius: number;
  style: ViewStyle;
  radial?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={[style, { borderRadius: radius, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {radial ? (
            <RadialGradient id={id} cx="50%" cy="45%" r="60%">
              {stops.map(([o, c]) => (
                <Stop key={o} offset={o} stopColor={c} />
              ))}
            </RadialGradient>
          ) : (
            <LinearGradient id={id} x1="0" y1="0" x2="0.7" y2="1">
              {stops.map(([o, c]) => (
                <Stop key={o} offset={o} stopColor={c} />
              ))}
            </LinearGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

const shadow = (o: number, r: number, y: number): ViewStyle => ({
  shadowColor: '#000',
  shadowOpacity: o,
  shadowRadius: r,
  shadowOffset: { width: 0, height: y },
  elevation: 4,
});

/* ───────── SLIDE 1 : 시세 ───────── */

const BARS: Array<[number, number, string, number]> = [
  // x, height, fill, delay(ms)
  [46, 30, '#FFD9B3', 100],
  [74, 46, '#FFC48A', 220],
  [102, 36, '#FFD9B3', 340],
  [130, 64, '#FF9A4D', 460],
  [158, 88, '#FF7A00', 580],
];

function RiseBar({ x, h, fill, delay }: { x: number; h: number; fill: string; delay: number }) {
  const v = useOnce(900, delay, RISE_EASING);
  const height = v.interpolate({ inputRange: [0, 1], outputRange: [h * 0.25, h] });
  const y = v.interpolate({ inputRange: [0, 1], outputRange: [162 - h * 0.25, 162 - h] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return <AnimatedRect x={x} y={y} width={16} height={height} rx={4} fill={fill} opacity={opacity} />;
}

function DrawPath({ d, length, stroke, width, delay, duration }: { d: string; length: number; stroke: string; width: number; delay: number; duration: number }) {
  const v = useOnce(duration, delay, EASE_OUT);
  const offset = v.interpolate({ inputRange: [0, 1], outputRange: [length, 0] });
  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={[length, length]}
      strokeDashoffset={offset}
    />
  );
}

function Ping({ cx, cy, r, stroke, width, delay, duration }: { cx: number; cy: number; r: number; stroke: string; width: number; delay: number; duration: number }) {
  const v = useRestart(duration, delay, EASE_OUT);
  const rr = v.interpolate({ inputRange: [0, 1], outputRange: [r * 0.5, r * 2.4] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });
  return <AnimatedCircle cx={cx} cy={cy} r={rr} fill="none" stroke={stroke} strokeWidth={width} opacity={opacity} />;
}

function MiniCard({ left, bottom, stops, emoji, kind, duration, delay }: { left: number; bottom: number; stops: Array<[number, string]>; emoji: string; kind: 'a' | 'b'; duration: number; delay?: number }) {
  return (
    <Float kind={kind} duration={duration} delay={delay} style={{ position: 'absolute', left, bottom, width: 44, height: 60 }}>
      <Grad id={`mc${left}`} stops={stops} radius={7} style={[{ width: 44, height: 60, alignItems: 'center', justifyContent: 'center' }, shadow(0.18, 14, 6)] as unknown as ViewStyle}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </Grad>
    </Float>
  );
}

export function PortfolioArt() {
  return (
    <View style={styles.art}>
      <Glow inset={14} colors={['#FFE6CC', '#FFF6EE']} duration={3400} />
      <Svg width={ART} height={ART} viewBox="0 0 220 220" style={StyleSheet.absoluteFill}>
        <Rect x="30" y="46" width="160" height="128" rx="14" fill="#fff" stroke="#EFE3D6" strokeWidth="2" />
        <Line x1="30" y1="80" x2="190" y2="80" stroke="#F4EEE7" strokeWidth="1.5" />
        <Line x1="30" y1="112" x2="190" y2="112" stroke="#F4EEE7" strokeWidth="1.5" />
        <Line x1="30" y1="144" x2="190" y2="144" stroke="#F4EEE7" strokeWidth="1.5" />
        {BARS.map(([x, h, fill, delay]) => (
          <RiseBar key={x} x={x} h={h} fill={fill} delay={delay} />
        ))}
        <DrawPath d="M54 140 L82 122 L110 130 L138 100 L166 72" length={420} stroke="#F5333F" width={3.5} delay={500} duration={1500} />
        <Circle cx="166" cy="72" r="6" fill="#F5333F" />
        <Ping cx={166} cy={72} r={9} stroke="#F5333F" width={2.5} delay={1600} duration={1900} />
      </Svg>
      {/* +17.4% 배지 */}
      <Float kind="a" duration={4000} style={{ position: 'absolute', top: 6, right: -2 }}>
        <View style={[{ backgroundColor: '#16161a', borderRadius: 12, paddingVertical: 7, paddingHorizontal: 12 }, shadow(0.2, 20, 8)]}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#FF9A4D' }}>+17.4% ▲</Text>
        </View>
      </Float>
      {/* 내 카드 스택 */}
      <View style={{ position: 'absolute', left: -6, bottom: 2, width: 92, height: 70 }}>
        <MiniCard left={0} bottom={0} stops={[[0, '#9d6bd6'], [1, '#4568dc']]} emoji="💎" kind="b" duration={5000} />
        <MiniCard left={22} bottom={6} stops={[[0, '#f9d423'], [1, '#ff8a3c']]} emoji="⚡" kind="a" duration={4400} delay={300} />
        <MiniCard left={44} bottom={0} stops={[[0, '#ff8a3c'], [1, '#e11d2a']]} emoji="🔥" kind="b" duration={4800} delay={600} />
        <Bob duration={3000} style={{ position: 'absolute', right: -16, top: -6 }}>
          <View style={[{ backgroundColor: '#fff', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8 }, shadow(0.14, 12, 4)]}>
            <Text style={{ fontSize: 10.5, fontWeight: '900', color: '#16161a' }}>132장</Text>
          </View>
        </Bob>
      </View>
    </View>
  );
}

/* ───────── SLIDE 2 : 컬렉션 ───────── */

function Sweep() {
  const v = useRestart(2600, 0, (n) => n);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-46, 46] });
  const opacity = v.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 52,
        right: 52,
        top: 56,
        height: 3,
        borderRadius: 2,
        opacity,
        transform: [{ translateY }],
        shadowColor: '#6a3aff',
        shadowOpacity: 0.7,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Svg width="100%" height="3">
        <Defs>
          <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#6a3aff" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#6a3aff" stopOpacity="1" />
            <Stop offset="1" stopColor="#6a3aff" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="3" rx="1.5" fill="url(#sweep)" />
      </Svg>
    </Animated.View>
  );
}

function GlowDot() {
  const v = useYoyo(1600);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2BB673', opacity }} />;
}

const cardFrame = (bg: string, extra: ViewStyle = {}): ViewStyle => ({
  width: 88,
  height: 122,
  borderRadius: 11,
  padding: 5,
  backgroundColor: bg,
  ...extra,
});

export function CollectionArt() {
  return (
    <View style={styles.art}>
      <Glow inset={20} colors={['#E7E2FF', '#F5F3FF']} duration={3800} />
      {/* 피카츄 */}
      <Float kind="b" duration={5200} style={{ position: 'absolute', left: 34, top: 52 }}>
        <View style={[cardFrame('#f2c531'), { shadowColor: '#3c288c', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 5 }]}>
          <Grad id="pika" stops={[[0, '#fff7c2'], [0.6, '#ffd54a'], [1, '#f0a500']]} radius={7} style={{ flex: 1 }}>
            <View style={{ position: 'absolute', top: 5, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.tiny('#3a2a00')}>피카츄 ex</Text>
              <Text style={s.tiny('#3a2a00')}>HP 190</Text>
            </View>
            <Grad id="pikaFace" radial stops={[[0, '#fff'], [1, '#ffe58a']]} radius={4} style={{ position: 'absolute', top: 18, left: 6, right: 6, height: 54, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30 }}>⚡</Text>
            </Grad>
            <View style={{ position: 'absolute', bottom: 14, left: 6, right: 6, height: 3, borderRadius: 2, backgroundColor: 'rgba(58,42,0,.25)' }} />
            <View style={{ position: 'absolute', bottom: 8, left: 6, width: '60%', height: 3, borderRadius: 2, backgroundColor: 'rgba(58,42,0,.18)' }} />
            <Text style={[s.micro('#3a2a00'), { position: 'absolute', bottom: 3, right: 6 }]}>025/165 SAR</Text>
          </Grad>
        </View>
      </Float>
      {/* 루피 */}
      <Float kind="a" duration={4400} delay={300} style={{ position: 'absolute', left: 82, top: 38 }}>
        <View style={[cardFrame('#16161a'), { shadowColor: '#3c288c', shadowOpacity: 0.26, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 6 }]}>
          <Grad id="luffy" stops={[[0, '#c9262d'], [1, '#7a0d16']]} radius={7} style={{ flex: 1 }}>
            <View style={{ position: 'absolute', top: 5, left: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#c9262d' }}>5</Text>
              </View>
              <Text style={{ fontSize: 6, fontWeight: '900', color: '#fff' }}>LEADER</Text>
            </View>
            <Grad id="luffyFace" radial stops={[[0, '#ffb37a'], [0.75, '#c9262d'], [1, '#c9262d']]} radius={4} style={{ position: 'absolute', top: 22, left: 6, right: 6, height: 56, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30 }}>🏴‍☠️</Text>
            </Grad>
            <Text style={[s.tiny('#fff'), { position: 'absolute', bottom: 14, left: 6 }]}>몽키 D. 루피</Text>
            <View style={{ position: 'absolute', bottom: 4, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.micro('rgba(255,255,255,.75)')}>OP01-003</Text>
              <Text style={s.micro('rgba(255,255,255,.75)')}>SEC</Text>
            </View>
          </Grad>
        </View>
      </Float>
      {/* 리자몽 */}
      <Float kind="b" duration={4800} delay={600} style={{ position: 'absolute', left: 128, top: 54 }}>
        <View style={[cardFrame('#e11d2a'), { shadowColor: '#a0281e', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 5 }]}>
          <Grad id="char" stops={[[0, '#ffb37a'], [0.55, '#ff6a3d'], [1, '#c81d25']]} radius={7} style={{ flex: 1 }}>
            <View style={{ position: 'absolute', top: 5, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.tiny('#fff')}>리자몽 ex</Text>
              <Text style={s.tiny('#fff')}>HP 330</Text>
            </View>
            <Grad id="charFace" radial stops={[[0, '#ffe0b3'], [1, '#ff7a4d']]} radius={4} style={{ position: 'absolute', top: 18, left: 6, right: 6, height: 54, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30 }}>🔥</Text>
            </Grad>
            <View style={{ position: 'absolute', bottom: 14, left: 6, right: 6, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.4)' }} />
            <View style={{ position: 'absolute', bottom: 8, left: 6, width: '55%', height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.3)' }} />
            <Text style={[s.micro('#fff'), { position: 'absolute', bottom: 3, right: 6 }]}>201/165 SAR</Text>
          </Grad>
        </View>
      </Float>
      {/* 스캔 프레임 */}
      <Svg width={ART} height={ART} viewBox="0 0 220 220" style={StyleSheet.absoluteFill} pointerEvents="none">
        <G fill="none" stroke="#6a3aff" strokeWidth="4" strokeLinecap="round">
          <Path d="M50 178 L50 194 L66 194" />
          <Path d="M170 178 L170 194 L154 194" />
        </G>
      </Svg>
      <Sweep />
      <Bob duration={3200} style={{ position: 'absolute', bottom: 6, left: 0, right: 0, alignItems: 'center' }}>
        <View style={[{ backgroundColor: '#fff', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 }, shadow(0.14, 22, 8)]}>
          <GlowDot />
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#16161a' }}>132장 등록됨</Text>
        </View>
      </Bob>
    </View>
  );
}

/* ───────── SLIDE 3 : 박스 · 인덱스 ───────── */

function SpinRing() {
  const v = useRestart(18000);
  const rotation = v.interpolate({ inputRange: [0, 1], outputRange: [0, 360] });
  return (
    <AnimatedG rotation={rotation} origin="110,120">
      <Circle cx="110" cy="120" r="34" fill="none" stroke="#3B7BF6" strokeWidth="2" strokeDasharray={[5, 8]} />
    </AnimatedG>
  );
}

function FloatG({ children }: { children: ReactNode }) {
  // SVG 내부 그룹의 obFloat — translateY 만(회전은 박스 원근 왜곡이 커 생략).
  const v = useYoyo(4800);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -13] });
  return <AnimatedG y={translateY}>{children}</AnimatedG>;
}

function HitCard({ left, top, frame, stops, emoji, tag, tagBg, tagFg, kind, duration, delay }: { left: number; top: number; frame: string | Array<[number, string]>; stops: Array<[number, string]>; emoji: string; tag: string; tagBg: string; tagFg: string; kind: 'a' | 'b'; duration: number; delay?: number }) {
  const inner = (
    <Grad id={`hit${left}`} stops={stops} radius={4} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={{ fontSize: 6, fontWeight: '900', color: tagFg, backgroundColor: tagBg, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: 'hidden' }}>{tag}</Text>
    </Grad>
  );
  const box: ViewStyle = { width: 44, height: 62, borderRadius: 6, padding: 3, ...shadow(0.22, 18, 8) };
  return (
    <Float kind={kind} duration={duration} delay={delay} style={{ position: 'absolute', left, top }}>
      {typeof frame === 'string' ? (
        <View style={[box, { backgroundColor: frame }]}>{inner}</View>
      ) : (
        <Grad id={`hitFrame${left}`} stops={frame} radius={6} style={box}>
          {inner}
        </Grad>
      )}
    </Float>
  );
}

export function BoxArt() {
  return (
    <View style={styles.art}>
      <Glow inset={18} colors={['#DCEBFF', '#F2F7FF']} duration={3200} />
      <Svg width={ART} height={ART} viewBox="0 0 220 220" style={StyleSheet.absoluteFill}>
        <FloatG>
          <Path d="M54 118 L54 168 L110 190 L110 140 Z" fill="#3f6bcc" />
          <Path d="M166 118 L166 168 L110 190 L110 140 Z" fill="#2f56a8" />
          <Path d="M54 118 L110 140 L166 118 L110 96 Z" fill="#5b86e5" />
          <Path d="M54 118 L32 100 L88 78 L110 96 Z" fill="#7aa3f0" />
          <Path d="M166 118 L188 100 L132 78 L110 96 Z" fill="#6b94e6" />
        </FloatG>
        <SpinRing />
      </Svg>
      <HitCard left={52} top={26} frame="#f2c531" stops={[[0, '#fff7c2'], [1, '#f0a500']]} emoji="⚡" tag="SAR" tagBg="#fff" tagFg="#3a2a00" kind="b" duration={4400} />
      <HitCard left={88} top={12} frame={[[0, '#e6e6ef'], [1, '#b8b8c8']]} stops={[[0, '#ffffff'], [1, '#d6d9e8']]} emoji="💎" tag="SSR" tagBg="#16161a" tagFg="#fff" kind="a" duration={4000} delay={300} />
      <HitCard left={124} top={26} frame="#16161a" stops={[[0, '#2b2b36'], [1, '#0e0e12']]} emoji="🌙" tag="BWR" tagBg="#fff" tagFg="#16161a" kind="b" duration={4800} delay={600} />
      {/* 인덱스 차트 카드 */}
      <Float kind="b" duration={4600} style={{ position: 'absolute', top: 60, right: -10, width: 96 }}>
        <View style={[{ backgroundColor: '#16161a', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 }, shadow(0.22, 20, 8)]}>
          <Text style={{ fontSize: 8.5, fontWeight: '800', color: 'rgba(255,255,255,.55)' }}>TCG 인덱스</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#fff' }}>1,284.6</Text>
            <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#FF7A6B' }}>+2.8%</Text>
          </View>
          <Svg width="100%" height={24} viewBox="0 0 80 26" preserveAspectRatio="none" style={{ marginTop: 5 }}>
            <Path d="M0,22 L10,18 L20,20 L30,14 L40,16 L50,10 L60,12 L70,6 L80,4 L80,26 L0,26 Z" fill="rgba(255,122,0,.25)" />
            <DrawPath d="M0,22 L10,18 L20,20 L30,14 L40,16 L50,10 L60,12 L70,6 L80,4" length={140} stroke="#FF7A00" width={2} delay={400} duration={1600} />
            <Circle cx="80" cy="4" r="2.5" fill="#FF7A00" />
          </Svg>
        </View>
      </Float>
      <Bob duration={3000} style={{ position: 'absolute', bottom: 8, left: -4 }}>
        <View style={[{ backgroundColor: '#fff', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6 }, shadow(0.14, 20, 8)]}>
          <Text style={{ fontSize: 14 }}>✨</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#16161a' }}>히트카드 6종</Text>
        </View>
      </Bob>
    </View>
  );
}

/* ───────── SLIDE 4 : 커뮤니티 ───────── */

function BobG({ duration, delay = 0, children }: { duration: number; delay?: number; children: ReactNode }) {
  const v = useYoyo(duration, delay);
  const y = v.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  return <AnimatedG y={y}>{children}</AnimatedG>;
}

function FloatBubble({ children }: { children: ReactNode }) {
  const v = useYoyo(4600);
  const y = v.interpolate({ inputRange: [0, 1], outputRange: [0, -13] });
  return <AnimatedG y={y}>{children}</AnimatedG>;
}

export function CommunityArt() {
  return (
    <View style={styles.art}>
      <Glow inset={16} colors={['#DCF3E6', '#F1FBF5']} duration={3600} />
      <Svg width={ART} height={ART} viewBox="0 0 220 220" style={StyleSheet.absoluteFill}>
        <Rect x="28" y="84" width="164" height="112" rx="16" fill="#EAF6EE" stroke="#CDEBDA" strokeWidth="2" />
        <Path d="M28 130 L192 130" stroke="#fff" strokeWidth="7" />
        <Path d="M96 84 L96 196" stroke="#fff" strokeWidth="7" />
        <Path d="M28 160 L192 160" stroke="#fff" strokeWidth="5" />
        <Path d="M150 84 L150 196" stroke="#fff" strokeWidth="5" />
        <Rect x="40" y="96" width="42" height="22" rx="4" fill="#DCEFE2" />
        <Rect x="106" y="140" width="34" height="14" rx="3" fill="#DCEFE2" />
        <Rect x="160" y="168" width="24" height="20" rx="3" fill="#DCEFE2" />
        <BobG duration={3000}>
          <Path d="M66 162 C56 150 56 142 66 136 C76 142 76 150 66 162 Z" fill="#9A9AA0" />
          <Circle cx="66" cy="144" r="3.5" fill="#fff" />
        </BobG>
        <BobG duration={3400} delay={600}>
          <Path d="M170 132 C160 120 160 112 170 106 C180 112 180 120 170 132 Z" fill="#9A9AA0" />
          <Circle cx="170" cy="114" r="3.5" fill="#fff" />
        </BobG>
        <BobG duration={2600} delay={300}>
          <Ping cx={124} cy={122} r={9} stroke="#2BB673" width={2.5} delay={0} duration={2000} />
          <Path d="M124 134 C110 118 110 108 124 100 C138 108 138 118 124 134 Z" fill="#2BB673" />
          <Circle cx="124" cy="111" r="4.5" fill="#fff" />
        </BobG>
        <FloatBubble>
          <Rect x="36" y="22" width="92" height="42" rx="13" fill="#fff" stroke="#D6EEE0" strokeWidth="2" />
          <Path d="M56 64 L56 76 L70 64 Z" fill="#fff" stroke="#D6EEE0" strokeWidth="2" />
          <Circle cx="58" cy="43" r="4" fill="#2BB673" />
          <Circle cx="74" cy="43" r="4" fill="#9ADCBB" />
          <Circle cx="90" cy="43" r="4" fill="#CDEBDA" />
        </FloatBubble>
      </Svg>
      {/* 카드샵 정보 카드 */}
      <Float kind="b" duration={4400} delay={400} style={{ position: 'absolute', top: 150, left: 118, width: 104 }}>
        <View style={[{ backgroundColor: '#fff', borderRadius: 11, paddingVertical: 7, paddingHorizontal: 9 }, shadow(0.16, 22, 10)]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#16161a' }}>성수 카드샵</Text>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B7BF6', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 6.5, fontWeight: '900', color: '#fff' }}>✓</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <Text style={{ fontSize: 9, color: '#F0A500' }}>★★★★★</Text>
            <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#16161a' }}>4.8</Text>
            <Text style={{ fontSize: 8, color: '#9A9AA0' }}>후기 128</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 3, marginTop: 5 }}>
            <Text style={{ fontSize: 7, fontWeight: '800', color: '#2BB673', backgroundColor: '#E3F6EC', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, overflow: 'hidden' }}>오리파 多</Text>
            <Text style={{ fontSize: 7, fontWeight: '800', color: '#6a3aff', backgroundColor: '#EFEBFF', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, overflow: 'hidden' }}>싱글 판매</Text>
          </View>
        </View>
      </Float>
      <Bob duration={3000} style={{ position: 'absolute', top: 12, right: 2 }}>
        <Grad id="ava1" stops={[[0, '#ffe08a'], [1, '#ffb347']]} radius={14} style={[{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, shadow(0.14, 18, 8)] as unknown as ViewStyle}>
          <Text style={{ fontSize: 21 }}>🐹</Text>
        </Grad>
      </Bob>
      <Bob duration={3600} delay={500} style={{ position: 'absolute', top: 56, right: 36 }}>
        <Grad id="ava2" stops={[[0, '#9d6bff'], [1, '#6a3aff']]} radius={11} style={[{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, shadow(0.14, 18, 8)] as unknown as ViewStyle}>
          <Text style={{ fontSize: 17 }}>👾</Text>
        </Grad>
      </Bob>
    </View>
  );
}

const s = {
  tiny: (color: string) => ({ fontSize: 6.5, fontWeight: '900' as const, color }),
  micro: (color: string) => ({ fontSize: 5.5, fontWeight: '900' as const, color }),
};

const styles = StyleSheet.create({
  art: { width: ART, height: ART, position: 'relative' },
});
