import { View, type ViewProps, StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { useThemeColors, useTheme } from '../ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { PixelDeco } from './PixelDeco';

interface Props extends ViewProps {
  bg?: string;
  border?: string;
  borderWidth?: number;
  shadow?: number;
  /** 드롭섀도 색 (기본 = border 색). 섹션 헤더는 gold-dk 등으로 지정. */
  shadowColor?: string;
  hi?: string | null;
  lo?: string | null;
  inner?: number;
}

/**
 * 웹 globals.css `.card` 의 픽셀 박스 입체 처리를 RN에서 재현.
 *
 * 웹 recipe (.card):
 *   box-shadow:
 *     -4px 0 0 ink, 4px 0 0 ink, 0 -4px 0 ink, 0 4px 0 ink,   ← 4방향 ink 테두리(대각 없음 → 꼭지점 빔)
 *     inset 0 3px 0 rgba(255,255,255,.85),                    ← 상단 하이라이트
 *     inset 0 -4px 0 rgba(0,0,0,.18),                         ← 하단 음영
 *     6px 6px 0 ink;                                          ← 단일 하드 드롭섀도
 *
 * 핵심: 테두리를 4개 띠로 그려 **네 꼭지점 한 칸이 비어(배경 노출)** 큰 픽셀 노치가 생긴다.
 *       드롭섀도도 동일하게 꼭지점이 빈 단일 솔리드 ink 면(중간 단계 없음).
 */
export function PixelFrame({
  bg = colors.white,
  border = colors.ink,
  borderWidth = 4,
  shadow: shadowProp = 6,
  shadowColor,
  hi = 'rgba(255,255,255,0.85)',
  lo = 'rgba(0,0,0,0.18)',
  inner = 3,
  style,
  children,
  ...rest
}: Props) {
  const c = useThemeColors();
  const { theme } = useTheme();
  const faceBg = bg === colors.white ? c.white : bg;
  const edge = border === colors.ink ? c.ink : border;
  const shadowFill = shadowColor ?? edge;

  // 플랫(clean·dark) — 픽셀 데코 대신 라인보더+라운드+소프트섀도.
  // (clean 직각 예외는 2026-08-06 제거 — 직각+보더가 픽셀 잔재로 보임. 웹 CSS 도 동시 제거.)
  if (isFlatTheme(theme)) {
    const radius = 14;
    const pad = Math.max(2, borderWidth);
    return (
      <View
        {...rest}
        style={[
          { backgroundColor: faceBg, borderWidth: 1, borderColor: c.pap3, borderRadius: radius },
          theme === 'clean' && shadowProp > 0 ? styles.flatShadow : null,
          style,
        ]}
      >
        <View style={{ padding: pad }}>{children}</View>
      </View>
    );
  }
  const loThick = Math.max(2, inner + 1); // 웹: 하단 음영(4px)이 상단 하이라이트(3px)보다 한 칸 두껍다
  const cut = borderWidth;
  // 앱은 ink 테두리(면 안쪽) + 드롭섀도(바깥)가 같은 색이라 합쳐져 웹보다 두껍게 보인다.
  // 드롭 오프셋을 2px 줄여 그림자를 얇게(웹 체감과 비슷하게). 0 은 그대로(섀도 없음).
  const shadow = shadowProp > 0 ? Math.max(1, shadowProp - 2) : 0;
  return (
    <View {...rest} style={[styles.wrap, { marginRight: shadow, marginBottom: shadow }, style]}>
      {/* 꼭지점 빈 단일 하드 드롭섀도 */}
      {shadow > 0 ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { top: shadow, left: shadow, right: -shadow, bottom: -shadow }]}
        >
          <PixelDeco faceBg={shadowFill} edge={shadowFill} cut={cut} border={false} />
        </View>
      ) : null}
      <View style={styles.face}>
        <PixelDeco faceBg={faceBg} edge={edge} cut={cut} hi={hi} lo={lo} inner={inner} loThick={loThick} />
        {/* 투명 테두리로 콘텐츠를 테두리 안쪽으로 들여놓는다(기존 borderWidth 와 동일한 인셋) */}
        <View style={{ borderWidth: cut, borderColor: 'transparent', backgroundColor: 'transparent' }}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  face: { position: 'relative' },
  flatShadow: {
    shadowColor: '#11141A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
