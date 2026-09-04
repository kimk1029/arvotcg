// Play Console "R8 최적화" 권장조치 대응 (2026-09-05).
//  - RN 템플릿의 release proguardFiles 는 `proguard-android.txt` 인데 이 파일은 `-dontoptimize` 를
//    포함해 R8 코드 최적화가 꺼진 상태로 빌드된다 → `proguard-android-optimize.txt` 로 교체.
//  - AGP 8.x 의 최적화 리소스 축소(`android.r8.optimizedShrinking`) 를 켠다 (AGP 9 에선 기본값).
// android/ 는 prebuild 산출물(gitignore)이라 config plugin 으로 매 prebuild 마다 적용한다.
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const FROM = 'getDefaultProguardFile("proguard-android.txt")';
const TO = 'getDefaultProguardFile("proguard-android-optimize.txt")';

function withOptimizeProguard(config) {
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') return c;
    if (c.modResults.contents.includes(FROM)) {
      c.modResults.contents = c.modResults.contents.replace(FROM, TO);
    } else if (!c.modResults.contents.includes(TO)) {
      console.warn('[withR8Optimize] proguardFiles 라인을 찾지 못해 최적화 규칙을 적용하지 못했습니다.');
    }
    return c;
  });
}

function withOptimizedShrinking(config) {
  return withGradleProperties(config, (c) => {
    const key = 'android.r8.optimizedShrinking';
    c.modResults = c.modResults.filter((p) => !(p.type === 'property' && p.key === key));
    c.modResults.push({ type: 'property', key, value: 'true' });
    return c;
  });
}

module.exports = (config) => withOptimizedShrinking(withOptimizeProguard(config));
