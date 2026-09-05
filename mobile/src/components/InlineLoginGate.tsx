/**
 * 인라인 로그인 게이트 — 페이지 내부에 렌더되어 바텀 탭바를 그대로 유지한다.
 * `/login` 전체화면(다크 네이비)과는 별개의 라이트 테마 디자인.
 *
 * 미로그인 사용자가 컬렉션 / 마이 탭을 눌렀을 때 페이지 자리에 표시.
 * 소셜 로그인은 시스템 브라우저로 열고, 완료 후 pokefesta30://auth 딥링크를
 * 루트 레이아웃에서 처리한다.
 */
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { api } from '@/lib/apiClient';
import { persistTokenAndGoHome } from '@/lib/oauth';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { ProviderLogo } from '@/components/ProviderLogo';
import { useTheme, useThemeColors } from '@/components/ThemeProvider';
import { colors } from '@/theme/tokens';
import { isFlatTheme } from '@/lib/theme';
import { startSocialLogin, type AuthProvider } from '@/lib/oauth';

interface Props {
  /** 페이지 상단 AppBar 타이틀. */
  title: string;
  /** 게이트 안에 표시할 잠긴 기능 이름. 예: "내 컬렉션". */
  feature: string;
  /** 잠긴 기능 설명. */
  description?: string;
  /** 잠긴 영역 아이콘 (기본 🔒). */
  icon?: string;
}

export function InlineLoginGate({ title, feature, description, icon = '🔒' }: Props) {
  const tc = useThemeColors();
  const flat = isFlatTheme(useTheme().theme);
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

  // Sign in with Apple — /login 과 동일 플로우 (심사 지침 4.8, iOS 전용).
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
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.replace('/' as never)} title={title} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Lock hero — 잠긴 기능 안내 */}
        <View style={{ marginBottom: 16 }}>
          <PixelFrame
            bg={tc.gold}
            borderWidth={4}
            shadow={6}
            hi="rgba(255,255,255,0.55)"
            lo="rgba(0,0,0,0.18)"
            inner={3}
          >
            <View
              style={{
                paddingVertical: 22,
                paddingHorizontal: 18,
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: tc.ink,
                  borderColor: tc.ink,
                  borderWidth: flat ? 0 : 3,
                  borderRadius: flat ? 16 : 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 28 }}>{icon}</Text>
              </View>
              <PixelText variant="pixel" size={flat ? 11 : 10} weight={flat ? 'bold' : 'normal'} color={tc.ink} style={{ letterSpacing: flat ? 0.5 : 1.5 }}>
                LOGIN REQUIRED
              </PixelText>
              <PixelText
                variant="ko"
                size={14}
                weight="bold"
                color={tc.ink}
                style={{ textAlign: 'center', lineHeight: 20 }}
              >
                {feature}을(를) 사용하려면{'\n'}로그인이 필요합니다
              </PixelText>
              {description ? (
                <PixelText
                  variant="ko"
                  size={11}
                  color={tc.ink}
                  style={{ textAlign: 'center', opacity: 0.7, lineHeight: 15 }}
                >
                  {description}
                </PixelText>
              ) : null}
            </View>
          </PixelFrame>
        </View>

        {/* Divider */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginVertical: 12,
          }}
        >
          <View style={{ flex: 1, height: flat ? 1 : 2, backgroundColor: tc.pap3 }} />
          <PixelText variant="pixel" size={flat ? 11 : 9} color={tc.ink3} style={{ letterSpacing: flat ? 0.3 : 1 }}>
            소셜 로그인
          </PixelText>
          <View style={{ flex: 1, height: flat ? 1 : 2, backgroundColor: tc.pap3 }} />
        </View>

        {/* Compact social buttons — /login 의 큰 버튼보다 한 단계 작게.
            프로바이더 브랜드색은 테마와 무관하게 리터럴 고정 — colors.white 를 넘기면
            PixelPress 가 테마 white 로 치환해 clean·dark 에서 대비가 깨진다. */}
        <View style={{ gap: 10 }}>
          {Platform.OS === 'ios' ? (
            <CompactLoginBtn
              bg="#000000"
              fg="#FFFFFF"
              provider="apple"
              name="Apple로 로그인"
              onPress={startAppleLogin}
            />
          ) : null}
          <CompactLoginBtn
            // '#FFF': colors.white('#FFFFFF') 와 다른 문자열이라 PixelPress 테마 치환을 우회.
            bg="#FFF"
            fg="#1F1F1F"
            provider="google"
            name="구글로 로그인"
            onPress={() => startLogin('google')}
          />
          <CompactLoginBtn
            bg="#FEE500"
            fg="#3A1D00"
            provider="kakao"
            name="카카오로 로그인"
            onPress={() => startLogin('kakao')}
          />
          {/* 네이버 — 현재 비활성(준비 중). 순서상 맨 아래. */}
          <CompactLoginBtn
            bg="#03C75A"
            fg="#FFFFFF"
            provider="naver"
            name="네이버로 로그인 (준비 중)"
            disabled
            onPress={() => {}}
          />
        </View>

        <Pressable
          onPress={() => router.replace('/' as never)}
          style={{ marginTop: 18, padding: 12, alignItems: 'center' }}
        >
          <PixelText variant="pixel" size={flat ? 11 : 9} color={tc.ink3} style={{ letterSpacing: flat ? 0.3 : 1 }}>
            ← 홈으로 돌아가기
          </PixelText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

interface CompactBtnProps {
  bg: string;
  fg: string;
  provider: AuthProvider | 'apple';
  name: string;
  onPress: () => void;
  /** 준비 중인 프로바이더 — 흐리게 + 누름 차단. */
  disabled?: boolean;
}

function CompactLoginBtn({ bg, fg, provider, name, onPress, disabled }: CompactBtnProps) {
  const flat = isFlatTheme(useTheme().theme);
  return (
    <PixelPress
      onPress={onPress}
      disabled={disabled}
      // 비활성은 전체 opacity 로 낮추지 않는다 — 픽셀 베벨의 흰 하이라이트가 남아
      // 텍스트 영역이 흰 박스처럼 뜬다. 대신 면·글자색 자체를 중성 회색으로 바꾸고
      // 하이라이트를 없애 버튼 전체가 고르게 죽어 보이게 한다.
      bg={disabled ? colors.btnOffBg : bg}
      borderWidth={3}
      shadow={5}
      hi={disabled ? null : 'rgba(255,255,255,0.4)'}
      lo={disabled ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.18)'}
      inner={2}
    >
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            backgroundColor: 'rgba(0,0,0,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: 'rgba(0,0,0,0.12)',
            borderWidth: flat ? 0 : 1,
            borderRadius: flat ? 8 : 0,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <ProviderLogo provider={provider} size={19} />
        </View>
        <PixelText variant="pixel" size={flat ? 13 : 11} weight={flat ? 'bold' : 'normal'} color={disabled ? colors.btnOffFg : fg} style={{ flex: 1, letterSpacing: flat ? 0 : 0.5 }}>
          {name}
        </PixelText>
      </View>
    </PixelPress>
  );
}
