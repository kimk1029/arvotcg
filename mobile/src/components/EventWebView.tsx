/**
 * 예약형 이벤트 페이지 WebView — 카드쇼(/event/cardshow) · 트레이드 데이(/event/tradeday) 공용.
 * 웹 arvotcg.com 의 같은 경로를 그대로 띄우되, 웹뷰엔 웹 쿠키가 없으므로 앱 로그인 토큰(JWT)을
 * ?token= 으로 전달해 페이지가 Bearer 인증으로 동작한다. 미로그인이면 게이트로 로그인 유도.
 * 제목·경로·문구는 shared/eventPages.ts 설정에서 온다.
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
import { EMBED_QUERY_KEY, EMBED_UA_TOKEN } from '@/lib/embed';
import { EVENT_PAGES, type EventKey } from '@/lib/eventPages';
import { AppBar } from '@/components/AppBar';
import { useThemeColors } from '@/components/ThemeProvider';
import { useFloatNavInset } from '@/components/NavPrefsProvider';
import { WEB_OAUTH_ORIGIN } from '@/lib/oauth';
import { getSession, isAuthenticated } from '@/lib/session';

/** 웹 페이지 배경과 같은 색 — 로딩 중/여백에서 흰 번쩍임이 없도록. */
const CHROME_BG: Record<EventKey, string> = { cardshow: '#0F172A', tradeday: '#0B1024' };

export function EventWebView({ eventKey }: { eventKey: EventKey }) {
  const config = EVENT_PAGES[eventKey];
  const tc = useThemeColors();
  const [loading, setLoading] = useState(true);
  const floatNavInset = useFloatNavInset();
  const authed = isAuthenticated();
  const token = getSession()?.token ?? '';

  if (!authed) {
    return (
      <View style={{ flex: 1, backgroundColor: tc.paper }}>
        <AppBar title={config.header} onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
          <Text style={{ fontSize: 17, fontWeight: '900', color: tc.ink }}>로그인해주세요!</Text>
          <Text style={{ fontSize: 13, color: tc.ink3, textAlign: 'center', lineHeight: 20 }}>{config.loginNote}</Text>
          <Pressable
            onPress={() => router.push(`/login?callback=${encodeURIComponent(config.path)}` as never)}
            style={{ marginTop: 8, backgroundColor: '#FFD23F', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#3A2D00' }}>로그인하러 가기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const url = `${WEB_OAUTH_ORIGIN}${config.path}?token=${encodeURIComponent(token)}&${EMBED_QUERY_KEY}=1`;
  const bg = CHROME_BG[eventKey];

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <AppBar title={config.header} onBack={() => router.back()} />
      <WebView
        source={{ uri: url }}
        // 웹이 앱 임베드로 인식해 하단 탭바를 숨기도록 UA 토큰 부착(정본 shared/embed.ts).
        applicationNameForUserAgent={EMBED_UA_TOKEN}
        onLoadEnd={() => setLoading(false)}
        style={{ flex: 1, backgroundColor: bg, marginBottom: floatNavInset }}
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
