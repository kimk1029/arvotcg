/**
 * API 엔드포인트 정본 — 웹·앱이 공통으로 쓰는 백엔드 오리진 표.
 *
 *   stage      = NAS (Synology, DSM 리버스 프록시 :3031 → 도커/pm2 :3030)
 *   production = Vultr (이전 완료 전까지 NAS 로 폴백)
 *
 * 전환은 [[migration-order-web-then-app]] 규칙을 따른다:
 *   새 엔드포인트 실측 → 웹 적용·성공 확정 → 앱 반영.
 * Vultr 오리진이 확정되면 코드를 고칠 필요 없이 빌드 env 로 주입한다
 * (앱: eas.json `EXPO_PUBLIC_API_ORIGIN_PROD`, 웹: Vercel `API_ORIGIN_PROD`).
 * 완전히 이전이 끝나면 PRODUCTION_API_ORIGIN_FALLBACK 만 교체하면 된다.
 */

/** NAS(Synology). stage 빌드가 항상 여기로 붙는다. */
export const STAGE_API_ORIGIN = 'https://kimk1029.synology.me:3031';

/**
 * production 빌드의 기본 오리진.
 * Vultr 인스턴스/도메인이 확정되기 전까지는 NAS 와 같다 —
 * 즉 이 커밋만으로는 운영 동작이 바뀌지 않는다(무해한 전환 준비).
 */
export const PRODUCTION_API_ORIGIN_FALLBACK = STAGE_API_ORIGIN;

export type ApiEnv = 'production' | 'stage';

/** 뒤쪽 슬래시 제거 — 경로를 이어붙이는 쪽에서 `//` 가 생기지 않게. */
export function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, '');
}

/** 빌드 env 문자열 → ApiEnv. 'stage' 외에는 전부 production 으로 본다. */
export function resolveApiEnv(appEnv?: string | null): ApiEnv {
  return appEnv === 'stage' ? 'stage' : 'production';
}

/**
 * 오리진 결정. 우선순위:
 *   1. explicitOverride — 로컬 dev·수동 지정 (EXPO_PUBLIC_API_BASE_URL / NEXT_PUBLIC_API_ORIGIN)
 *   2. appEnv === 'stage' → NAS
 *   3. productionOrigin (빌드 env 주입) → 없으면 PRODUCTION_API_ORIGIN_FALLBACK
 */
export function resolveApiOrigin(opts: {
  explicitOverride?: string | null;
  appEnv?: string | null;
  productionOrigin?: string | null;
}): string {
  const { explicitOverride, appEnv, productionOrigin } = opts;
  if (explicitOverride) return normalizeOrigin(explicitOverride);
  if (resolveApiEnv(appEnv) === 'stage') return STAGE_API_ORIGIN;
  if (productionOrigin) return normalizeOrigin(productionOrigin);
  return PRODUCTION_API_ORIGIN_FALLBACK;
}
