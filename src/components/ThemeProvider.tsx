'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import {
  applyThemeColorMeta,
  DEFAULT_THEME,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
} from '@/lib/theme';

type DocWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => unknown;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

interface Ctx {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const ThemeContext = createContext<Ctx | null>(null);

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // 부트스트랩 스크립트가 <html data-theme="..."> 를 미리 박아둠 → 그 값을 신뢰.
  useEffect(() => {
    const fromAttr = document.documentElement.getAttribute('data-theme');
    if (isThemeId(fromAttr)) {
      setThemeState(fromAttr);
      return;
    }
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeId(stored)) setThemeState(stored);
    } catch {
      /* private mode etc — defaults remain */
    }
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    // CSS 변수(data-theme) 교체 + React 상태(useTheme 구독 컴포넌트)를 한 번에 반영.
    const apply = () => {
      // flushSync 로 동기 커밋해야 View Transition 의 "after" 스냅샷에 새 테마가 잡힘.
      flushSync(() => setThemeState(t));
      document.documentElement.setAttribute('data-theme', t);
      applyThemeColorMeta(t);
    };

    const doc = document as DocWithViewTransition;
    if (typeof doc.startViewTransition === 'function' && !prefersReducedMotion()) {
      // 이전 화면 → 새 테마 화면으로 부드럽게 크로스페이드(디졸브).
      doc.startViewTransition(apply);
    } else {
      apply();
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* ignore — UI still updates this session */
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
