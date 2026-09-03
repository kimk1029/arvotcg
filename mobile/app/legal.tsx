/**
 * /legal?doc=terms|privacy — 약관/개인정보처리방침 WebView.
 *
 * 웹(poke-30.com)의 /terms · /privacy 페이지를 그대로 보여줘 내용이 항상 동기화된다.
 * 별도 OAuth 가로채기 로직 없이 단순 표시 전용.
 */
import { useState } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { EMBED_QUERY_KEY, EMBED_UA_TOKEN } from '@/lib/embed';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { useFloatNavInset } from '@/components/NavPrefsProvider';
import { WEB_OAUTH_ORIGIN } from '@/lib/oauth';

const DOCS = {
  terms: { path: '/terms', title: '이용약관' },
  privacy: { path: '/privacy', title: '개인정보처리방침' },
} as const;

export default function LegalScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const [loading, setLoading] = useState(true);
  // 플로팅 탭바가 WebView 위에 떠서 페이지 하단 버튼이 가려지지 않도록 바 높이만큼 비운다.
  const floatNavInset = useFloatNavInset();
  const meta = doc === 'privacy' ? DOCS.privacy : DOCS.terms;

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <StatusBar barStyle="dark-content" />
      <AppBar onBack={() => router.back()} title={meta.title} />
      <View style={{ flex: 1, marginBottom: floatNavInset }}>
        <WebView
          source={{ uri: `${WEB_OAUTH_ORIGIN}${meta.path}?${EMBED_QUERY_KEY}=1` }}
          // 웹이 앱 임베드로 인식해 하단 탭바를 숨기도록 UA 토큰 부착(정본 shared/embed.ts).
          applicationNameForUserAgent={EMBED_UA_TOKEN}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState
        />
        {loading ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tc.paper,
            }}
          >
            <ActivityIndicator color={tc.ink} />
            <PixelText variant={txt} size={10} color={tc.ink3} style={{ marginTop: 12 }}>
              불러오는 중…
            </PixelText>
          </View>
        ) : null}
      </View>
    </View>
  );
}
