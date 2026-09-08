/**
 * 히어로 배너 공통 규칙 — 서버(/api/banners·어드민 설정)·웹 HeroSlider·앱 HeroBanner 정본.
 *
 * 슬라이드 순서는 어드민 sortOrder(작을수록 먼저) → id 순이며 클라이언트는 절대 재정렬하지 않는다.
 * 자동 전환 간격은 어드민(히어로 배너 관리)에서 조절하고 SiteSetting `hero.autoplayMs` 에 저장된다.
 */

/** 기본 전환 간격 — 5초 (2026-09-08 사용자 지시: 7초 → 5초. 그 전 3.5~4초는 너무 빠름). */
export const HERO_AUTOPLAY_DEFAULT_MS = 5000;
export const HERO_AUTOPLAY_MIN_MS = 2000;
export const HERO_AUTOPLAY_MAX_MS = 60000;
/** SiteSetting 키. */
export const HERO_AUTOPLAY_SETTING_KEY = 'hero.autoplayMs';

/** 임의 입력(문자열/숫자/undefined) → 유효 범위의 정수 ms. 파싱 실패는 기본값. */
export function clampHeroAutoplayMs(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return HERO_AUTOPLAY_DEFAULT_MS;
  return Math.min(HERO_AUTOPLAY_MAX_MS, Math.max(HERO_AUTOPLAY_MIN_MS, Math.round(n)));
}
