/**
 * API 엔드포인트 정본 — 웹·앱이 공통으로 쓰는 백엔드 오리진 표.
 *
 *   stage      = NAS (Synology, DSM 리버스 프록시 :3031 → 도커/pm2 :3030)
 *   production = Vultr (api.arvotcg.com) — 2026-08 이전 완료.
 *
 * 빌드 env(앱: eas.json `EXPO_PUBLIC_API_ORIGIN_PROD`, 웹: Vercel `API_ORIGIN_PROD`)가
 * 있으면 그 값이 우선하고, 없어도 아래 폴백이 Vultr 를 가리킨다.
 * KREAM 등 안티봇 스크레이핑은 Vultr 서버가 NAS 릴레이(KREAM_RELAY_ORIGIN)로 우회한다.
 */

/** NAS(Synology). stage 빌드가 항상 여기로 붙는다. */
export const STAGE_API_ORIGIN = 'https://kimk1029.synology.me:3031';

/** production 빌드의 기본 오리진 — Vultr (이전 완료 후 교체됨). */
export const PRODUCTION_API_ORIGIN_FALLBACK = 'https://api.arvotcg.com';

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
