import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { CardRegisterForm, useManualPalette } from '@/components/CardRegisterForm';
import { useToast } from '@/components/ToastProvider';
import type { CardItem } from '@/data/cardvault';

/** 등급별 현재시세 (JPY) — 시세상세의 등급 집계에서 전달. */
export interface GradePrices {
  single: number;
  psa10: number;
  psa9: number;
  psa8: number;
}

/** 등록할 카드 정보 — 시세상세에서 전달. */
export interface RegisterCardInfo {
  apparelId: number;
  name: string;
  imageUrl?: string | null;
  /** 현재 싱글(raw) 시세 (JPY). 직접뽑기 기준가/미리보기용. */
  currentPriceJpy?: number | null;
  gradePrices?: GradePrices | null;
}

/**
 * 시세상세 "내 컬렉션에 추가" 팝업 — 내용은 카드 등록 페이지(scan.tsx)와 동일한
 * 공용 폼(CardRegisterForm)을 그대로 사용한다. 웹이 CardRegisterSheet 하나를
 * 등록페이지·상세 모달 양쪽에서 쓰는 것과 같은 구조.
 * 등록가: 구매가 입력 시 그 값, 미입력 시 서버가 등급 기준 시세를 등록 시점에 스냅.
 */
export function CardRegisterSheet({
  visible,
  card,
  onClose,
  onSaved,
}: {
  visible: boolean;
  card: RegisterCardInfo;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const MP = useManualPalette();
  const toast = useToast();

  // RegisterCardInfo → 공용 폼이 받는 CardItem.
  const formCard: CardItem = useMemo(
    () => ({
      id: Date.now(),
      name: card.name || '카드',
      set: '-',
      num: '-',
      game: '포켓몬',
      rar: 'R',
      grade: null,
      price: card.currentPriceJpy ?? 0,
      priceSingle: card.currentPriceJpy && card.currentPriceJpy > 0 ? card.currentPriceJpy : undefined,
      priceCurrency: 'JPY',
      trend: [],
      emoji: '🃏',
      owned: true,
      snkrdunkApparelId: card.apparelId,
      imageUrl: card.imageUrl ?? undefined,
    }),
    [card.apparelId, card.name, card.imageUrl, card.currentPriceJpy],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* 배경 딤 — 탭하면 닫기 (웹 cv-sheet-overlay 동일). */}
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
      >
        <Pressable onPress={() => undefined} style={{ maxHeight: '88%' }}>
          <View style={{ backgroundColor: MP.pageBg, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' }}>
            {/* 헤더 */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 13,
                borderBottomWidth: 1,
                borderBottomColor: MP.line,
              }}
            >
              <PixelText variant="ko" size={13} weight="bold" color={MP.ink}>＋ 카드 등록</PixelText>
              <Pressable onPress={onClose} hitSlop={10}>
                <PixelText variant="ko" size={15} color={MP.ink3}>✕</PixelText>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 26 }} keyboardShouldPersistTaps="handled">
              <CardRegisterForm
                key={card.apparelId}
                card={formCard}
                onSaved={() => {
                  toast.success('내 컬렉션에 등록되었습니다');
                  onSaved?.();
                  onClose();
                }}
              />
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
