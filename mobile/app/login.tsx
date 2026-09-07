/**
 * 로그인 화면 — Claude Design 'ARVO 로그인' (웹 LoginScreen.tsx 와 동일 디자인).
 * 다크 네이비 그라디언트 + 앰비언트 글로우 + 스파크, 히어로 문구, 소셜 버튼.
 *  · 카카오 / 구글: 앱 내부 WebView OAuth (startSocialLogin) → 토큰 저장 → callback 복귀.
 *  · 네이버: 준비 중 — 비활성.
 *  · Apple: iOS 전용 네이티브 시트 (심사 지침 4.8).
 * 뒤로가기 화살표는 온보딩으로. '둘러보기' 는 로그인 필수 정책으로 없음 (shared/onboarding.ts).
 */
import { useState } from 'react';
import { Alert, Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { api } from '@/lib/apiClient';
import { persistTokenAndGoHome, startSocialLogin, type AuthProvider } from '@/lib/oauth';
import { ProviderLogo } from '@/components/ProviderLogo';
import { useOnce, useYoyo } from '@/components/onboarding/anim';
import { WarpStars } from '@/components/WarpStars';

const SPARKS: Array<{ top: number; left?: number; right?: number; size: number; color: string; dur: number; delay: number }> = [
  { top: 140, left: 52, size: 5, color: '#FFD27A', dur: 2600, delay: 0 },
  { top: 112, right: 66, size: 4, color: '#FFD27A', dur: 3100, delay: 800 },
  { top: 342, right: 44, size: 3, color: '#7CE0FF', dur: 2200, delay: 400 },
  { top: 318, left: 38, size: 3, color: '#B27CFF', dur: 2900, delay: 1200 },
  { top: 400, left: 120, size: 3, color: '#FFD27A', dur: 3400, delay: 600 },
];

/** lgSpark — 반짝임(opacity .15↔1, scale .5↔1). */
function Spark({ top, left, right, size, color, dur, delay }: (typeof SPARKS)[number]) {
  const v = useYoyo(dur, delay);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        left,
        right,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
        shadowColor: color,
        shadowOpacity: 1,
        shadowRadius: size * 2,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

/** lgGlow — 상단 앰비언트 글로우(opacity .7↔1, scale 1↔1.08). */
function AmbientGlow({ width }: { width: number }) {
  const v = useYoyo(5000);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 70, left: width / 2 - 210, width: 420, height: 420, opacity, transform: [{ scale }] }}>
      <Svg width={420} height={420} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="lgGlowTop" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFA824" stopOpacity="0.22" />
            <Stop offset="0.62" stopColor="#FFA824" stopOpacity="0" />
            <Stop offset="1" stopColor="#FFA824" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill="url(#lgGlowTop)" />
      </Svg>
    </Animated.View>
  );
}

/** obIn — 등장(0.5s, 14px 위로). */
function FadeUp({ delay, style, onLayout, children }: { delay: number; style?: object; onLayout?: (e: LayoutChangeEvent) => void; children: React.ReactNode }) {
  const v = useOnce(500, delay);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View onLayout={onLayout} style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  // 워프 스타필드 소실점 — 히어로 문구('내 컬렉션의 가치를 한눈에') 중앙.
  // 히어로 블록의 y(루트 기준) + 그 안의 문구 y·높이로 계산. 레이아웃 전엔 화면 40% 지점.
  const [heroY, setHeroY] = useState<number | null>(null);
  const [headline, setHeadline] = useState<{ y: number; h: number } | null>(null);
  const focusY = heroY != null && headline ? heroY + headline.y + headline.h / 2 : height * 0.4;
  // /login?callback=/event/cardshow — 로그인 후 원래 화면으로 복귀 (웹 callbackUrl 패리티).
  const { callback } = useLocalSearchParams<{ callback?: string }>();
  const callbackPath = typeof callback === 'string' ? callback : null;

  const startLogin = async (provider: AuthProvider) => {
    if (busy) return;
    setBusy(true);
    try {
      await startSocialLogin(provider, callbackPath);
    } finally {
      setBusy(false);
    }
  };

  // Sign in with Apple — 심사 지침 4.8 필수(서드파티 로그인 제공 시). iOS 전용.
  // 네이티브 시트에서 identityToken 을 받아 서버 /auth/apple/native 로 검증·세션 발급.
  const startAppleLogin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) throw new Error('identityToken 없음');
      // 이름은 최초 승인 시 1회만 내려온다 — 그때만 서버에 전달.
      const name =
        [cred.fullName?.familyName, cred.fullName?.givenName].filter(Boolean).join('') || undefined;
      const r = await api<{ token?: string; error?: string }>('/auth/apple/native', {
        method: 'POST',
        body: { identityToken: cred.identityToken, name },
        auth: false,
      });
      if (!r.token) throw new Error(r.error ?? '토큰 발급 실패');
      persistTokenAndGoHome(r.token, callbackPath);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple 로그인 실패', '잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* 배경 그라디언트 */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="lgBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B1024" />
            <Stop offset="0.55" stopColor="#0A0D1F" />
            <Stop offset="1" stopColor="#07091A" />
          </LinearGradient>
          <RadialGradient id="lgGlowBottom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#3C5ADC" stopOpacity="0.14" />
            <Stop offset="0.65" stopColor="#3C5ADC" stopOpacity="0" />
            <Stop offset="1" stopColor="#3C5ADC" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#lgBg)" />
        {/* 하단 파란 글로우 (560×320 타원, 화면 아래로 140 내려감) */}
        <Rect x={width / 2 - 280} y={height - 180} width={560} height={320} rx={160} fill="url(#lgGlowBottom)" />
      </Svg>
      <AmbientGlow width={width} />
      <WarpStars cx={width / 2} cy={focusY} width={width} height={height} />
      {SPARKS.map((s, n) => (
        <Spark key={n} {...s} />
      ))}

      {/* 뒤로 (온보딩) */}
      <View style={[styles.top, { marginTop: insets.top }]}>
        <Pressable onPress={() => router.replace('/onboarding' as never)} hitSlop={8} style={styles.back} accessibilityLabel="온보딩으로">
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path d="M19 12H5" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d="m12 19-7-7 7-7" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </Pressable>
      </View>

      {/* 히어로 */}
      <FadeUp delay={50} style={styles.hero} onLayout={(e) => setHeroY(e.nativeEvent.layout.y)}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text style={styles.brand}>ARVO</Text>
          {/* 그라디언트 텍스트 — SVG 마스크 대신 골드 단색(#FFB55E, #FFD27A↔#FF9A4D 중간값). */}
          <Text style={[styles.brand, { color: '#FFB55E' }]}> TCG</Text>
        </View>
        <Text
          style={styles.headline}
          onLayout={(e) => setHeadline({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
        >
          내 컬렉션의 가치를{'\n'}한눈에
        </Text>
        <Text style={styles.sub}>시세 · 컬렉션 · 커뮤니티{'\n'}간편 로그인으로 3초 만에 시작하세요</Text>
      </FadeUp>

      {/* 소셜 버튼 */}
      <FadeUp delay={200} style={styles.btns}>
        <SocialBtn bg="#FEE500" fg="#191919" label="카카오로 계속하기" icon={<ProviderLogo provider="kakao" size={20} />} onPress={() => startLogin('kakao')} disabled={busy} />
        <SocialBtn bg="#fff" fg="#16161a" label="Google로 계속하기" icon={<ProviderLogo provider="google" size={19} />} onPress={() => startLogin('google')} disabled={busy} />
        {Platform.OS === 'ios' ? (
          <SocialBtn bg="rgba(255,255,255,0.08)" fg="#fff" label="Apple로 계속하기" icon={<ProviderLogo provider="apple" size={18} />} onPress={startAppleLogin} disabled={busy} glass />
        ) : null}
        {/* 네이버 — 준비 중(서버 프로바이더 미설정). 준비 중이라 맨 아래, 비활성. */}
        <SocialBtn bg="#03C75A" fg="#fff" label="네이버로 계속하기 · 준비 중" icon={<Text style={{ fontSize: 17, fontWeight: '900', color: '#fff' }}>N</Text>} onPress={() => {}} off />
      </FadeUp>

      {/* 푸터 */}
      <Text style={[styles.footer, { marginBottom: Math.max(insets.bottom, 12) + 22 }]}>
        계속하면{' '}
        <Text style={styles.footerLink} onPress={() => router.push('/legal?doc=terms' as never)}>이용약관</Text>
        {' · '}
        <Text style={styles.footerLink} onPress={() => router.push('/legal?doc=privacy' as never)}>개인정보 처리방침</Text>
        에 동의하게 됩니다
      </Text>
    </View>
  );
}

function SocialBtn({ bg, fg, label, icon, onPress, disabled, off, glass }: { bg: string; fg: string; label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean; off?: boolean; glass?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || off}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: off ? 0.45 : pressed ? 0.9 : 1 },
        glass ? { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' } : null,
      ]}
    >
      <View style={styles.btnIc}>{icon}</View>
      <Text style={[styles.btnTxt, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1024', overflow: 'hidden' },
  top: { height: 52, justifyContent: 'center', paddingHorizontal: 8, zIndex: 2 },
  back: { padding: 8, alignSelf: 'flex-start' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, zIndex: 2 },
  brand: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -1, lineHeight: 36 },
  headline: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.8, marginTop: 30, textAlign: 'center', lineHeight: 26 * 1.3 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginTop: 12, textAlign: 'center', lineHeight: 14 * 1.6 },
  btns: { paddingHorizontal: 28, gap: 10, zIndex: 2 },
  btn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnIc: { position: 'absolute', left: 20, top: 0, bottom: 0, justifyContent: 'center' },
  btnTxt: { fontSize: 15, fontWeight: '800' },
  footer: { marginTop: 26, paddingHorizontal: 28, textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.38)', fontWeight: '500', lineHeight: 11.5 * 1.6, zIndex: 2 },
  footerLink: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
