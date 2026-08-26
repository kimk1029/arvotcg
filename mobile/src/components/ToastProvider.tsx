import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/theme/tokens';
import { usePixelFont } from '@/components/ThemeProvider';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface Ctx {
  push: (message: string, kind?: ToastKind) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

const DURATION_MS = 2500;

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++seq;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DURATION_MS);
  }, []);

  const api: Ctx = {
    push,
    success: (msg) => push(msg, 'success'),
    error: (msg) => push(msg, 'error'),
    info: (msg) => push(msg, 'info'),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <View pointerEvents="none" style={styles.stack}>
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} />
        ))}
      </View>
    </ToastCtx.Provider>
  );
}

function ToastRow({ toast }: { toast: Toast }) {
  // 클린·다크는 시스템 산세리프 — 토스트가 픽셀 폰트로 남지 않게.
  const pixelFont = usePixelFont();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, DURATION_MS - 240);
    return () => clearTimeout(t);
  }, [opacity]);

  const bg =
    toast.kind === 'success'
      ? colors.grn
      : toast.kind === 'error'
        ? colors.red
        : colors.ink;
  const icon = toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '⚠' : 'ℹ';

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }]}>
      <Text style={[styles.icon, { fontFamily: pixelFont }]}>{icon}</Text>
      <Text style={[styles.msg, { fontFamily: pixelFont }]} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

export function useToast(): Ctx {
  const v = useContext(ToastCtx);
  if (!v) {
    return {
      push: () => undefined,
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
    };
  }
  return v;
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    top: 60,
    left: 12,
    right: 12,
    alignItems: 'center',
    gap: 6,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: '100%',
    // pixel-press 톤 ─ ink 그림자
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowOffset: { width: 3, height: 3 },
    shadowRadius: 0,
    elevation: 4,
  },
  icon: { color: colors.white, fontFamily: fonts.pixel, fontSize: 12 },
  msg: { color: colors.white, fontFamily: fonts.pixel, fontSize: 11, flexShrink: 1, letterSpacing: 0.3 },
});
