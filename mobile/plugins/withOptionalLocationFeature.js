/**
 * 위치 하드웨어를 '선택' 기능으로 선언한다.
 *
 * expo-location 이 ACCESS_FINE_LOCATION 을 넣으면 Play 가 android.hardware.location(.gps) 을
 * 필수 기능으로 유추해 GPS 없는 기기(태블릿 등)를 지원 목록에서 뺀다 — 1.1.8 vc36 출시에서
 * 기기 7대 미지원 경고(2026-09-12). 카드샵 '내 주변'은 위치가 없어도 전체 프레이밍으로 동작하므로
 * required="false" 로 선언해 기기 지원 범위를 이전(1.1.6)과 같게 유지한다.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const FEATURES = ['android.hardware.location', 'android.hardware.location.gps', 'android.hardware.location.network'];

module.exports = function withOptionalLocationFeature(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const list = (manifest['uses-feature'] = manifest['uses-feature'] || []);
    for (const name of FEATURES) {
      const existing = list.find((f) => f.$?.['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else list.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
