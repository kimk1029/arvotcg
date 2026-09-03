/**
 * /web?url=…&title=… — 범용 인앱 웹뷰.
 *
 * 어드민이 히어로 배너 linkUrl 에 http(s) 주소를 넣으면 이 화면으로 열린다 —
 * 새 이벤트/공지 페이지를 웹으로만 만들면 앱 업데이트 없이 배너로 노출 가능.
 *
 * 보안: 로그인 토큰(?token=)은 우리 도메인(아래 TRUSTED_HOSTS)일 때만 첨부.
 * 외부 사이트에는 절대 토큰을 노출하지 않는다.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, StatusBar, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { EMBED_QUERY_KEY, EMBED_UA_TOKEN } from '@/lib/embed';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { useThemeColors } from '@/components/ThemeProvider';
import { useFloatNavInset } from '@/components/NavPrefsProvider';
import { getSession } from '@/lib/session';

const TRUSTED_HOSTS = new Set([
  'arvotcg.com',
  'www.arvotcg.com',
  'poke-30.com',
  'www.poke-30.com',
]);

export default function InAppWebScreen() {
  const tc = useThemeColors();
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const [loading, setLoading] = useState(true);
  // 플로팅 탭바가 WebView 위에 떠서 페이지 하단 버튼이 가려지지 않도록 바 높이만큼 비운다.
  const floatNavInset = useFloatNavInset();

  const finalUrl = useMemo(() => {
    const raw = typeof url === 'string' ? url : '';
    if (!/^https?:\/\//i.test(raw)) return null;
    try {
      const u = new URL(raw);
      if (TRUSTED_HOSTS.has(u.hostname)) {
        const token = getSession()?.token;
        if (token && !u.searchParams.has('token')) u.searchParams.set('token', token);
        u.searchParams.set(EMBED_QUERY_KEY, '1');
      }
      return u.toString();
    } catch {
      return null;
    }
  }, [url]);

  if (!finalUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: tc.paper }}>
        <AppBar title="페이지" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <Text style={{ fontSize: 13, color: tc.ink3 }}>열 수 없는 주소예요.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <StatusBar barStyle="dark-content" />
      <AppBar title={typeof title === 'string' && title ? title : '이벤트'} onBack={() => router.back()} />
      <WebView
        source={{ uri: finalUrl }}
        // 웹이 앱 임베드로 인식해 하단 탭바를 숨기도록 UA 토큰 부착(정본 shared/embed.ts).
        applicationNameForUserAgent={EMBED_UA_TOKEN}
        onLoadEnd={() => setLoading(false)}
        style={{ flex: 1, marginBottom: floatNavInset }}
        originWhitelist={['https://*', 'http://*']}
      />
      {loading ? (
        <View style={{ position: 'absolute', top: 110, left: 0, right: 0, alignItems: 'center' }}>
          <ActivityIndicator color={tc.ink} />
        </View>
      ) : null}
    </View>
  );
}
