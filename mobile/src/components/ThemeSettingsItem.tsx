import { useState } from 'react';
import { Modal, Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme, useThemeColors } from './ThemeProvider';
import { PixelText } from './PixelText';
import { isFlatTheme, THEMES, type ThemeId } from '@/lib/theme';
import { fonts } from '@/theme/tokens';

const SWATCH_BG: Record<ThemeId, string> = {
  pokemon: '#E63946',
  onepiece: '#F4D272',
  yugioh: '#FFD23F',
  sports: '#16A34A',
  clean: '#1A1D24',
  dark: '#0A0D13',
};
const SWATCH_DOT: Record<ThemeId, string> = {
  pokemon: '#FFFFFF',
  onepiece: '#E63946',
  yugioh: '#7C3AED',
  sports: '#FFFFFF',
  clean: '#F23645',
  dark: '#36C5FF',
};

/** 마이페이지 설정 — 테마 행 + 모달 픽커. 클린/다크는 플랫(무테·라운드·소프트 섀도). */
export function ThemeSettingsItem() {
  const { theme, setTheme } = useTheme();
  const tc = useThemeColors();
  const flat = isFlatTheme(theme);
  const [open, setOpen] = useState(false);
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  const iconBox = (bg: string): ViewStyle => ({
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: bg,
    borderWidth: flat ? 0 : 2,
    borderColor: tc.ink,
    borderRadius: flat ? 10 : 0,
  });
  const dotSt = (bg: string): ViewStyle => ({ width: 10, height: 10, backgroundColor: bg, borderRadius: flat ? 5 : 0 });
  const modalSt: ViewStyle = flat
    ? { backgroundColor: tc.paper, padding: 16, minWidth: 280, maxWidth: 360, borderRadius: 18, shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 8 }, shadowRadius: 24, elevation: 8 }
    : { backgroundColor: tc.paper, padding: 16, minWidth: 280, maxWidth: 360, shadowColor: tc.ink, shadowOpacity: 1, shadowOffset: { width: 5, height: 5 }, shadowRadius: 0, elevation: 8 };
  const tileSt = (active: boolean): ViewStyle => flat
    ? { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: active ? tc.goldSoft : tc.white, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: active ? tc.goldDk : tc.pap3 }
    : { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: active ? tc.gold : tc.white, paddingVertical: 10, paddingHorizontal: 10, shadowColor: tc.ink, shadowOpacity: 1, shadowOffset: { width: 2, height: 2 }, shadowRadius: 0, elevation: 1 };
  const modalTitleSt: TextStyle = flat
    ? { fontSize: 16, fontWeight: '800', color: tc.ink }
    : { fontFamily: fonts.pixel, fontSize: 14, color: tc.ink };
  const modalHintSt: TextStyle = flat
    ? { fontSize: 12, fontWeight: '500', color: tc.ink3, marginTop: 6 }
    : { fontFamily: fonts.pixel, fontSize: 9, color: tc.ink3, marginTop: 6 };
  const labelSt: TextStyle = flat
    ? { fontSize: 13, fontWeight: '700', color: tc.ink }
    : { fontFamily: fonts.pixel, fontSize: 11, color: tc.ink, letterSpacing: 0.3 };
  const tileDescSt: TextStyle = flat
    ? { fontSize: 11, fontWeight: '500', color: tc.ink3, marginTop: 3 }
    : { fontFamily: fonts.pixel, fontSize: 8, color: tc.ink3, marginTop: 4 };
  const tileCheckSt: TextStyle = flat
    ? { fontSize: 14, fontWeight: '800', color: tc.ink }
    : { fontFamily: fonts.pixel, fontSize: 12, color: tc.ink };

  return (
    <>
      <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 }} onPress={() => setOpen(true)}>
        <View style={iconBox(SWATCH_BG[theme])}>
          <View style={dotSt(SWATCH_DOT[theme])} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText variant="ko" size={12} color={tc.ink} weight="bold" numberOfLines={1}>
            테마
          </PixelText>
          <PixelText variant="ko" size={10} color={tc.ink3} style={{ marginTop: 2 }} numberOfLines={1}>
            {current.label}
          </PixelText>
        </View>
        {flat ? (
          <Text style={{ fontSize: 18, fontWeight: '600', color: tc.ink3, lineHeight: 20 }}>›</Text>
        ) : (
          <PixelText variant="pixel" size={12} color={tc.ink3}>▶</PixelText>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 }} onPress={() => setOpen(false)}>
          <Pressable style={modalSt} onPress={(e) => e.stopPropagation()}>
            <Text style={modalTitleSt}>테마 선택</Text>
            <Text style={modalHintSt}>선택 즉시 반영. 다음 방문에도 유지.</Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              {THEMES.map((t) => {
                const active = t.id === theme;
                return (
                  <Pressable
                    key={t.id}
                    style={tileSt(active)}
                    onPress={() => {
                      setTheme(t.id);
                      setOpen(false);
                    }}
                  >
                    <View style={iconBox(SWATCH_BG[t.id])}>
                      <View style={dotSt(SWATCH_DOT[t.id])} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={labelSt}>{t.label}</Text>
                      <Text style={tileDescSt}>{t.desc}</Text>
                    </View>
                    {active && <Text style={tileCheckSt}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
