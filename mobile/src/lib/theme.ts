/**
 * 테마 ID — 웹과 동일.
 * pokemon·onepiece·yugioh·sports = 픽셀 테마.
 * clean·dark = 플랫(논픽셀) 모던 테마 (웹 cardvault-trade / cardvault-cyber 프로토타입).
 */
export type ThemeId = 'pokemon' | 'onepiece' | 'yugioh' | 'sports' | 'clean' | 'dark';

export const THEMES: ReadonlyArray<{ id: ThemeId; label: string; desc: string }> = [
  { id: 'pokemon',  label: '포켓몬스터',  desc: '몬스터볼 + 빨강·노랑 (픽셀)' },
  { id: 'onepiece', label: '원피스',  desc: '밀짚모자 + 해적 깃발 클래식' },
  { id: 'yugioh',   label: '유희왕',  desc: '천년 퍼즐 + 황금 클래식 (세리프)' },
  { id: 'sports',   label: '스포츠',  desc: '스코어보드 + 잔디·스타디움 톤' },
  { id: 'clean',    label: '클린',  desc: '깔끔·모던 (기본)' },
  { id: 'dark',     label: '다크',  desc: '네온 글로우 다크 모드 (모던)' },
];

// 웹(src/lib/theme.ts)과 동일 — 기본 테마는 clean (패리티).
export const DEFAULT_THEME: ThemeId = 'clean';
export const THEME_STORAGE_KEY = 'pokefesta-theme';

export function isThemeId(v: unknown): v is ThemeId {
  return (
    v === 'pokemon' ||
    v === 'onepiece' ||
    v === 'yugioh' ||
    v === 'sports' ||
    v === 'clean' ||
    v === 'dark'
  );
}

/**
 * "플랫(논픽셀)" 테마 여부 — clean·dark 는 픽셀 프레임 대신
 * 라운드/직각 + 라인보더(모던) 외형을 쓴다. 픽셀 컴포넌트가 이 헬퍼로 분기.
 */
export function isFlatTheme(t: ThemeId): boolean {
  return t === 'clean' || t === 'dark';
}
