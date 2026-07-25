/**
 * 하단 네비게이션(탭바) 스타일 설정 — 웹 src/lib/navPrefs.ts 와 동일 컨셉.
 * - 'floating'(분리형, 기본): 양옆/아래 여백을 두고 둥글게 떠 있는 단일 플로팅 바.
 * - 'integrated'(통합형): 하단에 꽉 찬 고정 탭바.
 */
import { getString, setString } from '@/lib/kvStore';

export type NavStyle = 'integrated' | 'floating';

export const NAV_STYLE_KEY = 'pf30:navStyle';
// 웹과 동일하게 신규 사용자 기본은 플로팅. (저장된 설정이 있으면 그대로 유지)
export const DEFAULT_NAV_STYLE: NavStyle = 'floating';

export function loadNavStyle(): NavStyle {
  const v = getString(NAV_STYLE_KEY);
  return v === 'floating' || v === 'integrated' ? v : DEFAULT_NAV_STYLE;
}

export function saveNavStyle(s: NavStyle): void {
  setString(NAV_STYLE_KEY, s);
}
