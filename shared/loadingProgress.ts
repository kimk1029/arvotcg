/**
 * 로딩 퍼센트 시뮬레이션 정본 (웹·모바일 공용).
 *
 * 실제 네트워크 진행률을 알 수 없는 로딩 화면에서 쓰는 의사-진행률:
 * 처음엔 빠르게 오르다가 점점 느려지며 {@link LOADING_PROGRESS_CAP}(99%)에서 멈춘다.
 * 100%는 절대 시뮬레이션으로 도달하지 않는다 — 실제 로딩이 끝나 화면이 전환되는
 * 시점에만 100을 표시(또는 즉시 언마운트)한다.
 */
export const LOADING_PROGRESS_CAP = 99;
export const LOADING_PROGRESS_TICK_MS = 120;

/** 한 틱 진행: 남은 거리의 7%씩, 최소 0.4씩 전진 (cap에서 수렴). */
export function stepLoadingProgress(current: number): number {
  const next = current + Math.max(0.4, (LOADING_PROGRESS_CAP - current) * 0.07);
  return Math.min(LOADING_PROGRESS_CAP, next);
}
