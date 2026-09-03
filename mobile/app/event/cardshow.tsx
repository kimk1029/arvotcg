/**
 * /event/cardshow — 카드쇼 사전예약 웹뷰.
 * 웹 arvotcg.com/event/cardshow 를 그대로 띄우되, 웹뷰엔 웹 쿠키가 없으므로
 * 앱 로그인 토큰(JWT)을 ?token= 으로 전달해 페이지가 Bearer 인증으로 동작한다.
 * 미로그인 상태면 게이트를 띄워 로그인으로 유도 (페이지 자체 게이트와 이중 안전).
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { EMBED_QUERY_KEY, EMBED_UA_TOKEN } from '@/lib/embed';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { useThemeColors } from '@/components/ThemeProvider';
import { useFloatNavInset } from '@/components/NavPrefsProvider';
import { WEB_OAUTH_ORIGIN } from '@/lib/oauth';
import { getSession, isAuthenticated } from '@/lib/session';

export default function CardShowScreen() {
  const tc = useThemeColors();
  const [loading, setLoading] = useState(true);
  // 플로팅 탭바가 WebView 위에 떠서 페이지 하단 버튼이 가려지지 않도록 바 높이만큼 비운다.
  const floatNavInset = useFloatNavInset();
  const authed = isAuthenticated();
  const token = getSession()?.token ?? '';

  if (!authed) {
    return (
      <View style={{ flex: 1, backgroundColor: tc.paper }}>
        <AppBar title="카드쇼 사전예약" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
          <Text style={{ fontSize: 17, fontWeight: '900', color: tc.ink }}>로그인해주세요!</Text>
          <Text style={{ fontSize: 13, color: tc.ink3, textAlign: 'center', lineHeight: 20 }}>
            카드쇼 예약은 로그인한 회원만 가능해요.
          </Text>
          <Pressable
            onPress={() => router.push('/login?callback=/event/cardshow' as never)}
            style={{ marginTop: 8, backgroundColor: '#FFD23F', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#3A2D00' }}>로그인하러 가기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const url = `${WEB_OAUTH_ORIGIN}/event/cardshow?token=${encodeURIComponent(token)}&${EMBED_QUERY_KEY}=1`;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <StatusBar barStyle="light-content" />
      <AppBar title="카드쇼 사전예약" onBack={() => router.back()} />
      <WebView
        source={{ uri: url }}
        // 웹이 앱 임베드로 인식해 하단 탭바를 숨기도록 UA 토큰 부착(정본 shared/embed.ts).
        applicationNameForUserAgent={EMBED_UA_TOKEN}
        onLoadEnd={() => setLoading(false)}
        style={{ flex: 1, backgroundColor: '#0F172A', marginBottom: floatNavInset }}
        // 예약 페이지 외부 링크는 웹뷰 안에서 열지 않는다.
        originWhitelist={['https://*', 'http://*']}
      />
      {loading ? (
        <View style={{ position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' }}>
          <ActivityIndicator color="#2DD4BF" />
        </View>
      ) : null}
    </View>
  );
}
