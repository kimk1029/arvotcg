/**
 * 로그인 화면.
 *
 * 소셜 로그인 버튼을 누르면 웹 OAuth 시작 URL을 시스템 브라우저로 연다.
 * OAuth 콜백이 끝나면 서버가 `pokefesta30://auth?token=<jwt>` 로 리다이렉트하고,
 * 루트 레이아웃의 딥링크 핸들러가 토큰을 저장한다.
 */
import { useState } from 'react';
import { Alert, Platform, View, ScrollView, Pressable, StatusBar } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { api } from '@/lib/apiClient';
import { persistTokenAndGoHome } from '@/lib/oauth';
import { router } from 'expo-router';
import { PixelText } from '@/components/PixelText';
import { PixelPress } from '@/components/cv/PixelPress';
import { PixelBall } from '@/components/PixelBall';
import { ProviderLogo } from '@/components/ProviderLogo';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { getApiBaseUrl } from '@/lib/apiClient';
import { isAuthenticated } from '@/lib/session';
import { startSocialLogin, type AuthProvider } from '@/lib/oauth';

export default function LoginScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const [busy, setBusy] = useState(false);

  const startLogin = async (provider: AuthProvider) => {
    if (busy) return;
    setBusy(true);
    try {
      await startSocialLogin(provider);
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
      persistTokenAndGoHome(r.token);
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
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 40, paddingTop: 80 }}>
        {/* Hero — 브랜드 픽셀 마크 + 타이틀 */}
        <View style={{ alignItems: 'center', gap: 20, marginBottom: 40 }}>
          <View
            style={{
              padding: 14,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: tc.gold,
              borderWidth: 3,
            }}
          >
            <PixelBall size={72} />
          </View>
          <PixelText variant={txt} size={17} color={tc.gold} style={{ letterSpacing: 2 }} numberOfLines={1}>
            ARVOTCG
          </PixelText>
          <PixelText
            variant="ko"
            size={12}
            color="rgba(255,255,255,0.65)"
            style={{ textAlign: 'center', lineHeight: 20 }}
          >
            트레이딩 카드를 스마트하게{'\n'}스캔 · 아카이빙 · 거래 · 그레이딩
          </PixelText>
        </View>

        {isAuthenticated() ? (
          <View
            style={{
              marginBottom: 24,
              padding: 14,
              backgroundColor: tc.grnDk,
              borderColor: tc.ink,
              borderWidth: 3,
            }}
          >
            <PixelText variant={txt} size={10} color={tc.white} style={{ textAlign: 'center' }}>
              ✓ 이미 로그인되어 있어요
            </PixelText>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginVertical: 18,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <PixelText variant={txt} size={8} color="rgba(255,255,255,0.4)" style={{ letterSpacing: 1 }}>
            소셜 로그인
          </PixelText>
          <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        </View>

        {/* 프로바이더 브랜드색은 테마와 무관하게 리터럴 고정 — tc.white/tc.ink 는 clean·dark
            에서 뒤집혀(overload) 배경↔글자 대비가 깨진다(다크에서 글자가 안 보이던 버그). */}
        <View style={{ gap: 12 }}>
          {Platform.OS === 'ios' ? (
            <LoginBtn
              bg="#000000"
              fg="#FFFFFF"
              provider="apple"
              name="Apple로 로그인"
              desc="Apple 계정으로 간편 로그인"
              onPress={startAppleLogin}
            />
          ) : null}
          <LoginBtn
            bg="#FEE500"
            fg="#3A1D00"
            provider="kakao"
            name="카카오로 시작하기"
            desc="카카오 계정으로 간편 로그인"
            onPress={() => startLogin('kakao')}
          />
          <LoginBtn
            bg="#03C75A"
            fg="#FFFFFF"
            provider="naver"
            name="네이버로 시작하기"
            desc="네이버 계정으로 간편 로그인"
            onPress={() => startLogin('naver')}
          />
          <LoginBtn
            // '#FFF': PixelPress 가 colors.white('#FFFFFF') 와 같은 문자열이면 테마 white 로
            // 치환(다크에선 어두운색)하므로 3자리 hex 로 우회해 항상 흰 배경 유지.
            bg="#FFF"
            fg="#1F1F1F"
            provider="google"
            name="구글로 시작하기"
            desc="Google 계정으로 간편 로그인"
            onPress={() => startLogin('google')}
          />
        </View>

        <Pressable
          style={{ marginTop: 28, padding: 10, alignItems: 'center' }}
          onPress={() => router.replace('/' as never)}
        >
          <PixelText variant={txt} size={9} color="rgba(255,255,255,0.35)" style={{ letterSpacing: 1 }}>
            로그인 없이 둘러보기 →
          </PixelText>
        </Pressable>

        <PixelText
          variant="ko"
          size={9}
          color="rgba(255,255,255,0.35)"
          style={{ marginTop: 24, textAlign: 'center', lineHeight: 16, paddingHorizontal: 14 }}
        >
          로그인 시{' '}
          <PixelText variant="ko" size={9} color={tc.gold}>이용약관</PixelText>
          {' · '}
          <PixelText variant="ko" size={9} color={tc.gold}>개인정보처리방침</PixelText>
          에{'\n'}동의한 것으로 간주됩니다.
        </PixelText>

        <PixelText
          variant={txt}
          size={7}
          color="rgba(255,255,255,0.18)"
          style={{ marginTop: 24, textAlign: 'center', lineHeight: 12 }}
        >
          API: {getApiBaseUrl()}
        </PixelText>
      </ScrollView>
    </View>
  );
}

interface BtnProps {
  bg: string;
  fg: string;
  provider: AuthProvider | 'apple';
  name: string;
  desc: string;
  onPress: () => void;
}

function LoginBtn({ bg, fg, provider, name, desc, onPress }: BtnProps) {
  const txt = useThemeTextVariant();
  return (
    <PixelPress
      onPress={onPress}
      bg={bg}
      borderWidth={4}
      shadow={7}
      hi="rgba(255,255,255,0.4)"
      lo="rgba(0,0,0,0.18)"
      inner={3}
    >
      <View
        style={{
          paddingHorizontal: 18,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            backgroundColor: 'rgba(0,0,0,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: 'rgba(0,0,0,0.15)',
            borderWidth: 1,
          }}
        >
          <ProviderLogo provider={provider} size={24} />
        </View>
        <View style={{ flex: 1 }}>
          <PixelText variant={txt} size={11} color={fg} style={{ letterSpacing: 1 }}>
            {name}
          </PixelText>
          <PixelText
            variant={txt}
            size={9}
            color={fg}
            style={{ marginTop: 5, opacity: 0.65, letterSpacing: 0.3 }}
          >
            {desc}
          </PixelText>
        </View>
      </View>
    </PixelPress>
  );
}
