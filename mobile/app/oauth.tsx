/**
 * /oauth?provider=kakao|naver|google — 앱 내부 WebView OAuth 화면.
 *
 * 외부 브라우저 / Custom Tabs / 딥링크에 의존하지 않고 WebView 안에서 OAuth 를
 * 진행한다. 서버가 성공 시 `pokefesta30://auth?token=<jwt>` 로 리다이렉트하면,
 * WebView 의 onShouldStartLoadWithRequest 에서 그 네비게이션을 가로채 토큰을 직접
 * 회수한다. → Chrome 없는 에뮬레이터/기기에서도 동작하고, 딥링크 라우팅 404 도
 * 발생하지 않는다.
 */
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { colors } from '@/theme/tokens';
import {
  buildAuthUrl,
  extractOAuthToken,
  persistTokenAndGoHome,
  type AuthProvider,
} from '@/lib/oauth';

// 일부 provider 가 기본 WebView userAgent 를 거부(예: Google "disallowed_useragent")
// 하므로 표준 모바일 브라우저 UA 로 위장한다. 단 UA 는 반드시 실제 플랫폼과 일치해야
// 한다 — iOS WKWebView 에 Android UA 를 씌우면 navigator.platform('iPhone')·vendor
// ('Apple Computer, Inc.')·WebKit 버전(605 계열)과 전부 어긋나서, 네이버가 이를 변조로
// 판단해 로그인 단계에서 에러 페이지를 내려준다(iOS 전용 로그인 실패의 원인).
const UA =
  Platform.OS === 'ios'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

function normalizeProvider(p: string | undefined): AuthProvider {
  return p === 'naver' || p === 'google' ? p : 'kakao';
}

export default function OAuthWebView() {
  const { provider, callback } = useLocalSearchParams<{ provider?: string; callback?: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const done = useRef(false);

  const authProvider = normalizeProvider(provider);
  // WebView 가 로드할 URL. 커스텀 스킴(intent:// 의 web fallback) 으로 교체될 수 있어 state.
  const [uri, setUri] = useState(() => buildAuthUrl(authProvider));

  // 로그인 완료 리다이렉트인지 판별. 서버는 모바일 성공 시 https 브리지
  // (/auth/app-callback?token=) 로 보낸다. 과거 커스텀 스킴(pokefesta30://) 도 호환.
  const isReturnUrl = (url: string): boolean =>
    url.startsWith('pokefesta30://') || url.includes('/auth/app-callback');

  // 리턴 URL 을 가로채 토큰 회수. 있으면 세션 저장 후 홈, 없으면 로그인 화면으로.
  const handleReturn = (url: string): void => {
    if (done.current) return;
    done.current = true;
    const token = extractOAuthToken(url);
    if (token) persistTokenAndGoHome(token, typeof callback === 'string' ? callback : null);
    else router.back();
  };

  // 카카오 등은 "간편 로그인"용으로 kakaotalk:// / intent:// 같은 커스텀 스킴으로
  // 네비게이트한다. WebView 가 이를 직접 로드하면 "Error loading page … -10" 이 뜬다.
  // intent:// 는 S.browser_fallback_url(웹 로그인) 로 대체해 WebView 안에서 계속 진행하고,
  // 그 외 앱 스킴은 외부(설치 앱)로 넘긴다.
  const handleAppScheme = (url: string): void => {
    if (url.startsWith('intent://')) {
      const m = url.match(/S\.browser_fallback_url=([^;]+)/);
      if (m) {
        try {
          const fb = decodeURIComponent(m[1]);
          if (/^https?:/i.test(fb)) {
            setUri(fb);
            return;
          }
        } catch {
          // ignore — fall through to external open
        }
      }
    }
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <AppBar onBack={() => router.back()} title="소셜 로그인" />
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri }}
          userAgent={UA}
          // 커스텀 스킴(pokefesta30://, kakaotalk://, intent://) 도 onShouldStartLoadWithRequest
          // 로 전달되도록 허용.
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(req) => {
            const u = req.url;
            // 로그인 완료 리다이렉트(https 브리지 또는 커스텀 스킴)를 가로채 토큰 회수 후
            // false 반환으로 네비게이션 차단(브리지 페이지 로드/intent 발사 방지).
            if (isReturnUrl(u)) {
              handleReturn(u);
              return false;
            }
            // http(s)/about/data/blob 이 아닌 앱 스킴은 WebView 가 로드하지 않도록 가로챈다
            // (그대로 두면 -10 에러). intent:// 는 web fallback 으로, 나머지는 외부 앱으로.
            if (!/^(https?|about|data|blob):/i.test(u)) {
              handleAppScheme(u);
              return false;
            }
            return true;
          }}
          onNavigationStateChange={(nav: WebViewNavigation) => {
            if (isReturnUrl(nav.url)) handleReturn(nav.url);
          }}
          // target=_blank / window.open 은 새 창을 만들 수 없어 기본적으로 무시된다
          // (iOS WKWebView, Android setSupportMultipleWindows). 네이버의 기기등록·약관
          // 단계가 이 방식이라 그대로 두면 버튼이 먹통이 된다 → 같은 WebView 에서 연다.
          onOpenWindow={(e) => {
            const u = e.nativeEvent?.targetUrl;
            if (!u) return;
            if (isReturnUrl(u)) {
              handleReturn(u);
              return;
            }
            if (/^https?:/i.test(u)) setUri(u);
            else handleAppScheme(u);
          }}
          // 오버레이는 첫 페이지 로드까지만. 이후 단계(이메일→비밀번호 등)는 WebView 안에서
          // 진행하도록 두고, onLoadStart 로 다시 켜지 않는다. → 어떤 단계가 에러로 끝나
          // onLoadEnd 가 안 와도 스피너가 무한히 떠 있지 않는다.
          onLoadEnd={() => setLoading(false)}
          onHttpError={() => setLoading(false)}
          onError={(e) => {
            setLoading(false);
            const u = e.nativeEvent?.url;
            if (u && isReturnUrl(u)) handleReturn(u);
          }}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
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
              backgroundColor: colors.paper,
            }}
          >
            <ActivityIndicator color={colors.ink} />
            <PixelText variant="pixel" size={10} color={colors.ink3} style={{ marginTop: 12 }}>
              로그인 페이지 여는 중…
            </PixelText>
          </View>
        ) : null}
      </View>
    </View>
  );
}
