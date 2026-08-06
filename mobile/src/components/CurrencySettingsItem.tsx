import { Pressable, Text, View } from 'react-native';
import { useCurrency } from './CurrencyProvider';
import { PixelText } from './PixelText';
import { SETTINGS_ROW, useSettingsRow } from './settingsRow';
import { fonts } from '@/theme/tokens';

/**
 * 마이페이지 설정 — 통화 행 (¥ ↔ ₩ 토글).
 * 다른 설정 메뉴 행과 동일한 스타일(아이콘 36 + ko 라벨/설명)의 "bare row" 로,
 * 설정 PixelFrame 컨테이너 안에 다른 항목들과 함께 들어간다(웹과 동일 배치).
 */
export function CurrencySettingsItem() {
  const { mode, toggle, rate } = useCurrency();
  const { flat, tc, icon } = useSettingsRow();
  const isKrw = mode === 'krw';

  return (
    <Pressable onPress={toggle} style={SETTINGS_ROW}>
      <View style={icon(isKrw ? tc.blu : tc.red)}>
        <Text style={flat ? { color: tc.white, fontSize: 15, fontWeight: '800' } : { color: tc.white, fontFamily: fonts.pixel, fontSize: 16 }}>
          {isKrw ? '₩' : '¥'}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <PixelText variant="ko" size={12} color={tc.ink} weight="bold" numberOfLines={1}>
          통화
        </PixelText>
        <PixelText variant="ko" size={10} color={tc.ink3} style={{ marginTop: 2 }} numberOfLines={1}>
          {isKrw ? `원화 (KRW) · 1¥ ≈ ${rate.toFixed(2)}₩` : '엔화 (JPY)'}
        </PixelText>
      </View>
      <PixelText variant="pixel" size={14} color={tc.ink3}>↔</PixelText>
    </Pressable>
  );
}
