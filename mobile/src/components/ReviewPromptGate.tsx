/**
 * 3번째 실행에 한 번 "앱이 마음에 드세요?" 를 묻는 후기 요청창 — 웹 ReviewPromptGate 페어.
 *
 * 좋아요 → 인앱 리뷰 팝업(expo-store-review, 네이티브가 있는 빌드) / 없으면 스토어 링크.
 *   OS 가 팝업을 안 띄울 수도 있어(Apple 연 3회 제한 등) 팝업 호출 뒤에도 실패하면 링크로 폴백.
 * 아쉬워요 → 앱 안의 의견 보내기(/my/bug-report). 나중에 → 7일 뒤 다시(최대 3회).
 * 보상은 없다(스토어 정책상 리뷰 대가 제공 금지).
 *
 * 네이티브 모듈은 require 전에 requireOptionalNativeModule 로 존재를 확인한다 —
 * 최상위 require 가 던지면 앱이 죽는다(2026-09-11 광고 SDK 사고).
 */
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { PixelText } from '@/components/PixelText';
import { useThemeColors } from '@/components/ThemeProvider';
import { getJson, setJson } from '@/lib/kvStore';
import { isAuthenticated } from '@/lib/session';
import { SHOT } from '@/lib/shotMode';
import {
  INITIAL_REVIEW_STATE,
  STORE_REVIEW_URL,
  markAsked,
  shouldAskReview,
  type ReviewPromptState,
} from '../../../shared/reviewPrompt';

const KEY = 'reviewPrompt';
const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

function load(): ReviewPromptState {
  return { ...INITIAL_REVIEW_STATE, ...(getJson<Partial<ReviewPromptState>>(KEY) ?? {}) };
}

/** 인앱 리뷰 팝업을 요청하고, 못 띄우면 스토어 링크로. */
async function requestReview(): Promise<void> {
  try {
    if (requireOptionalNativeModule('ExpoStoreReview')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const StoreReview = require('expo-store-review') as typeof import('expo-store-review');
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview();
        return;
      }
    }
  } catch {
    // 네이티브 실패 → 링크
  }
  await Linking.openURL(STORE_REVIEW_URL[platform]).catch(() => undefined);
}

export function ReviewPromptGate() {
  const tc = useThemeColors();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (SHOT || !isAuthenticated()) return;
    // 이번 실행을 1회로 센다(앱 프로세스 기준 — 컴포넌트는 루트에 한 번만 마운트된다).
    const s = { ...load(), visits: load().visits + 1 };
    setJson(KEY, s);
    if (!shouldAskReview(s)) return;
    const t = setTimeout(() => {
      setJson(KEY, markAsked(load()));
      setOpen(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  const finish = (status: ReviewPromptState['status']) => {
    setJson(KEY, { ...load(), status });
    setOpen(false);
  };
  const onLike = () => {
    finish('done');
    void requestReview();
  };
  const onFeedback = () => {
    finish('later');
    router.push('/my/bug-report' as never);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => finish('later')}>
      <Pressable onPress={() => finish('later')} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: tc.paper, borderRadius: 18, padding: 22, alignItems: 'center' }}>
          <PixelText variant="ko" size={34}>⭐</PixelText>
          <PixelText variant="ko" size={16} weight="bold" color={tc.ink} style={{ marginTop: 8 }}>아르보TCG, 쓸 만하세요?</PixelText>
          <PixelText variant="ko" size={12} color={tc.ink3} style={{ marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
            짧은 후기 하나가 다음 기능을 만드는 힘이 돼요.{'\n'}아쉬운 점은 의견 보내기로 바로 알려주세요.
          </PixelText>
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 16 }}>
            <Pressable onPress={onLike} style={{ height: 46, borderRadius: 12, backgroundColor: tc.ink, alignItems: 'center', justifyContent: 'center' }}>
              <PixelText variant="ko" size={13} weight="bold" color={tc.paper}>
                {`좋아요, 후기 남길게요 (${platform === 'ios' ? 'App Store' : 'Google Play'})`}
              </PixelText>
            </Pressable>
            <Pressable onPress={onFeedback} style={{ height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: tc.pap3, backgroundColor: tc.white, alignItems: 'center', justifyContent: 'center' }}>
              <PixelText variant="ko" size={12.5} weight="bold" color={tc.ink}>아쉬운 점이 있어요 (의견 보내기)</PixelText>
            </Pressable>
            <Pressable onPress={() => finish('later')} hitSlop={6} style={{ height: 34, alignItems: 'center', justifyContent: 'center' }}>
              <PixelText variant="ko" size={11.5} weight="bold" color={tc.ink3}>나중에</PixelText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
