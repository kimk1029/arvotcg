/**
 * RN 오토링킹 오버라이드 (expo-modules-autolinking `react-native-config` 도 이 파일을 읽는다).
 *
 * Apple Silicon 시뮬레이터 개발 빌드 전용 스위치 — Google ML Kit(8.0.0) iOS 프레임워크는
 * arm64 슬라이스가 기기용뿐이라(EXCLUDED_ARCHS[sdk=iphonesimulator*]=arm64) MLKit 이 링크되면
 * arm64 시뮬레이터 빌드가 불가능하다(x86_64 만 나와 설치 거부). 로컬 시뮬레이터에서는
 * ML Kit 네이티브 모듈을 빼고 빌드한다 — 카드 스캔 OCR 은 서버 OCR 이 기본이라 개발에 지장 없음.
 *
 *   SIM_NO_MLKIT=1 npx pod-install   # 또는 SIM_NO_MLKIT=1 npx expo run:ios
 *
 * EAS/스토어 빌드는 이 env 가 없으므로 영향 없다. 실기기 스캔 테스트는 env 없이 pod install.
 */
const noMlkit = process.env.SIM_NO_MLKIT === '1';
// OTA 재현용 — 광고 SDK 가 없는 구 스토어 바이너리(1.1.3·1.1.4·1.1.5 vc28 이하)와 같은
// 네이티브 구성으로 로컬 빌드한다: NO_ADS=1 ./gradlew assembleRelease (EAS 빌드엔 이 env 없음).
const noAds = process.env.NO_ADS === '1';

module.exports = {
  dependencies: {
    ...(noMlkit ? { '@react-native-ml-kit/text-recognition': { platforms: { ios: null } } } : {}),
    ...(noAds ? { 'react-native-google-mobile-ads': { platforms: { android: null, ios: null } } } : {}),
  },
};
