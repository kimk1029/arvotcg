/**
 * 원격 이미지 + 이모지 폴백 썸네일 블록.
 * `{uri ? <Image resizeMode="cover" 100%> : <Text>🃏</Text>}` + tc.pap2 배경 래퍼
 * 인라인 복붙 패턴의 범용판. 카드형 목록/그리드의 썸네일 슬롯에 사용.
 * (CardItem 전용 CardThumb 와는 별개 — 이 컴포넌트는 uri 문자열만 받는다.)
 */
import type { ReactNode } from 'react';
import {
  Image,
  Text,
  View,
  type ImageResizeMode,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useThemeColors } from '../ThemeProvider';
import { shotSource } from '@/lib/shotMode';

interface Props {
  /** 원격 이미지 URL — 없으면 이모지 폴백. */
  uri: string | null | undefined;
  emoji?: string;
  emojiSize?: number;
  /** 정사각 축약형 (width=height=size). 다른 크기·비율은 style 로. */
  size?: number;
  /** 래퍼 스타일 (width/height/aspectRatio/margin/borderRadius 등). */
  style?: StyleProp<ViewStyle>;
  /** 지정 시 테두리(기본 borderWidth 2). */
  borderColor?: string;
  borderWidth?: number;
  /** 배경색 (기본 tc.pap2). */
  bg?: string;
  resizeMode?: ImageResizeMode;
  /** Android Fresco 메모리 절약용 — 원본 콜사이트 옵션 유지. */
  resizeMethod?: 'auto' | 'resize' | 'scale';
  /** 썸네일 위 오버레이(랭크 배지·그레이딩 라벨 등 absolute 요소). */
  children?: ReactNode;
}

export function ThumbImage({
  uri,
  emoji = '🃏',
  emojiSize = 30,
  size,
  style,
  borderColor,
  borderWidth = 2,
  bg,
  resizeMode = 'cover',
  resizeMethod,
  children,
}: Props) {
  const tc = useThemeColors();
  return (
    <View
      style={[
        {
          backgroundColor: bg ?? tc.pap2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        size != null ? { width: size, height: size } : null,
        borderColor ? { borderColor, borderWidth } : null,
        style,
      ]}
    >
      {uri ? (
        <Image
          source={shotSource(uri)}
          style={{ width: '100%', height: '100%' }}
          resizeMode={resizeMode}
          resizeMethod={resizeMethod}
        />
      ) : (
        <Text style={{ fontSize: emojiSize }}>{emoji}</Text>
      )}
      {children}
    </View>
  );
}
