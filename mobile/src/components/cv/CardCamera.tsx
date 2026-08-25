/**
 * 카드 전용 카메라 — 카드 모양 가이드라인 + 연속 촬영.
 *
 * 기존 CardScanner(문서 스캐너 플러그인)는 A4 문서용 사각 검출이라 카드 비율
 * 가이드가 없고, 세션이 끝나야 결과가 한꺼번에 나왔다. 여기서는:
 *   - 카드 비율(63:88) 가이드 창을 그리고, 좌하단 **코드 영역**을 따로 표시한다.
 *   - 셔터를 눌러도 카메라가 닫히지 않는다. 계속 찍어서 여러 장을 모을 수 있다.
 *   - 한 장 찍을 때마다 즉시 onCaptured 로 넘겨, 부모가 OCR·조회를 병렬로 시작한다.
 */
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { PixelText } from '@/components/PixelText';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { colors } from '@/theme/tokens';

/** 카드 실제 비율 (63mm × 88mm). */
const CARD_RATIO = 63 / 88;
/** 가이드 창이 차지하는 화면 너비 비율. */
const GUIDE_WIDTH_RATIO = 0.82;

/** 카드 안에서 세트코드/번호가 인쇄되는 좌하단 영역 (카드 크기 대비 비율). */
const CODE_ROI = { x: 0.02, y: 0.855, w: 0.58, h: 0.135 } as const;

export interface CardShot {
  /** 가이드 영역만 잘라낸 카드 이미지 — 미리보기/등록용. */
  cardUri: string;
  /** 좌하단 코드 영역만 잘라 확대한 이미지 — OCR 전용. */
  roiUri: string;
  /** 크롭 전 원본 사진 — 크롭이 빗나갔을 때의 OCR 재시도용. */
  fullUri: string;
  capturedAt: string;
}

interface Rect { x: number; y: number; w: number; h: number }

/**
 * 화면 가이드 사각형 → 촬영 이미지 픽셀 좌표.
 * 프리뷰는 cover(중앙 크롭)로 그려지므로 그 배율/오프셋을 되돌려 매핑한다.
 * 순수 함수 — 크롭 계산이 어긋나면 여기만 보면 된다.
 */
export function mapGuideToImage(
  preview: { w: number; h: number },
  image: { w: number; h: number },
  guide: Rect,
): Rect {
  if (preview.w <= 0 || preview.h <= 0 || image.w <= 0 || image.h <= 0) {
    return { x: 0, y: 0, w: image.w, h: image.h };
  }
  const scale = Math.max(preview.w / image.w, preview.h / image.h);
  const offsetX = (image.w * scale - preview.w) / 2;
  const offsetY = (image.h * scale - preview.h) / 2;
  const x = (guide.x + offsetX) / scale;
  const y = (guide.y + offsetY) / scale;
  const w = guide.w / scale;
  const h = guide.h / scale;
  // 이미지 밖으로 나가지 않게 clamp.
  const cx = Math.max(0, Math.min(image.w - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(image.h - 1, Math.round(y)));
  return {
    x: cx,
    y: cy,
    w: Math.max(1, Math.min(image.w - cx, Math.round(w))),
    h: Math.max(1, Math.min(image.h - cy, Math.round(h))),
  };
}

interface Props {
  onCancel: () => void;
  /** 한 장 찍을 때마다 즉시 호출 — 부모가 OCR/조회를 바로 시작한다. */
  onCaptured: (shot: CardShot) => void;
  /** "완료" — 지금까지 찍은 것으로 결과 화면으로 넘어간다. */
  onDone: () => void;
  /** 지금까지 찍힌 장수 (부모 상태) — 하단 표시용. */
  shotCount: number;
  /** 최근 촬영 썸네일 (최대 4장). */
  recentThumbs?: string[];
}

export function CardCamera({ onCancel, onCaptured, onDone, shotCount, recentThumbs = [] }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const camRef = useRef<CameraView | null>(null);
  const { width: winW, height: winH } = useWindowDimensions();

  // 가이드 창 — 화면 중앙, 카드 비율.
  const guideW = Math.round(winW * GUIDE_WIDTH_RATIO);
  const guideH = Math.round(guideW / CARD_RATIO);
  const guideX = Math.round((winW - guideW) / 2);
  const guideY = Math.round((winH - guideH) / 2 - 40);
  const guide: Rect = { x: guideX, y: guideY, w: guideW, h: guideH };

  const capture = useCallback(async () => {
    if (busy || !camRef.current) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) return;
      const imgW = photo.width ?? 0;
      const imgH = photo.height ?? 0;
      const card = mapGuideToImage({ w: winW, h: winH }, { w: imgW, h: imgH }, guide);

      // 1) 카드 전체 — 미리보기/등록용.
      const cardOut = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ crop: { originX: card.x, originY: card.y, width: card.w, height: card.h } }, { resize: { width: 900 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );

      // 2) 좌하단 코드 영역만 — 작게 잘라 크게 확대하면 OCR 정확도가 크게 오른다.
      const roi = {
        originX: Math.round(card.x + card.w * CODE_ROI.x),
        originY: Math.round(card.y + card.h * CODE_ROI.y),
        width: Math.max(1, Math.round(card.w * CODE_ROI.w)),
        height: Math.max(1, Math.round(card.h * CODE_ROI.h)),
      };
      const roiOut = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ crop: roi }, { resize: { width: 1000 } }],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG },
      );

      // 크롭 좌표가 어긋나는 기기를 잡아내기 위한 진단 로그 (logcat: ReactNativeJS).
      console.log(`[scan] photo=${imgW}x${imgH} preview=${winW}x${winH} card=${card.x},${card.y},${card.w}x${card.h}`);
      onCaptured({
        cardUri: cardOut.uri,
        roiUri: roiOut.uri,
        fullUri: photo.uri,
        capturedAt: new Date().toISOString(),
      });
    } catch {
      // 촬영 실패는 조용히 무시 — 다시 찍으면 된다.
    } finally {
      setBusy(false);
    }
  }, [busy, guide, onCaptured, winW, winH]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <PixelText variant="ko" size={12} color={colors.white} style={{ textAlign: 'center', marginBottom: 16, paddingHorizontal: 30, lineHeight: 20 }}>
          카드를 찍으려면 카메라 권한이 필요해요.
        </PixelText>
        <Pressable onPress={requestPermission} style={[styles.pill, { backgroundColor: colors.gold }]}>
          <PixelText variant="ko" size={12} color={colors.ink}>권한 허용</PixelText>
        </Pressable>
        <Pressable onPress={onCancel} style={[styles.pill, { marginTop: 10 }]}>
          <PixelText variant="ko" size={11} color={colors.white}>취소</PixelText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.full}>
      <CameraView
        ref={(r) => { camRef.current = r; }}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setReady(true)}
      />

      {/* 스크림 — 가이드 창만 뚫어 보이게 4방향 패널로 덮는다(마스킹 없이 동작). */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.scrim, { left: 0, right: 0, top: 0, height: guideY }]} />
        <View style={[styles.scrim, { left: 0, right: 0, top: guideY + guideH, bottom: 0 }]} />
        <View style={[styles.scrim, { left: 0, width: guideX, top: guideY, height: guideH }]} />
        <View style={[styles.scrim, { right: 0, width: guideX, top: guideY, height: guideH }]} />

        {/* 카드 가이드 테두리 */}
        <View style={[styles.guide, { left: guideX, top: guideY, width: guideW, height: guideH }]}>
          {/* 네 모서리 마커 */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          {/* 좌하단 코드 영역 — 여기에 세트코드/번호가 오도록 안내 */}
          <View
            style={[
              styles.roi,
              {
                left: guideW * CODE_ROI.x,
                top: guideH * CODE_ROI.y,
                width: guideW * CODE_ROI.w,
                height: guideH * CODE_ROI.h,
              },
            ]}
          >
            <PixelText variant="ko" size={8} color={colors.gold} style={{ letterSpacing: 0.5 }}>
              세트코드 · 번호
            </PixelText>
          </View>
        </View>

        <PixelText
          variant="ko"
          size={11}
          color={colors.white}
          style={{ position: 'absolute', top: guideY - 30, left: 0, right: 0, textAlign: 'center' }}
        >
          카드를 가이드에 맞춰 주세요
        </PixelText>
      </View>

      {/* 하단 컨트롤 */}
      <View style={styles.bar}>
        <Pressable onPress={onCancel} hitSlop={10} style={styles.side}>
          <PixelText variant="ko" size={11} color={colors.white}>닫기</PixelText>
        </Pressable>

        <Pressable
          onPress={capture}
          disabled={!ready || busy}
          accessibilityLabel="카드 촬영"
          style={[styles.shutter, (!ready || busy) && { opacity: 0.45 }]}
        >
          <View style={styles.shutterInner} />
        </Pressable>

        <Pressable onPress={onDone} disabled={shotCount === 0} hitSlop={10} style={styles.side}>
          <PixelText variant="ko" size={11} color={shotCount === 0 ? 'rgba(255,255,255,0.4)' : colors.gold} weight="bold">
            완료 {shotCount > 0 ? `${shotCount}장` : ''}
          </PixelText>
        </Pressable>
      </View>

      {/* 최근 촬영 썸네일 — 연속 촬영 중 몇 장 찍었는지 바로 보이게 */}
      {recentThumbs.length > 0 ? (
        <View style={styles.thumbs}>
          {recentThumbs.slice(-4).map((uri) => (
            <ThumbImage key={uri} uri={uri} size={38} borderColor={colors.gold} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  pill: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  scrim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.62)' },
  guide: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 12 },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: colors.gold },
  cornerTL: { left: -2, top: -2, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 12 },
  cornerTR: { right: -2, top: -2, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 12 },
  cornerBL: { left: -2, bottom: -2, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 12 },
  cornerBR: { right: -2, bottom: -2, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 12 },
  roi: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  side: { minWidth: 72 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.white },
  thumbs: { position: 'absolute', left: 20, bottom: 112, flexDirection: 'row', gap: 6 },
});
