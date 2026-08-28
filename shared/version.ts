/**
 * 앱 표시용 버전 — githooks/pre-commit 이 커밋마다 package.json patch +1 과 함께 자동 갱신.
 * 수동 수정 금지. (웹은 NEXT_PUBLIC_APP_VERSION 으로 package.json 을 직접 읽고,
 * 모바일은 Metro watchFolders 가 /shared 만 보므로 이 파일을 통해 같은 값을 읽는다.)
 */
export const APP_VERSION = "1.1.92";
