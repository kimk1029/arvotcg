/**
 * 앱이 붙을 백엔드 오리진 결정 — [[/shared/apiEndpoints.ts]] 정본을 빌드 env 와 이어준다.
 *
 * 빌드 프로파일별 동작 (mobile/eas.json):
 *   eas build --profile stage       → EXPO_PUBLIC_APP_ENV=stage → NAS(Synology)
 *   eas build --profile production  → EXPO_PUBLIC_API_ORIGIN_PROD(있으면) → 없으면 NAS 폴백
 *
 * 로컬 dev 는 종전대로 EXPO_PUBLIC_API_BASE_URL 로 덮어쓴다 (최우선).
 *
 * 주의: Expo 는 `process.env.EXPO_PUBLIC_*` 를 **정적 표현식일 때만** 번들에 인라인한다.
 * 반드시 아래처럼 통째로 써야 하며, 구조분해나 동적 인덱싱으로 바꾸면 값이 사라진다.
 */
import {
  resolveApiEnv,
  resolveApiOrigin,
  type ApiEnv,
} from '../../../shared/apiEndpoints';

export type { ApiEnv };

/** 현재 빌드가 stage 인지 production 인지. */
export function getApiEnv(): ApiEnv {
  return resolveApiEnv(process.env.EXPO_PUBLIC_APP_ENV);
}

/** stage 빌드 여부 — 디버그 배너 등에서 사용. */
export function isStageBuild(): boolean {
  return getApiEnv() === 'stage';
}

/** 최종 API 오리진 (뒤 슬래시 없음). */
export function getApiOrigin(): string {
  return resolveApiOrigin({
    explicitOverride: process.env.EXPO_PUBLIC_API_BASE_URL,
    appEnv: process.env.EXPO_PUBLIC_APP_ENV,
    productionOrigin: process.env.EXPO_PUBLIC_API_ORIGIN_PROD,
  });
}
