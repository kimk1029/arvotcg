import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { CardRegisterForm, useManualPalette, type RegisterInitial } from '@/components/CardRegisterForm';
import { useToast } from '@/components/ToastProvider';
import type { CardItem } from '@/data/cardvault';
import type { MyCardRow } from '@/lib/myApi';

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
  item,
  onClose,
  onSaved,
  alreadyCollected = false,
  onRemove,
  editId,
  initial,
}: {
  visible: boolean;
  card: RegisterCardInfo;
  /** 이미 완성된 카드(검색 결과·직접입력) — 세트/번호까지 그대로 등록해야 하는 '내 카드 등록' 경로용. */
  item?: CardItem | null;
  onClose: () => void;
  /** 저장 완료. 수정 모드면 서버가 돌려준 갱신 행을 넘긴다(목록 캐시 merge 용). */
  onSaved?: (updated?: MyCardRow) => void;
  /** 이미 컬렉션에 있는 카드 — 헤더를 '추가 등록'으로 바꾸고 제거 버튼을 보여준다. */
  alreadyCollected?: boolean;
  /** '컬렉션에서 제거' 버튼 — 호출 측이 확인창·삭제를 처리한다. */
  onRemove?: () => void;
  /** 수정 모드 — 기존 등록 행 id + 초기값. 헤더가 '등록 정보 수정'으로 바뀐다 (웹 CollectionScreen 수정 모달 페어). */
  editId?: number | null;
  initial?: RegisterInitial | null;
}) {
  const MP = useManualPalette();
  const toast = useToast();

  // RegisterCardInfo → 공용 폼이 받는 CardItem. item 이 오면 그대로 쓴다.
  const builtCard: CardItem = useMemo(
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
  const formCard = item ?? builtCard;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* 배경 딤 — 탭하면 닫기 (웹 cv-sheet-overlay 동일). */}
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
      >
        {/* 시트 높이 상한 안에서 폼이 스크롤되도록 flexShrink — 등급 입력이 펼쳐져 길어져도 하단 '컬렉션에 등록' 이 잘리지 않는다 (웹 max-height+overflow 동일). */}
        <Pressable onPress={() => undefined} style={{ maxHeight: '88%', flexShrink: 1 }}>
          <View style={{ flexShrink: 1, backgroundColor: MP.pageBg, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' }}>
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
              <PixelText variant="ko" size={13} weight="bold" color={MP.ink}>
                {editId != null ? '✏️ 등록 정보 수정' : alreadyCollected ? '＋ 카드 추가 등록' : '＋ 카드 등록'}
              </PixelText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {alreadyCollected && onRemove && (
                  <Pressable onPress={onRemove} hitSlop={8}>
                    <PixelText variant="ko" size={12} weight="bold" color={MP.ink3} style={{ textDecorationLine: 'underline' }}>
                      컬렉션에서 제거
                    </PixelText>
                  </Pressable>
                )}
                <Pressable onPress={onClose} hitSlop={10}>
                  <PixelText variant="ko" size={15} color={MP.ink3}>✕</PixelText>
                </Pressable>
              </View>
            </View>

            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
              <CardRegisterForm
                key={formCard.id}
                card={formCard}
                editId={editId}
                initial={initial}
                onSaved={(_saved, updated) => {
                  toast.success(editId != null ? '등록 정보를 수정했어요' : alreadyCollected ? '내 컬렉션에 추가 등록되었습니다' : '내 컬렉션에 등록되었습니다');
                  onSaved?.(updated);
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
