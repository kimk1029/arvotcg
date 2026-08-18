export type ThemeId = 'pokemon' | 'onepiece' | 'yugioh' | 'sports' | 'clean' | 'dark';

export const THEMES: ReadonlyArray<{
  id: ThemeId;
  label: string;
  desc: string;
}> = [
  {
    id: 'pokemon',
    label: '레드 픽셀',
    desc: '빨강·노랑 도트 (픽셀)',
  },
  {
    id: 'onepiece',
    label: '파이럿',
    desc: '해적 깃발 클래식',
  },
  {
    id: 'yugioh',
    label: '골드 클래식',
    desc: '황금 세리프 클래식',
  },
  {
    id: 'sports',
    label: '스포츠',
    desc: '스코어보드 + 잔디·스타디움 톤',
  },
  {
    id: 'clean',
    label: '클린',
    desc: '깔끔·모던 (기본)',
  },
  {
    id: 'dark',
    label: '다크',
    desc: '네온 글로우 다크 모드 (모던)',
  },
] as const;

export const DEFAULT_THEME: ThemeId = 'clean';
export const THEME_STORAGE_KEY = 'pokefesta-theme';

/**
 * "플랫(논픽셀)" 테마 여부 — clean·dark 는 라운드+소프트(모던),
 * yugioh 는 세리프+골드 프레임, onepiece 는 해적 깃발+양피지(클래식)로,
 * 모두 픽셀 프레임/아이콘을 쓰지 않는다. 인라인 스타일 분기에서 이 헬퍼로 판정.
 */
export function isFlatTheme(t: ThemeId): boolean {
  return t === 'clean' || t === 'dark' || t === 'yugioh' || t === 'onepiece';
}

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
