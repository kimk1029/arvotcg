import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_THEME,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
} from '@/lib/theme';
import { getString, setString } from '@/lib/kvStore';
import { colors, fonts } from '@/theme/tokens';
import { isFlatTheme } from '@/lib/theme';

interface Ctx {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

export const THEME_COLORS: Record<ThemeId, typeof colors> = {
  pokemon: colors,
  onepiece: {
    ...colors,
    red: '#D92332',
    redLt: '#FF6B6B',
    redDk: '#8F1620',
    yel: '#F4D272',
    yelLt: '#FCE6A8',
    yelDk: '#B8884B',
    gold: '#E5B85A',
    goldLt: '#F4D272',
    goldDk: '#7A5A2A',
    blu: '#1B6FB8',
    bluLt: '#4BA0E0',
    bluDk: '#0B3F70',
    grn: '#2FBF8F',
    grnLt: '#78E2BD',
    grnDk: '#0D6B55',
    orn: '#F4783D',
    ornLt: '#FFA070',
    ornDk: '#9B3B0A',
    bg: '#FBF1D9',
    paper: '#FBF1D9',
    pap2: '#F0DEAA',
    pap3: '#CDB57B',
    papdk: '#7E6A38',
    white: '#FFF8E5',
  },
  yugioh: {
    ...colors,
    red: '#7C3AED',
    redLt: '#A78BFA',
    redDk: '#4C1D95',
    blu: '#4C1D95',
    bluLt: '#7C3AED',
    bluDk: '#2E1065',
    ink: '#241437',
    ink2: '#3B0764',
    ink3: '#6B21A8',
    paper: '#F4E8FF',
    bg: '#F4E8FF',
    pap2: '#E9D5FF',
    pap3: '#C4B5FD',
    papdk: '#6D28D9',
    white: '#FFF7D6',
    gold: '#FFD23F',
    goldLt: '#FCE6A8',
    goldDk: '#B8860B',
    yel: '#FFD23F',
    yelLt: '#FCE6A8',
    yelDk: '#B8860B',
  },
  sports: {
    ...colors,
    red: '#DC2626',
    redLt: '#F87171',
    redDk: '#7F1D1D',
    yel: '#FACC15',
    yelLt: '#FEF08A',
    yelDk: '#A16207',
    gold: '#FACC15',
    goldLt: '#FEF08A',
    goldDk: '#A16207',
    blu: '#2563EB',
    bluLt: '#60A5FA',
    bluDk: '#1E3A8A',
    grn: '#16A34A',
    grnLt: '#86EFAC',
    grnDk: '#14532D',
    orn: '#F97316',
    ornLt: '#FDBA74',
    ornDk: '#9A3412',
    ink: '#111827',
    ink2: '#1F2937',
    ink3: '#4B5563',
    paper: '#F7F8EA',
    bg: '#F7F8EA',
    pap2: '#DDE7C7',
    pap3: '#B7C99A',
    papdk: '#647D3A',
  },
  // ─── CLEAN (cardvault-trade 프로토타입: 쿨 뉴트럴 + 브랜드 다크 + KR 주식색) ───
  clean: {
    ...colors,
    red: '#F23645', redLt: '#F76571', redDk: '#C81E2C',     // 상승=빨강
    blu: '#2F6BFF', bluLt: '#6B97FF', bluDk: '#1E4FD0',     // 하락=파랑
    grn: '#0E9C6E', grnLt: '#2BB888', grnDk: '#0A7A56',
    orn: '#E07B39', ornLt: '#EC9C68', ornDk: '#B85F22',
    pur: '#7C5CDB', purLt: '#A189EC', purDk: '#5C3FB0',
    gold: '#C8941E', goldLt: '#E0AC3C', goldDk: '#A2760F', goldSoft: '#FAF2DD',
    yel: '#C8941E', yelLt: '#E0AC3C', yelDk: '#A2760F',
    teal: '#0E9C6E',
    nav: '#1A1D24', navLt: '#363B45', navDk: '#11141A',     // 브랜드 다크(주 액센트)
    ink: '#11141A', ink2: '#3C424E', ink3: '#7C8595', ink4: '#A8AFBC',
    bg: '#F7F8FA', paper: '#FFFFFF', pap2: '#F7F8FA', pap3: '#EEF0F3', papdk: '#A8AFBC',
    white: '#FFFFFF',
  },
  // ─── DARK (cardvault-cyber 프로토타입: 네온 주식창, 상승=레드/하락=시안) ───
  dark: {
    ...colors,
    red: '#FF4D6D', redLt: '#FF7F97', redDk: '#C72847',     // 상승=네온레드
    blu: '#36C5FF', bluLt: '#7FDCFF', bluDk: '#1487C0',     // 하락=네온시안
    grn: '#5ED99B', grnLt: '#86F0BB', grnDk: '#1E7A52',
    orn: '#F5A45A', ornLt: '#FFC089', ornDk: '#B86E2E',
    pur: '#A78BFA', purLt: '#C7B2FF', purDk: '#6E4FC8',
    pnk: '#F472B6', pnkLt: '#F9A8D4', pnkDk: '#9D2463',
    gold: '#FFD45E', goldLt: '#FFE39A', goldDk: '#A8841E', goldSoft: '#2A2617',
    yel: '#FFD45E', yelLt: '#FFE39A', yelDk: '#A8841E',
    teal: '#5ED99B',
    nav: '#36C5FF', navLt: '#7FDCFF', navDk: '#1487C0',
    ink: '#F2F5FB', ink2: '#AEB6C6', ink3: '#6E7A90', ink4: '#454F61',
    bg: '#0A0D13', paper: '#0A0D13', pap2: '#10141D', pap3: '#232B3A', papdk: '#454F61',
    white: '#141925',
  },
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const stored = getString(THEME_STORAGE_KEY);
    if (isThemeId(stored)) setThemeState(stored);
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    setString(THEME_STORAGE_KEY, t);
  }, []);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  return useContext(ThemeCtx) ?? { theme: DEFAULT_THEME, setTheme: () => undefined };
}

export function useThemeColors() {
  const { theme } = useTheme();
  return THEME_COLORS[theme] ?? colors;
}

export function useThemeTextVariant(): 'pixel' | 'ko' {
  const { theme } = useTheme();
  // sports·clean·dark = 논픽셀(모던) 폰트
  return theme === 'sports' || theme === 'clean' || theme === 'dark' ? 'ko' : 'pixel';
}

/**
 * TextInput 등 직접 fontFamily 를 지정해야 하는 곳의 폰트.
 * 클린·다크(플랫 테마)는 시스템 산세리프(undefined) — 인풋과 placeholder 가
 * 비트맵 폰트로 남지 않게 한다. 픽셀 테마는 기존 갈무리 유지.
 */
export function useInputFont(): string | undefined {
  const { theme } = useTheme();
  return isFlatTheme(theme) ? undefined : fonts.ko;
}

/** 위와 같되 픽셀(Press Start 2P) 슬롯 — 토스트 등 디스플레이 텍스트용. */
export function usePixelFont(): string | undefined {
  const { theme } = useTheme();
  return isFlatTheme(theme) ? undefined : fonts.pixel;
}
