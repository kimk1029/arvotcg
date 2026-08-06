import { Pressable, Text, View } from 'react-native';
import { GAME_OPTIONS } from '@/lib/gamePrefs';
import { useGamePrefs } from './GamePrefsProvider';
import { PixelText } from './PixelText';
import { SETTINGS_ROW, useSettingsRow } from './settingsRow';

/**
 * 마이페이지 설정 — 카드 게임(포켓몬/원피스/유희왕/스포츠) 표시 토글 행 묶음.
 * 켠 게임만 홈 인기·박스 캐러셀과 시세확인(팩) 목록에 나온다.
 * 전부 켜면 모든 게임 카드가 함께 나오고, 최소 1개는 켜져 있어야 한다.
 */
export function GameFilterSettingsItem() {
  const { enabledGames, toggleGame } = useGamePrefs();
  const { tc, icon, track, knob } = useSettingsRow();

  return (
    <View>
      {GAME_OPTIONS.map((g, i) => {
        const on = enabledGames.includes(g.id);
        const last = on && enabledGames.length <= 1;
        return (
          <View key={g.id}>
            {i > 0 && <View style={{ height: 1, backgroundColor: tc.pap3, marginHorizontal: 14 }} />}
            <Pressable onPress={() => toggleGame(g.id)} style={[SETTINGS_ROW, last && { opacity: 0.6 }]}>
              <View style={icon(on ? tc.grn : tc.pap3)}>
                <Text style={{ fontSize: 16 }}>{g.emoji}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <PixelText variant="ko" size={12} color={tc.ink} weight="bold" numberOfLines={1}>
                  {g.label} 카드 보기
                </PixelText>
                <PixelText variant="ko" size={10} color={tc.ink3} style={{ marginTop: 2 }} numberOfLines={1}>
                  {last ? '켜짐 · 최소 1개는 켜져 있어야 해요' : on ? '켜짐 · 홈/시세 목록에 표시' : '꺼짐 · 목록에서 제외'}
                </PixelText>
              </View>
              {/* 토글 스위치 */}
              <View style={track(on ? tc.grn : tc.pap3)}>
                <View style={knob(on)} />
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
