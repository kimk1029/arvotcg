/**
 * 애드몹 배너.
 *
 * **네이티브 모듈을 절대 top-level import 하지 않는다.** OTA 는 구 스토어 빌드
 * (1.1.3·1.1.4·1.1.5 — 광고 SDK 가 없는 바이너리)에도 내려가므로, import 하면
 * 그 기기에서 앱이 즉시 종료된다(2026-09-06 expo-application 사고와 같은 형태).
 * lazy require + try/catch 로 감싸고, 모듈이 없으면 아무것도 그리지 않는다.
 */
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { adsReadyForRelease, bannerUnitId } from '@/lib/ads';

type AdsModule = typeof import('react-native-google-mobile-ads');

let cached: AdsModule | null | undefined;
let initStarted = false;

/** 광고 SDK 가 이 바이너리에 있으면 돌려주고, 없으면 null. 한 번만 시도한다. */
function loadAds(): AdsModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    cached = null; // 구 바이너리 — 광고 없이 그대로 동작한다.
  }
  return cached;
}

const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';

// 개발 빌드는 물론, 실제 값이 덜 갖춰진 플랫폼도 테스트 단위를 쓴다.
// (앱 ID 가 테스트 값인 채로 실제 광고 단위를 부르면 노출이 아예 안 붙는다.)
const useTestUnit = __DEV__ || !adsReadyForRelease(platform);

export function AdBanner({ marginVertical = 10 }: { marginVertical?: number }) {
  const [mod, setMod] = useState<AdsModule | null>(null);
  const [failed, setFailed] = useState(false);

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

  // SDK 없음(구 바이너리)·웹·로드 실패 → 자리를 차지하지 않는다.
  if (!mod || failed || Platform.OS === 'web') return null;

  const { BannerAd, BannerAdSize } = mod;
  return (
    <View style={{ alignItems: 'center', marginVertical }}>
      <BannerAd
        unitId={bannerUnitId(platform, useTestUnit)}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
