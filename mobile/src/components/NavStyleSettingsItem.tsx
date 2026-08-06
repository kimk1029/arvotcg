import { Pressable, Text, View } from 'react-native';
import { useNavPrefs } from './NavPrefsProvider';
import { PixelText } from './PixelText';
import { SETTINGS_ROW, useSettingsRow } from './settingsRow';

/**
 * 마이페이지 설정 — 하단 네비게이션 스타일 토글.
 * off(기본)=통합형(꽉 찬 고정 탭바) / on=분리형(둥근 플로팅 바).
 */
export function NavStyleSettingsItem() {
  const { navStyle, toggleNavStyle } = useNavPrefs();
  const { tc, icon, track, knob } = useSettingsRow();
  const on = navStyle === 'floating';

  return (
    <Pressable onPress={toggleNavStyle} style={SETTINGS_ROW}>
      <View style={icon(on ? tc.blu : tc.pap3)}>
        <Text style={{ fontSize: 16 }}>🧭</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <PixelText variant="ko" size={12} color={tc.ink} weight="bold" numberOfLines={1}>
          네비게이션 스타일
        </PixelText>
        <PixelText variant="ko" size={10} color={tc.ink3} style={{ marginTop: 2 }} numberOfLines={1}>
          {on ? '분리형 · 둥근 플로팅 바' : '통합형 · 꽉 찬 고정 탭바'}
        </PixelText>
      </View>
      <View style={track(on ? tc.blu : tc.pap3)}>
        <View style={knob(on)} />
      </View>
    </Pressable>
  );
}
