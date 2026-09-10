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
import { ActivityIndicator, Linking, Platform, Share, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useToast } from '@/components/ToastProvider';
import { EMBED_QUERY_KEY, EMBED_UA_TOKEN } from '@/lib/embed';
import { KAKAO_APP_SCHEMES, intentToScheme } from '../../shared/kakao';
import { isStoreUrl } from '../../shared/reviewPrompt';
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

/** 웹 → 앱 메시지 (window.ReactNativeWebView.postMessage). 수익 인증 페이지가 PNG 를 넘긴다. */
interface WebMessage {
  type?: string;
  dataUrl?: string;
  fileName?: string;
  title?: string;
}

/** data:image/png;base64,… → 캐시 파일. 반환은 file:// URI. */
function writeDataUrlToCache(dataUrl: string, fileName: string): string {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = globalThis.atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const f = new File(Paths.cache, fileName.replace(/[^a-z0-9._-]/gi, '_') || 'flex.png');
  if (f.exists) f.delete();
  f.create();
  f.write(bytes);
  return f.uri;
}

/**
 * 이미지 파일 공유 — expo-sharing(네이티브)이 있는 빌드면 공유 시트(카카오톡·인스타 등),
 * 없는 구 빌드(OTA)는 iOS 는 RN Share 로 파일, Android 는 링크 텍스트로 폴백.
 * 네이티브 모듈은 require 전에 존재부터 확인한다 — 최상위 require 가 던지면 앱이 죽는다
 * ([[ota-native-module-crash]] 2026-09-11).
 */
async function shareImageFile(uri: string, title: string, fallbackUrl: string): Promise<void> {
  if (requireOptionalNativeModule('ExpoSharing')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sharing = require('expo-sharing') as typeof import('expo-sharing');
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
    return;
  }
  if (Platform.OS === 'ios') {
    await Share.share({ url: uri, title });
    return;
  }
  await Share.share({ message: `${title}\n${fallbackUrl}`, title });
}

export default function InAppWebScreen() {
  const tc = useThemeColors();
  const toast = useToast();
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
        // 예약 페이지는 헤더로 인증하여 토큰 정리용 리다이렉트를 피한다.
        if (token && !u.pathname.startsWith('/event/') && !u.searchParams.has('token')) u.searchParams.set('token', token);
        u.searchParams.set(EMBED_QUERY_KEY, '1');
      }
      return u.toString();
    } catch {
      return null;
    }
  }, [url]);

  const source = useMemo(() => {
    if (!finalUrl) return undefined;
    const u = new URL(finalUrl);
    const token = getSession()?.token;
    return TRUSTED_HOSTS.has(u.hostname) && u.pathname.startsWith('/event/') && token
      ? { uri: finalUrl, headers: { Authorization: `Bearer ${token}` } }
      : { uri: finalUrl };
  }, [finalUrl]);

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
      <AppBar title={typeof title === 'string' && title ? title : '이벤트'} onBack={() => router.back()} />
      <WebView
        source={source!}
        // 웹이 앱 임베드로 인식해 하단 탭바를 숨기도록 UA 토큰 부착(정본 shared/embed.ts).
        applicationNameForUserAgent={EMBED_UA_TOKEN}
        onLoadEnd={() => setLoading(false)}
        // 카카오톡 공유 — 웹 SDK 가 여는 kakaolink:// / intent:// 는 WebView 가 못 열므로 OS 로 넘긴다.
        // 카카오톡이 없으면 스토어로. (정본 shared/kakao.ts)
        onShouldStartLoadWithRequest={(req) => {
          const u = req.url ?? '';
          // 스토어 주소(리뷰 쓰러가기)는 스토어 앱으로.
          if (isStoreUrl(u)) {
            Linking.openURL(u).catch(() => undefined);
            return false;
          }
          const isKakao = u.startsWith('intent://') || KAKAO_APP_SCHEMES.some((s) => u.startsWith(s));
          if (!isKakao) return true;
          const { url: schemeUrl, package: pkg } = intentToScheme(u);
          Linking.openURL(schemeUrl).catch(() => {
            const store = Platform.OS === 'android'
              ? `market://details?id=${pkg ?? 'com.kakao.talk'}`
              : 'https://apps.apple.com/kr/app/id362057947';
            Linking.openURL(store).catch(() => toast.error('카카오톡을 열지 못했어요'));
          });
          return false;
        }}
        // 수익 인증 '이미지로 공유' — 웹이 포스터 PNG 를 넘기면 파일로 저장해 공유 시트를 띄운다.
        onMessage={(e: WebViewMessageEvent) => {
          let msg: WebMessage | null = null;
          try {
            msg = JSON.parse(e.nativeEvent.data) as WebMessage;
          } catch {
            return;
          }
          if (msg?.type !== 'flex-share-image' || !msg.dataUrl) return;
          (async () => {
            try {
              const uri = writeDataUrlToCache(msg!.dataUrl!, msg!.fileName ?? 'arvotcg-flex.png');
              await shareImageFile(uri, msg!.title ?? '수익 인증', finalUrl);
            } catch {
              toast.error('이미지를 공유하지 못했어요');
            }
          })();
        }}
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
