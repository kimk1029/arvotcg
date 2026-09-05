// Gradle JVM 메모리 — lint 가 기본값으로 죽는 것을 막는다 (2026-09-06 실측).
//  `expo prebuild` 가 만드는 기본값은 `-Xmx2048m -XX:MaxMetaspaceSize=512m` 인데,
//  release 빌드의 `lintVitalAnalyzeRelease` 가 react-native-screens /
//  react-native-gesture-handler 를 분석하다 `OutOfMemoryError: Metaspace` 로 죽는다.
//  (UAST 로 Kotlin 을 파싱하면서 클래스 메타데이터가 512m 를 넘긴다.)
// android/ 는 prebuild 산출물(gitignore)이라 config plugin 으로 매 prebuild 마다 적용한다.
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'org.gradle.jvmargs';
const VALUE = '-Xmx4096m -XX:MaxMetaspaceSize=1536m -Dfile.encoding=UTF-8';

module.exports = (config) =>
  withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter((p) => !(p.type === 'property' && p.key === KEY));
    c.modResults.push({ type: 'property', key: KEY, value: VALUE });
    return c;
  });
