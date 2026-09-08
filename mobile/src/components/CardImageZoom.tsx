import { Image, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { cardZoomCaption, cardZoomLayout, type CardZoomKind } from '../../../shared/cardZoom';
import { shotSource } from '@/lib/shotMode';
import { PixelText } from '@/components/PixelText';
import { useThemeColors, useThemeTextVariant } from './ThemeProvider';

/**
 * 시세상세 카드 이미지 확대 모달 — 실물 63×88mm 컨테이너(1in = 160dp)에 카드가 꽉 차게(웹 SnkrdunkImageZoom 동일).
 * 레이아웃 정본: shared/cardZoom.ts
 */
export function CardImageZoom({ src, kind = 'card', onClose }: { src: string; kind?: CardZoomKind; onClose: () => void }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const win = useWindowDimensions();
  const L = cardZoomLayout({ viewportWidth: win.width, viewportHeight: win.height, pxPerInch: 160, kind });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center' }}>
        <View
          accessibilityLabel="카드 이미지 확대"
          style={{ width: L.width, height: L.height, borderRadius: L.radius, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
        >
          {/* 컨테이너 크기로 contain 한 뒤 scale 로 키움 — 프레임 투명 여백이 밖으로 밀려나 카드만 꽉 참 (웹 동일). */}
          <Image
            source={shotSource(src)}
            resizeMode="contain"
            resizeMethod="scale"
            style={{ width: L.width, height: L.height, transform: [{ scale: L.imageScale }] }}
          />
        </View>
        <Text style={{ position: 'absolute', bottom: 28, color: 'rgba(255,255,255,0.6)', fontSize: 10, letterSpacing: 0.5 }}>{cardZoomCaption(kind)}</Text>
        <View style={{ position: 'absolute', top: 40, right: 20, backgroundColor: tc.ink, paddingHorizontal: 10, paddingVertical: 6, borderColor: tc.gold, borderWidth: 2 }}>
          <PixelText variant={txt} size={11} color={tc.gold}>✕ 닫기</PixelText>
        </View>
      </Pressable>
    </Modal>
  );
}
