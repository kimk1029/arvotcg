/**
 * 온보딩 — 첫 실행 4장 슬라이드 (웹 OnboardingScreen 과 동일 디자인/플로우).
 *
 *  · 건너뛰기 → 마지막 장.  다음 → 다음 장.  도트 탭 → 해당 장.
 *  · 'ARVO TCG 시작하기' → 열람 플래그 저장 → 로그인돼 있으면 홈, 아니면 로그인.
 *  · '이미 계정이 있으신가요? 로그인' → 열람 플래그 저장 → 위와 동일 분기.
 * 게이트 규칙 정본은 shared/onboarding.ts.
 */
import { useState } from 'react';
import { Animated, BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useCallback } from 'react';
import {
  ONBOARDING_CTA_NEXT,
  ONBOARDING_CTA_START,
  ONBOARDING_DOT_OFF,
  ONBOARDING_HAVE_ACCOUNT,
  ONBOARDING_LOGIN,
  ONBOARDING_SKIP,
  ONBOARDING_SLIDES,
  markOnboardingSeen,
  onboardingNextRoute,
} from '@/lib/onboarding';
import { isAuthenticated } from '@/lib/session';
import { useOnce } from '@/components/onboarding/anim';
import { BoxArt, CollectionArt, CommunityArt, PortfolioArt } from '@/components/onboarding/OnboardingArt';

const ARTS = [PortfolioArt, CollectionArt, BoxArt, CommunityArt] as const;

/** obIn — 텍스트 블록 등장(0.5s, 0.1s 지연, 14px 위로). */
function FadeUp({ children }: { children: React.ReactNode }) {
  const v = useOnce(500, 100);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={{ opacity: v, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const last = i === ONBOARDING_SLIDES.length - 1;
  const slide = ONBOARDING_SLIDES[i];
  const Art = ARTS[i];
  // 작은 화면(≤ 700pt)은 일러스트를 살짝 줄여 CTA 가 잘리지 않게 한다.
  const artScale = height < 700 ? 0.82 : 1;

  const finish = () => {
    markOnboardingSeen();
    router.replace(onboardingNextRoute(isAuthenticated()) as never);
  };

  // Android 뒤로가기: 이전 장으로. 첫 장이면 기본 동작(앱 종료).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (i > 0) {
          setI(i - 1);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [i]),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 건너뛰기 */}
      <View style={styles.skipRow}>
        {!last ? (
          <Pressable onPress={() => setI(ONBOARDING_SLIDES.length - 1)} hitSlop={8} style={styles.skipBtn}>
            <Text style={styles.skipTxt}>{ONBOARDING_SKIP}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 슬라이드 — key 로 리마운트해 등장 애니메이션을 매번 재생 */}
      <View key={i} style={styles.slide}>
        <View style={{ transform: [{ scale: artScale }] }}>
          <Art />
        </View>
        <FadeUp>
          <View style={[styles.textBlock, { marginTop: 34 * artScale }]}>
            <Text style={[styles.eyebrow, { color: slide.accent }]}>{slide.eyebrow}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.desc}>{slide.desc}</Text>
          </View>
        </FadeUp>
      </View>

      {/* 하단: 도트 + CTA + 로그인 링크 */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 22 }]}>
        <View style={styles.dots}>
          {ONBOARDING_SLIDES.map((s, n) => (
            <Pressable
              key={s.id}
              onPress={() => setI(n)}
              hitSlop={6}
              style={{ width: n === i ? 26 : 7, height: 7, borderRadius: 4, backgroundColor: n === i ? s.accent : ONBOARDING_DOT_OFF }}
            />
          ))}
        </View>

        <Pressable
          onPress={last ? finish : () => setI(i + 1)}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: slide.accent,
              shadowColor: slide.accent,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <Text style={styles.ctaTxt}>{last ? ONBOARDING_CTA_START : ONBOARDING_CTA_NEXT}</Text>
          {!last ? (
            <Svg width={17} height={17} viewBox="0 0 24 24">
              <Path d="m9 6 6 6-6 6" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ) : null}
        </Pressable>

        <View style={styles.loginRow}>
          <Text style={styles.loginQ}>{ONBOARDING_HAVE_ACCOUNT}</Text>
          <Pressable onPress={finish} hitSlop={8}>
            <Text style={styles.loginLink}>{ONBOARDING_LOGIN}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  skipRow: { height: 44, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 22 },
  skipBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  skipTxt: { fontSize: 13.5, fontWeight: '700', color: '#9A9AA0' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  textBlock: { alignItems: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 27, fontWeight: '900', color: '#16161a', letterSpacing: -0.9, lineHeight: 27 * 1.32, marginTop: 10, textAlign: 'center' },
  desc: { fontSize: 14.5, color: '#8E8E93', fontWeight: '500', lineHeight: 14.5 * 1.6, marginTop: 12, textAlign: 'center' },
  bottom: { paddingHorizontal: 28 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 24 },
  cta: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOpacity: 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 16 },
  loginQ: { fontSize: 13, color: '#9A9AA0', fontWeight: '500' },
  loginLink: { fontSize: 13, color: '#16161a', fontWeight: '800' },
});
