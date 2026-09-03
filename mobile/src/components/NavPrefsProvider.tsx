import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_NAV_STYLE, loadNavStyle, saveNavStyle, type NavStyle } from '@/lib/navPrefs';

/** 플로팅 탭바 도크 높이(바 70 + 아래 여백 12) — PhoneShell.floatDock 의 실제 점유 높이. */
export const FLOAT_NAV_BAR_H = 82;

interface Ctx {
  /** 하단 탭바 스타일 — 'integrated'(통합형, 기본) | 'floating'(분리형). */
  navStyle: NavStyle;
  setNavStyle: (s: NavStyle) => void;
  toggleNavStyle: () => void;
}

const NavPrefsCtx = createContext<Ctx | null>(null);

export function NavPrefsProvider({ children }: { children: ReactNode }) {
  // kvStore 는 동기 — 렌더 시점에 바로 복원해 깜빡임 없이 초기값 설정.
  const [navStyle, setState] = useState<NavStyle>(() => loadNavStyle());

  const setNavStyle = useCallback((s: NavStyle) => {
    setState(s);
    saveNavStyle(s);
  }, []);

  const toggleNavStyle = useCallback(() => {
    setState((prev) => {
      const next: NavStyle = prev === 'floating' ? 'integrated' : 'floating';
      saveNavStyle(next);
      return next;
    });
  }, []);

  return (
    <NavPrefsCtx.Provider value={{ navStyle, setNavStyle, toggleNavStyle }}>
      {children}
    </NavPrefsCtx.Provider>
  );
}

export function useNavPrefs(): Ctx {
  const v = useContext(NavPrefsCtx);
  if (!v) {
    return { navStyle: DEFAULT_NAV_STYLE, setNavStyle: () => undefined, toggleNavStyle: () => undefined };
  }
  return v;
}

/**
 * 플로팅(분리형) 탭바가 콘텐츠 위에 떠 있을 때 화면 하단이 바에 가리지 않도록
 * 확보해야 하는 여백(px). 통합형이면 0. 스크롤 콘텐츠의 paddingBottom, 또는
 * WebView 처럼 스크롤이 바 아래로 지나갈 수 없는 박스의 marginBottom 에 쓴다.
 * (웹 `.screen--floatnav{padding-bottom}` 과 같은 역할.)
 */
export function useFloatNavInset(): number {
  const { navStyle } = useNavPrefs();
  const insets = useSafeAreaInsets();
  return navStyle === 'floating' ? insets.bottom + FLOAT_NAV_BAR_H : 0;
}
