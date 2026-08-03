import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { Chip } from '@/components/cv/Chip';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { useThemeColors, useThemeTextVariant, useTheme } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { useToast } from '@/components/ToastProvider';
import { addCards } from '@/lib/collection';
import { createMyCard } from '@/lib/myApi';
import type { CardItem, PriceCurrency } from '@/data/cardvault';

/** 오늘을 YYYY-MM-DD 로 (웹 CardRegisterSheet todayStr 동일). */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtJpy(v: number): string {
  return `¥${Math.round(v).toLocaleString()}`;
}

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
 * 구매가 미입력 시 적용될 등록가 미리보기 — 서버 registerBasisJpy(src/lib/snkrdunkPrice)와
 * 동일 규칙의 로컬 미러(모바일은 src/lib 를 import 할 수 없음. 정본은 서버).
 *  · PSA 10/9/8 → 해당 등급 시세, 타사(BGS 등)·데이터 없음 → PSA10 → 싱글.
 *  · 비등급 → 싱글.
 */
function previewBasis(
  gp: GradePrices,
  graded: boolean,
  gradeCompany: string,
  gradeValue: string,
): { price: number; basis: string } {
  if (!graded) return { price: gp.single, basis: 'RAW' };
  const company = gradeCompany.trim().toUpperCase();
  const n = parseInt(gradeValue.replace(/[^0-9]/g, ''), 10);
  if (company === 'PSA') {
    if (n === 9 && gp.psa9 > 0) return { price: gp.psa9, basis: 'PSA 9' };
    if (n === 8 && gp.psa8 > 0) return { price: gp.psa8, basis: 'PSA 8' };
    if (n === 10 && gp.psa10 > 0) return { price: gp.psa10, basis: 'PSA 10' };
  }
  if (gp.psa10 > 0) return { price: gp.psa10, basis: 'PSA 10' };
  return { price: gp.single, basis: 'RAW' };
}

const GRADE_COMPANIES = ['PSA', 'BGS', 'CGC', 'SGC', 'ARS'];

/**
 * 시세상세 "내 컬렉션에 추가" 팝업 — 웹 CardActions 의 cv-sheet-modal + CardRegisterSheet 패리티.
 * 저장 시 로컬 컬렉션(addCards) + 서버(/api/me/cards) 양쪽에 등록 (scan.tsx finalizeRegister 동일).
 * 등록가: 구매가 입력 시 그 값, 미입력 시 서버가 등급 기준 시세(PSA10/9/8, 타사→PSA10,
 * 싱글→raw)를 등록 시점에 스냅해 저장.
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
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  // 플랫(클린·다크) — 웹 clean 등록 폼(라운드 인풋·필 토글·에메랄드 CTA)과 동일 처리.
  const { theme } = useTheme();
  const flat = isFlatTheme(theme);
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [selfPulled, setSelfPulled] = useState(false);
  const [buyPriceStr, setBuyPriceStr] = useState('');
  const [buyCur, setBuyCur] = useState<PriceCurrency>('JPY');
  const [buyDate, setBuyDate] = useState(todayStr());
  const [qty, setQty] = useState(1);
  const [region, setRegion] = useState<'jp' | 'kr' | 'en'>('jp');
  const [graded, setGraded] = useState(false);
  const [gradeCompany, setGradeCompany] = useState('PSA');
  const [gradeValue, setGradeValue] = useState('');
  const [memo, setMemo] = useState('');

  const inputStyle = {
    backgroundColor: tc.white,
    borderColor: flat ? tc.pap3 : tc.ink,
    borderWidth: flat ? 1.5 : 3,
    borderRadius: flat ? 12 : 0,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: flat ? 14 : 15,
    fontFamily: flat ? undefined : 'Galmuri11',
    fontWeight: flat ? ('700' as const) : undefined,
    color: tc.ink,
  } as const;

  // 구매가 미입력 시 적용될 등록가 미리보기.
  const preview = useMemo(() => {
    const gp =
      card.gradePrices ??
      (card.currentPriceJpy && card.currentPriceJpy > 0
        ? { single: card.currentPriceJpy, psa10: 0, psa9: 0, psa8: 0 }
        : null);
    if (!gp) return null;
    const b = previewBasis(gp, graded, gradeCompany, gradeValue);
    return b.price > 0 ? b : null;
  }, [card.gradePrices, card.currentPriceJpy, graded, gradeCompany, gradeValue]);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    const price = parseInt(buyPriceStr, 10);
    const hasBuy = Number.isFinite(price) && price > 0;
    // 직접뽑기(비등급)는 현재 싱글시세를 기준가로. 등급카드는 서버가 등급 시세로 산정.
    const selfBasis =
      selfPulled && !graded && card.currentPriceJpy && card.currentPriceJpy > 0
        ? Math.round(card.currentPriceJpy)
        : null;

    try {
      await createMyCard({
        snkrdunkApparelId: card.apparelId,
        nickname: card.name || null,
        photoUrl: null,
        buyPrice: hasBuy ? price : selfBasis,
        buyCurrency: hasBuy ? buyCur : 'JPY',
        qty: Math.max(1, qty),
        buyDate: buyDate.trim() || null,
        region,
        memo: memo.trim() || null,
        selfPulled,
        graded,
        gradeCompany: graded ? gradeCompany : null,
        gradeValue: graded ? gradeValue.trim() || null : null,
      });
      // 로컬 캐시(홈 등 로컬 기반 화면)에도 반영.
      const local: CardItem = {
        id: Date.now(),
        name: card.name || '카드',
        set: '-',
        num: '-',
        game: '포켓몬',
        rar: 'R',
        grade: null,
        price: card.currentPriceJpy ?? 0,
        priceSingle: card.currentPriceJpy ?? undefined,
        priceCurrency: 'JPY',
        trend: [],
        emoji: '🃏',
        owned: true,
        snkrdunkApparelId: card.apparelId,
        imageUrl: card.imageUrl ?? undefined,
        buyPrice: hasBuy ? price : selfBasis ?? undefined,
        buyCurrency: hasBuy ? buyCur : 'JPY',
        qty: Math.max(1, qty),
        buyDate: buyDate || undefined,
        selfPulled,
        graded,
        gradeCompany: graded ? gradeCompany : undefined,
        gradeValue: graded ? gradeValue.trim() || undefined : undefined,
      };
      addCards([local]);
      toast.success('내 컬렉션에 등록되었습니다');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error('등록 실패 — 잠시 후 다시 시도해 주세요');
      console.warn('[CardRegisterSheet] createMyCard 실패:', (e as Error)?.message ?? e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* 배경 딤 — 탭하면 닫기 (웹 cv-sheet-overlay 동일). */}
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
      >
        <Pressable onPress={() => undefined} style={{ maxHeight: '88%' }}>
          <View style={{ backgroundColor: tc.pap2, borderColor: tc.ink, borderTopWidth: 3 }}>
            {/* 헤더 */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderBottomWidth: 2,
                borderBottomColor: tc.pap3,
              }}
            >
              <PixelText variant={txt} size={12} weight="bold">＋ 카드 등록</PixelText>
              <Pressable onPress={onClose} hitSlop={10}>
                <PixelText variant={txt} size={14} color={tc.ink3}>✕</PixelText>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }} keyboardShouldPersistTaps="handled">
              {/* 카드 미리보기 */}
              <PixelFrame borderWidth={3} shadow={4}>
                <View style={{ flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' }}>
                  <ThumbImage
                    uri={card.imageUrl}
                    style={{ width: 52, height: 72, borderRadius: flat ? 8 : 0 }}
                    borderColor={flat ? undefined : tc.ink}
                    bg={tc.white}
                    resizeMode="contain"
                    emojiSize={25}
                  />
                  <View style={{ flex: 1 }}>
                    <PixelText variant="ko" size={12} weight="bold" numberOfLines={2} style={{ lineHeight: 17 }}>
                      {card.name || '이름 미상'}
                    </PixelText>
                    <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 4 }}>
                      현재시세 {card.currentPriceJpy && card.currentPriceJpy > 0 ? fmtJpy(card.currentPriceJpy) : '—'}
                    </PixelText>
                  </View>
                </View>
              </PixelFrame>

              {/* 직접뽑기 */}
              <Pressable
                onPress={() => setSelfPulled((v) => !v)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderColor: selfPulled ? tc.gold : tc.pap3,
                  borderWidth: flat ? 1.5 : 2,
                  borderRadius: flat ? 12 : 0,
                  backgroundColor: selfPulled ? (flat ? tc.goldSoft : tc.goldLt ?? tc.white) : tc.white,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <PixelText variant={txt} size={11}>{selfPulled ? '☑' : '☐'}</PixelText>
                <PixelText variant="ko" size={11} style={{ flex: 1 }}>
                  🎁 직접 뽑은 카드예요 (현재시세를 기준가로)
                </PixelText>
              </Pressable>

              {/* 등급여부 */}
              <Pressable
                onPress={() => setGraded((v) => !v)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderColor: graded ? tc.gold : tc.pap3,
                  borderWidth: flat ? 1.5 : 2,
                  borderRadius: flat ? 12 : 0,
                  backgroundColor: graded ? (flat ? tc.goldSoft : tc.goldLt ?? tc.white) : tc.white,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <PixelText variant={txt} size={11}>{graded ? '☑' : '☐'}</PixelText>
                <PixelText variant="ko" size={11} style={{ flex: 1 }}>
                  🏅 등급(그레이딩) 카드예요 (PSA/BGS 등)
                </PixelText>
              </Pressable>
              {graded && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1.5 }}>
                    <PixelText variant={txt} size={10} style={{ marginBottom: 7, letterSpacing: 1 }}>등급사</PixelText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {GRADE_COMPANIES.map((co) => (
                        <Chip key={co} on={gradeCompany === co} onPress={() => setGradeCompany(co)} size={9} px={8} py={6}>
                          {co}
                        </Chip>
                      ))}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <PixelText variant={txt} size={10} style={{ marginBottom: 7, letterSpacing: 1 }}>등급</PixelText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {['10', '9', '8'].map((v) => (
                        <Chip key={v} on={gradeValue === v} onPress={() => setGradeValue(v)} size={9} px={10} py={6}>
                          {v}
                        </Chip>
                      ))}
                    </View>
                    <TextInput
                      value={gradeValue}
                      onChangeText={setGradeValue}
                      placeholder="10"
                      placeholderTextColor={tc.ink4}
                      keyboardType="numeric"
                      style={[inputStyle, { marginTop: 6, paddingVertical: 7 }]}
                    />
                  </View>
                </View>
              )}

              {/* 구매가 + 통화 */}
              {!selfPulled && (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <PixelText variant={txt} size={11} style={{ letterSpacing: 1 }}>💰 구매가 (선택)</PixelText>
                    <View style={{ flexDirection: 'row', borderColor: flat ? tc.pap3 : tc.ink, borderWidth: flat ? 0 : 2, borderRadius: flat ? 999 : 0, padding: flat ? 2 : 0, backgroundColor: flat ? tc.pap2 : tc.white }}>
                      {(['KRW', 'JPY'] as PriceCurrency[]).map((c, i) => (
                        <Pressable
                          key={c}
                          onPress={() => setBuyCur(c)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: flat ? 999 : 0,
                            backgroundColor: buyCur === c ? (flat ? tc.ink : tc.gold) : 'transparent',
                            borderLeftWidth: flat || i === 0 ? 0 : 2,
                            borderLeftColor: tc.ink,
                          }}
                        >
                          <PixelText variant={txt} size={9} weight={flat ? 'bold' : 'normal'} color={buyCur === c ? (flat ? tc.paper : tc.ink) : tc.ink3}>
                            {c === 'JPY' ? '¥ 엔화' : '₩ 원화'}
                          </PixelText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tc.white, borderColor: flat ? tc.pap3 : tc.ink, borderWidth: flat ? 1.5 : 3, borderRadius: flat ? 12 : 0, paddingLeft: 12 }}>
                    <PixelText variant={txt} size={13} color={tc.ink2}>{buyCur === 'JPY' ? '¥' : '₩'}</PixelText>
                    <TextInput
                      value={buyPriceStr}
                      onChangeText={(t) => setBuyPriceStr(t.replace(/[^0-9]/g, ''))}
                      placeholder={buyCur === 'JPY' ? '엔화 금액' : '원화 금액'}
                      placeholderTextColor={tc.ink4}
                      keyboardType="numeric"
                      style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 11, fontSize: flat ? 15 : 16, fontFamily: flat ? undefined : 'Galmuri11', fontWeight: flat ? '700' : undefined, color: tc.ink }}
                    />
                  </View>
                </View>
              )}

              {/* 구매가 미입력/직접뽑기 시 적용될 등록가 안내 */}
              {(selfPulled || !buyPriceStr.trim()) && (
                <PixelFrame borderWidth={2} bg={tc.pap3}>
                  <View style={{ padding: 10 }}>
                    <PixelText variant="ko" size={10} color={tc.ink3} style={{ lineHeight: 15 }}>
                      {preview
                        ? `등록가: ${preview.basis} 시세 ${fmtJpy(preview.price)} (등록 시점 기준)으로 저장돼요`
                        : graded
                          ? '등록가: 등급 시세(타사 등급은 PSA10 기준)로 저장돼요'
                          : '등록가: 현재 싱글 시세로 저장돼요'}
                    </PixelText>
                  </View>
                </PixelFrame>
              )}

              {/* 구매일 + 수량 */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1.4 }}>
                  <PixelText variant={txt} size={11} style={{ marginBottom: 7, letterSpacing: 1 }}>📅 구매일</PixelText>
                  <TextInput
                    value={buyDate}
                    onChangeText={setBuyDate}
                    placeholder="2026-07-09"
                    placeholderTextColor={tc.ink4}
                    style={inputStyle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PixelText variant={txt} size={11} style={{ marginBottom: 7, letterSpacing: 1 }}>🔢 수량</PixelText>
                  <View style={{ flexDirection: 'row', alignItems: 'stretch', borderColor: flat ? tc.pap3 : tc.ink, borderWidth: flat ? 1.5 : 3, borderRadius: flat ? 12 : 0, overflow: 'hidden', backgroundColor: tc.white }}>
                    <Pressable
                      onPress={() => setQty((q) => Math.max(1, q - 1))}
                      style={{ width: 38, alignItems: 'center', justifyContent: 'center', borderRightWidth: flat ? 0 : 3, borderRightColor: tc.ink, backgroundColor: flat ? tc.pap2 : tc.pap3 }}
                    >
                      <PixelText variant={txt} size={14}>−</PixelText>
                    </Pressable>
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
                      <PixelText variant={txt} size={13}>{qty}</PixelText>
                    </View>
                    <Pressable
                      onPress={() => setQty((q) => Math.min(999, q + 1))}
                      style={{ width: 38, alignItems: 'center', justifyContent: 'center', borderLeftWidth: flat ? 0 : 3, borderLeftColor: tc.ink, backgroundColor: flat ? tc.pap2 : tc.pap3 }}
                    >
                      <PixelText variant={txt} size={14}>＋</PixelText>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* 발매 지역 */}
              <View>
                <PixelText variant={txt} size={11} style={{ marginBottom: 7, letterSpacing: 1 }}>🌏 발매 지역</PixelText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {([
                    ['jp', '일본판'],
                    ['kr', '한국판'],
                    ['en', '영문판'],
                  ] as const).map(([k, lb]) => (
                    <Chip key={k} on={region === k} onPress={() => setRegion(k)} size={9} px={10} py={6}>
                      {lb}
                    </Chip>
                  ))}
                </View>
              </View>

              {/* 메모 */}
              <View>
                <PixelText variant={txt} size={11} style={{ marginBottom: 7, letterSpacing: 1 }}>📝 메모 (선택)</PixelText>
                <TextInput
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="구매처, 상태 등 자유롭게"
                  placeholderTextColor={tc.ink4}
                  multiline
                  style={[inputStyle, { minHeight: 56, textAlignVertical: 'top' }]}
                />
              </View>

              {/* 등록 버튼 — 플랫: 웹 clean cv-manual-submit(에메랄드 채움 라운드) */}
              {flat ? (
                <Pressable
                  onPress={onSave}
                  disabled={saving}
                  style={{
                    height: 48, borderRadius: 14, backgroundColor: tc.grn, alignItems: 'center', justifyContent: 'center',
                    opacity: saving ? 0.6 : 1,
                    elevation: 4, shadowColor: tc.grn, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
                  }}
                >
                  <PixelText variant="ko" size={13} weight="bold" color="#ffffff">
                    {saving ? '저장 중...' : '＋ 컬렉션에 등록'}
                  </PixelText>
                </Pressable>
              ) : (
                <PixelPress onPress={onSave} disabled={saving} bg={tc.gold} hi={tc.goldLt} lo={tc.goldDk}>
                  <View style={{ paddingVertical: 13, alignItems: 'center' }}>
                    <PixelText variant={txt} size={11} weight="bold">
                      {saving ? '저장 중...' : '＋ 컬렉션에 등록'}
                    </PixelText>
                  </View>
                </PixelPress>
              )}
              <View style={{ height: 18 }} />
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
