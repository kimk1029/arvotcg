import { Pressable, Text, View } from 'react-native';
import { useHomePrefs } from './HomePrefsProvider';
import { PixelText } from './PixelText';
import { SETTINGS_ROW, useSettingsRow } from './settingsRow';

/**
 * 마이페이지 설정 — "메인에 내 포트폴리오 보이기" 토글 행.
 * off(기본) 면 홈 메인에서 토탈 포트폴리오 hero 를 숨긴다.
 * (내 컬렉션 상단에는 이 설정과 무관하게 항상 노출.)
 */
export function ShowPortfolioSettingsItem() {
  const { showPortfolioOnMain, toggleShowPortfolioOnMain } = useHomePrefs();
  const { tc, icon, track, knob } = useSettingsRow();
  const on = showPortfolioOnMain;

  return (
    <Pressable onPress={toggleShowPortfolioOnMain} style={SETTINGS_ROW}>
      <View style={icon(on ? tc.grn : tc.pap3)}>
        <Text style={{ fontSize: 16 }}>📊</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <PixelText variant="ko" size={12} color={tc.ink} weight="bold" numberOfLines={1}>
          메인에 내 포트폴리오 보이기
        </PixelText>
        <PixelText variant="ko" size={10} color={tc.ink3} style={{ marginTop: 2 }} numberOfLines={1}>
          {on ? '켜짐 · 메인 상단에 표시' : '꺼짐 · 컬렉션 상단에서만 표시'}
        </PixelText>
      </View>
      {/* 토글 스위치 */}
      <View style={track(on ? tc.grn : tc.pap3)}>
        <View style={knob(on)} />
      </View>
    </Pressable>
  );
}
