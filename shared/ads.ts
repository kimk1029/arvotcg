/**
 * 구글 애드몹 설정 정본 — 앱(Expo RN) 전용.
 *
 * 웹에는 적용하지 않는다(애드몹은 모바일 SDK 전용, 웹은 애드센스로 별개).
 * 웹↔앱 패리티 예외이며 사유는 이 주석과 커밋에 남긴다.
 *
 * **개발·시뮬레이터에서는 반드시 테스트 단위를 쓴다.** 실제 광고 단위로 자기 광고를
 * 띄우면 무효 트래픽으로 계정이 정지될 수 있다.
 */

/** 구글이 공개한 테스트 값 — 실제 수익과 무관하고 항상 채워진다. */
export const ADMOB_TEST = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  banner: {
    android: 'ca-app-pub-3940256099942544/6300978111',
    ios: 'ca-app-pub-3940256099942544/2934735716',
  },
} as const;

export type AdPlatform = 'android' | 'ios';

/**
 * 애드몹 콘솔에서 발급받은 실제 값.
 * appId 는 플랫폼별로 별개의 앱 항목이라 각각 발급받아야 한다(물결표 `~` 포함).
 * null = 아직 미발급 → 테스트 값으로 대체된다.
 */
export const ADMOB_APP_ID: Record<AdPlatform, string | null> = {
  // TODO: 안드로이드 앱 ID 미발급 — 애드몹 > 앱 > 안드로이드 앱 > 앱 설정에서 확인.
  android: 'ca-app-pub-8606099213555265~7191313009',
  ios: 'ca-app-pub-8606099213555265~3547581465',
};

/** 배너형 광고1 — 슬래시 `/` 로 구분되는 광고 단위 ID. */
export const ADMOB_BANNER_UNIT: Record<AdPlatform, string | null> = {
  android: 'ca-app-pub-8606099213555265/9414151669',
  ios: 'ca-app-pub-8606099213555265/8371572277',
};

/** 앱 ID 형식은 `ca-app-pub-<16자리>~<10자리>`. */
export function isValidAppId(v: unknown): v is string {
  return typeof v === 'string' && /^ca-app-pub-\d{16}~\d{10}$/.test(v);
}

/** 광고 단위 형식은 `ca-app-pub-<16자리>/<10자리>`. */
export function isValidUnitId(v: unknown): v is string {
  return typeof v === 'string' && /^ca-app-pub-\d{16}\/\d{10}$/.test(v);
}

/**
 * 실제로 붙일 배너 단위 ID.
 * `useTest` 면(개발 빌드) 테스트 단위를, 아니면 발급받은 단위를 쓴다.
 * 발급 전이거나 형식이 깨졌으면 테스트 단위로 떨어뜨려 광고 자리가 비지 않게 한다.
 */
export function bannerUnitId(platform: AdPlatform, useTest: boolean): string {
  if (useTest) return ADMOB_TEST.banner[platform];
  const real = ADMOB_BANNER_UNIT[platform];
  return isValidUnitId(real) ? real : ADMOB_TEST.banner[platform];
}

/** app.json 에 넣을 앱 ID. 미발급이면 테스트 앱 ID (빌드는 되지만 수익은 안 난다). */
export function appIdFor(platform: AdPlatform): string {
  const real = ADMOB_APP_ID[platform];
  return isValidAppId(real) ? real : ADMOB_TEST.appId;
}

/** 실제 수익용 값이 모두 갖춰졌는가 — 스토어 빌드 전에 확인하는 용도. */
export function adsReadyForRelease(platform: AdPlatform): boolean {
  return isValidAppId(ADMOB_APP_ID[platform]) && isValidUnitId(ADMOB_BANNER_UNIT[platform]);
}
