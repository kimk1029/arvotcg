/**
 * 포인트 기반 레벨 계산 — 더미(MY_PROFILE) 대체용.
 * - 레벨당 500 포인트 필요 (선형)
 * - 최대 레벨 10
 */

export interface LevelInfo {
  level: number;
  /** 현재 레벨 구간 내에서 누적된 포인트 (0 ~ xpNeeded) */
  xp: number;
  /** 다음 레벨까지 필요한 포인트 (항상 BASE) */
  xpNeeded: number;
  title: string;
  maxLevel: number;
}

const BASE = 500;
const MAX_LEVEL = 10;

const TITLES = [
  '루키 컬렉터',       // LV.1
  '새내기 컬렉터',     // LV.2
  '중급 컬렉터',       // LV.3
  '정예 컬렉터',       // LV.4
  '베테랑 컬렉터',     // LV.5
  '엘리트 컬렉터',     // LV.6
  '챔피언 컬렉터',     // LV.7
  '레어 헌터',         // LV.8
  'TCG 마스터',        // LV.9
  '아르보TCG 레전드',     // LV.10
];

export function levelFromPoints(points: number): LevelInfo {
  const p = Math.max(0, Math.floor(points));
  const rawLevel = Math.floor(p / BASE) + 1;
  const level = Math.min(MAX_LEVEL, rawLevel);
  const xp = level >= MAX_LEVEL ? BASE : p % BASE;
  return {
    level,
    xp,
    xpNeeded: BASE,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    maxLevel: MAX_LEVEL,
  };
}
