/**
 * 애드몹 배너 — 화면 하단에 고정하지 않고, 각 화면의 섹션 사이에 콘텐츠처럼 끼워 넣는다.
 * 주변 카드와 같은 여백·모서리·배경을 써서 튀지 않게 한다.
 *
 * **네이티브 모듈을 절대 top-level import 하지 않는다.** OTA 는 구 스토어 빌드
 * (1.1.3·1.1.4·1.1.5 vc28 이하 — 광고 SDK 가 없는 바이너리)에도 내려가므로, import 하면
 * 그 기기에서 앱이 즉시 종료된다(2026-09-06 expo-application 사고와 같은 형태).
 *
 * **lazy require + try/catch 만으로는 부족하다 (2026-09-11 실측, 내 컬렉션 진입 시 종료).**
 * Metro 런타임의 최상위 `require`(다른 모듈 로딩 중이 아닐 때 = useEffect 안)는
 * `guardedLoadModule` 이 감싸는데, 모듈 팩토리가 던진 예외를 호출자에게 던지지 않고
 * `ErrorUtils.reportFatalError` 로 넘긴다 → try/catch 는 아무것도 못 잡고 치명 오류로 앱이 죽는다.
 * 그래서 require 하기 전에 `TurboModuleRegistry.get` 으로 네이티브 모듈 존재를 먼저 확인한다
 * (get 은 없으면 null, getEnforcing 과 달리 던지지 않는다).
 */
import { useEffect, useState } from 'react';
import { Platform, TurboModuleRegistry, View } from 'react-native';
import { PixelText } from './PixelText';
import { useThemeColors } from './ThemeProvider';
import { adsReadyForRelease, bannerUnitId } from '@/lib/ads';

type AdsModule = typeof import('react-native-google-mobile-ads');

let cached: AdsModule | null | undefined;
let initStarted = false;

/** 광고 SDK 가 이 바이너리에 있으면 돌려주고, 없으면 null. 한 번만 시도한다. */
function loadAds(): AdsModule | null {
  if (cached !== undefined) return cached;
  // 구 바이너리(광고 SDK 미포함) — require 자체를 하지 않는다. 패키지 index 가 로드되며
  // TurboModuleRegistry.getEnforcing('RNGoogleMobileAdsModule') 을 호출해 던지는데,
  // 그 예외는 위 설명대로 try/catch 로 잡히지 않는다.
  if (!TurboModuleRegistry.get('RNGoogleMobileAdsModule')) {
    cached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    cached = null;
  }
  return cached;
}

const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';

// 개발 빌드는 물론, 실제 값이 덜 갖춰진 플랫폼도 테스트 단위를 쓴다.
// (앱 ID 가 테스트 값인 채로 실제 광고 단위를 부르면 노출이 아예 안 붙는다.)
const useTestUnit = __DEV__ || !adsReadyForRelease(platform);

interface Props {
  /** 좌우 여백 — 그 화면의 다른 섹션과 같은 값을 준다. */
  marginHorizontal?: number;
  /** 위아래 여백 — 섹션 사이 간격에 맞춘다. */
  marginTop?: number;
  marginBottom?: number;
  /** 카드 배경·모서리를 끄고 배너만 놓는다(이미 카드 안에 넣는 경우). */
  bare?: boolean;
}

export function AdBanner({ marginHorizontal = 14, marginTop = 0, marginBottom = 12, bare = false }: Props) {
  const tc = useThemeColors();
  const [mod, setMod] = useState<AdsModule | null>(null);
  const [failed, setFailed] = useState(false);
  // 광고가 실제로 채워지기 전에는 자리를 차지하지 않는다 —
  // 먼저 빈 상자를 그리면 로딩 동안 섹션 사이에 구멍이 보인다(에뮬레이터 실측).
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const m = loadAds();
    if (!m) return;
    if (!initStarted) {
      initStarted = true;
      // 실패해도 앱은 계속 떠야 한다 — 광고만 안 나온다.
      m.default().initialize().catch(() => {});
    }
    setMod(m);
  }, []);

  // SDK 없음(구 바이너리)·웹·로드 실패 → 자리를 아예 차지하지 않는다.
  // 광고가 안 붙을 때 빈 상자가 남으면 그게 더 어색하다.
  if (!mod || failed || Platform.OS === 'web') return null;

  const { BannerAd, BannerAdSize } = mod;
  const ad = (
    <BannerAd
      unitId={bannerUnitId(platform, useTestUnit)}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      onAdLoaded={() => setLoaded(true)}
      onAdFailedToLoad={() => setFailed(true)}
    />
  );

  // 로딩 중에는 높이 0 으로 숨겨 둔다. 배너는 마운트돼 있어야 채워지므로 언마운트하지 않는다.
  if (!loaded) return <View style={{ height: 0, overflow: 'hidden' }}>{ad}</View>;

  if (bare) return <View style={{ alignItems: 'center' }}>{ad}</View>;

  return (
    <View style={{ marginHorizontal, marginTop, marginBottom }}>
      {/* 광고임을 밝히는 작은 라벨 — 콘텐츠로 오인하지 않게 하는 최소 표기. */}
      <PixelText variant="ko" size={8} color={tc.ink3} style={{ marginBottom: 4, marginLeft: 2, letterSpacing: 0.3 }}>
        광고
      </PixelText>
      <View
        style={{
          alignItems: 'center',
          overflow: 'hidden',
          borderRadius: 14,
          backgroundColor: tc.white,
          paddingVertical: 8,
        }}
      >
        {ad}
      </View>
    </View>
  );
}
