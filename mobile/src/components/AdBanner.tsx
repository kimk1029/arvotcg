/**
 * 애드몹 배너 — 화면 하단에 고정하지 않고, 각 화면의 섹션 사이에 콘텐츠처럼 끼워 넣는다.
 * 크기는 320×100 고정이며 로드 전부터 그 높이를 예약한다(늦게 떠서 레이아웃이 밀리지 않게).
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

/** 배너 고정 규격 — LARGE_BANNER 320×100 (웹 AdFit 320×100 과 동일). 어댑티브는 높이가 기기마다 달라 예약이 안 된다. */
export const AD_BANNER_W = 320;
export const AD_BANNER_H = 100;
const CARD_PAD_V = 8;
const LABEL_H = 14;

export function AdBanner({ marginHorizontal = 14, marginTop = 0, marginBottom = 12, bare = false }: Props) {
  const tc = useThemeColors();
  // 첫 렌더부터 자리를 확보해야 하므로 SDK 존재 여부를 동기적으로 판단한다(useState 초기화).
  const [mod] = useState<AdsModule | null>(() => loadAds());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!mod || initStarted) return;
    initStarted = true;
    // 실패해도 앱은 계속 떠야 한다 — 광고만 안 나온다.
    mod.default().initialize().catch(() => {});
  }, [mod]);

  // SDK 없음(구 바이너리)·웹 → 처음부터 자리를 차지하지 않는다(나중에 생기지도 않으므로 밀림 없음).
  if (!mod || Platform.OS === 'web') return null;

  const { BannerAd, BannerAdSize } = mod;
  // 로드 전에도 정확히 배너 높이만큼 차지하고 있다가 그 자리에 뜬다 — 늦게 로드돼 아래 콘텐츠가 밀리던 문제(2026-09-12).
  // 로드 실패 시에도 높이를 유지한다(줄어들면 그것도 밀림).
  const slot = (
    <View style={{ width: '100%', height: AD_BANNER_H, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {!failed ? (
        <BannerAd
          unitId={bannerUnitId(platform, useTestUnit)}
          size={BannerAdSize.LARGE_BANNER}
          onAdFailedToLoad={() => setFailed(true)}
        />
      ) : null}
    </View>
  );

  if (bare) return slot;

  return (
    <View style={{ marginHorizontal, marginTop, marginBottom, height: LABEL_H + CARD_PAD_V * 2 + AD_BANNER_H }}>
      {/* 광고임을 밝히는 작은 라벨 — 콘텐츠로 오인하지 않게 하는 최소 표기. */}
      <PixelText variant="ko" size={8} color={tc.ink3} style={{ height: LABEL_H, marginLeft: 2, letterSpacing: 0.3 }}>
        광고
      </PixelText>
      <View style={{ overflow: 'hidden', borderRadius: 14, backgroundColor: tc.white, paddingVertical: CARD_PAD_V }}>
        {slot}
      </View>
    </View>
  );
}
