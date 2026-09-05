/**
 * 강제 업데이트 게이트 — 서버가 `updateRequired` 를 주면 앱 전체를 덮는다.
 *
 * 판정은 서버(`/api/app-release`)가 하고 여기서는 결과만 그린다. 닫기·뒤로가기가
 * 없는 전면 오버레이라, 잘못 켜지면 앱을 못 쓰게 된다 — 그래서 판정 실패·네트워크
 * 오류는 전부 통과(fail-open)이고, 되돌리기는 서버 DB 의 `enforced=false` 다.
 *
 * 웹에는 대응 화면이 없다(플랫폼 특성 예외): 웹은 새로고침이 곧 최신이라 강제할
 * 구버전이라는 개념이 없다.
 */
import { useEffect, useState } from 'react';
import { BackHandler, Linking, Platform, Pressable, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { useThemeColors } from '@/components/ThemeProvider';
import { checkAppRelease, type AppReleaseCheck } from '@/lib/appRelease';

const DEFAULT_MESSAGE = '더 나은 사용을 위해 최신 버전으로 업데이트해 주세요.';

export function ForceUpdateGate() {
  const tc = useThemeColors();
  const [check, setCheck] = useState<AppReleaseCheck | null>(null);

  useEffect(() => {
    let alive = true;
    // 부팅 경로 — 어떤 실패도 앱을 막지 않는다(체크 실패 = 통과).
    checkAppRelease()
      .then((r) => {
        if (alive) setCheck(r);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const blocking = check?.updateRequired === true;

  // 안드로이드 뒤로가기로 빠져나가지 못하게 막는다(차단이 켜져 있는 동안만).
  useEffect(() => {
    if (!blocking) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [blocking]);

  if (!blocking) return null;

  const open = () => {
    const url =
      check?.storeUrl ??
      (Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/id6799868587'
        : 'https://play.google.com/store/apps/details?id=com.arvotcg.app');
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: tc.paper,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 14,
      }}
    >
      <PixelText variant="ko" size={40}>
        🚀
      </PixelText>
      <PixelText variant="ko" size={17} weight="bold" color={tc.ink} style={{ textAlign: 'center' }}>
        업데이트가 필요해요
      </PixelText>
      <PixelText
        variant="ko"
        size={13}
        color={tc.ink3}
        style={{ textAlign: 'center', lineHeight: 20 }}
      >
        {check?.message ?? DEFAULT_MESSAGE}
      </PixelText>
      {check?.version ? (
        <PixelText variant="ko" size={11} color={tc.ink3}>
          {`최신 버전 ${check.version}${check.latestBuild ? ` (${check.latestBuild})` : ''}`}
        </PixelText>
      ) : null}
      <Pressable
        onPress={open}
        style={{
          marginTop: 10,
          backgroundColor: tc.gold,
          paddingVertical: 14,
          paddingHorizontal: 34,
          borderRadius: 12,
        }}
      >
        <PixelText variant="ko" size={14} weight="bold" color={tc.ink}>
          {Platform.OS === 'ios' ? 'App Store 에서 업데이트' : 'Play 스토어에서 업데이트'}
        </PixelText>
      </Pressable>
    </View>
  );
}
