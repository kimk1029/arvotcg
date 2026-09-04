/**
 * 카드 등록 폼 — 카드 추가(스캔/직접입력) 등록 단계(scan.tsx)와 시세상세
 * '내 컬렉션에 추가' 팝업(CardRegisterSheet)이 공유하는 단일 폼.
 * 웹은 CardRegisterSheet 하나를 등록페이지·상세 모달 양쪽에서 쓰는 것과 동일 구조.
 *
 * 구성(순서 고정): 카드 미리보기 → 직접뽑기 → 구입가격(통화 토글) → 날짜+수량
 * → 발매지역 → 등급 → 메모 → 등록 CTA.
 * 저장: 로컬 컬렉션(addCards) + 서버(/api/me/cards, createMyCard) 양쪽. 완료 시 onSaved(card).
 */
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { CardThumb } from '@/components/cv/CardThumb';
import { useTheme, useThemeColors } from '@/components/ThemeProvider';
import {
  cardProfit,
  displayCardName,
  inferCardCurrency,
  priceLabel,
  type CardItem,
  type PriceCurrency,
} from '@/data/cardvault';
import { addCards } from '@/lib/collection';
import { createMyCard } from '@/lib/myApi';
import { usePriceMode } from '@/lib/priceMode';

/** 오늘을 YYYY-MM-DD 로. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 직접입력/등록 팔레트 — 웹 ManualAddForm CLEAN_P/VAR_P 미러 (클린=프로토타입 고정색, 그 외=테마 토큰). */
export interface ManualPalette {
  pageBg: string; ink: string; ink2: string; ink3: string; accent: string; accentSoft: string;
  line: string; fieldBg: string; fieldBd: string; nameBg: string; radioBd: string;
  btnBg: string; btnFg: string; disBg: string; disFg: string; red: string; cta: string;
}

export function useManualPalette(): ManualPalette {
  const tc = useThemeColors();
  const { theme } = useTheme();
  const mclean = theme === 'clean';
  return {
    pageBg: mclean ? '#ffffff' : tc.paper,
    ink: mclean ? '#16161a' : tc.ink,
    ink2: mclean ? '#8E8E93' : tc.ink2,
    ink3: mclean ? '#9A9AA0' : tc.ink3,
    accent: mclean ? '#FF7A00' : tc.gold,
    accentSoft: mclean ? '#FFF6EE' : tc.pap2,
    line: mclean ? '#F0F0F2' : tc.pap3,
    fieldBg: mclean ? '#F7F7F9' : tc.pap2,
    fieldBd: mclean ? '#E5E5EA' : tc.pap3,
    nameBg: mclean ? '#F2F2F4' : tc.pap2,
    radioBd: mclean ? '#D2D2D8' : tc.ink3,
    btnBg: mclean ? '#16161a' : tc.ink,
    btnFg: mclean ? '#ffffff' : tc.paper,
    disBg: mclean ? '#F2F2F4' : tc.pap2,
    disFg: mclean ? '#B0B0B6' : tc.ink3,
    red: mclean ? '#F5333F' : tc.red,
    cta: mclean ? '#0E7C66' : tc.grn,
  };
}

export function MCheckRow({ P, on, onPress, label, sub }: { P: ManualPalette; on: boolean; onPress: () => void; label: string; sub?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: 12, borderRadius: 12,
        backgroundColor: on ? P.accentSoft : P.fieldBg,
        borderWidth: 1.5, borderColor: on ? P.accent : P.fieldBd,
      }}
    >
      <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: on ? P.accent : P.radioBd, backgroundColor: on ? P.accent : P.pageBg, alignItems: 'center', justifyContent: 'center' }}>
        {on ? <PixelText variant="ko" size={11} weight="bold" color="#ffffff">✓</PixelText> : null}
      </View>
      <View style={{ flex: 1 }}>
        <PixelText variant="ko" size={12} weight="bold" color={P.ink}>{label}</PixelText>
        {sub ? (
          <PixelText variant="ko" size={10} color={P.ink3} style={{ marginTop: 2, fontStyle: 'italic' }}>{sub}</PixelText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function MCatBtn({ P, active, onPress, label, compact }: { P: ManualPalette; active: boolean; onPress: () => void; label: string; compact?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: compact ? undefined : 1,
        paddingHorizontal: compact ? 10 : 0,
        paddingVertical: compact ? 7 : 10,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: active ? P.btnBg : P.pageBg,
        borderWidth: 1.5,
        borderColor: active ? P.btnBg : P.fieldBd,
      }}
    >
      <PixelText variant="ko" size={compact ? 11 : 12} weight="bold" color={active ? P.btnFg : P.ink}>{label}</PixelText>
    </Pressable>
  );
}

export function CardRegisterForm({
  card,
  onSaved,
}: {
  card: CardItem;
  /** 저장 완료 — 구매정보가 반영된 카드 전달 (호출측에서 결과 화면/닫기 처리). */
  onSaved: (saved: CardItem) => void;
}) {
  const MP = useManualPalette();
  const { mode: priceMode } = usePriceMode();

  const [buyYm, setBuyYm] = useState(todayStr());
  const [region, setRegion] = useState<'jp' | 'kr' | 'en'>('jp');
  const [memo, setMemo] = useState('');
  const [buyPriceStr, setBuyPriceStr] = useState('');
  // 시세가 JPY 인 카드는 구매가도 JPY 로 입력할 확률이 높다 → 기본 통화 맞춤.
  const [buyCur, setBuyCur] = useState<PriceCurrency>(() => inferCardCurrency(card));
  const [buyQty, setBuyQty] = useState(1);
  const [selfPulled, setSelfPulled] = useState(false);
  // 스캔 센터링 추정이 있으면 등급 토글 기본 ON (웹 CardRegisterSheet 동일).
  const [graded, setGraded] = useState(card.grade != null || !!card.gradeEstimate);
  const [gradeCompany, setGradeCompany] = useState('PSA');
  const [gradeValue, setGradeValue] = useState(card.grade != null ? String(card.grade) : '');
  const [saving, setSaving] = useState(false);

  /** 구매정보를 카드에 반영해 로컬+서버 저장. */
  const finalize = async () => {
    if (saving) return;
    setSaving(true);
    const gradingPatch: Partial<CardItem> = graded
      ? { graded: true, gradeCompany: gradeCompany.trim() || undefined, gradeValue: gradeValue.trim() || undefined }
      : { graded: false };

    let saved: CardItem;
    if (selfPulled) {
      // 직접뽑기 — 등록 시점 현재시세를 기준가로 박는다.
      const basis = card.priceSingle ?? card.price;
      saved = {
        ...card,
        ...gradingPatch,
        selfPulled: true,
        buyPrice: basis > 0 ? basis : undefined,
        buyCurrency: inferCardCurrency(card),
        qty: Math.max(1, buyQty),
        buyDate: buyYm || undefined,
      };
    } else {
      const price = parseInt(buyPriceStr, 10);
      saved = !(price > 0)
        ? { ...card, ...gradingPatch, selfPulled: false, qty: Math.max(1, buyQty) }
        : {
            ...card,
            ...gradingPatch,
            selfPulled: false,
            buyPrice: price,
            buyCurrency: buyCur,
            qty: Math.max(1, buyQty),
            buyDate: buyYm || undefined,
          };
    }
    // 로컬 캐시(홈 등 로컬 기반 화면용) + 서버 DB 양쪽에 저장.
    // 서버 저장을 기다린 뒤 onSaved — 안 기다리면 내 카드 화면이 SWR 무효화보다 먼저
    // 포커스돼 낡은 캐시(TTL 내)를 그대로 그려 총액에 새 카드가 합산되지 않는다.
    addCards([saved]);
    await createMyCard({
      snkrdunkApparelId: saved.snkrdunkApparelId ?? null,
      ocrSetCode: saved.set && saved.set !== '-' ? saved.set : null,
      ocrCardNumber: saved.num && saved.num !== '-' ? saved.num.split('/')[0] : null,
      nickname: saved.name ?? null,
      photoUrl: saved.snkrdunkApparelId ? null : saved.imageUrl ?? null,
      buyPrice: saved.buyPrice ?? null,
      buyCurrency: saved.buyCurrency ?? 'KRW',
      qty: saved.qty ?? 1,
      buyDate: saved.buyDate ?? null,
      region,
      memo: memo.trim() || null,
      selfPulled: saved.selfPulled ?? false,
      graded: saved.graded ?? false,
      gradeCompany: saved.gradeCompany ?? null,
      gradeValue: saved.gradeValue ?? null,
      gradeEstimate: saved.gradeEstimate ?? null,
      centeringScore: saved.centeringScore ?? null,
    }).catch((e) => {
      console.warn('[CardRegisterForm] createMyCard 실패:', (e as Error)?.message ?? e);
    });
    setSaving(false);
    onSaved(saved);
  };

  return (
    <View style={{ gap: 14 }}>
      {/* 카드 미리보기 — 웹 cv-reg-preview */}
      <View style={{ flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center', backgroundColor: MP.fieldBg, borderRadius: 14 }}>
        <View style={{ width: 56, height: 78, borderRadius: 8, overflow: 'hidden', backgroundColor: MP.pageBg }}>
          <CardThumb card={card} height={78} emojiSize={26} showLabel={false} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText variant="ko" size={13} weight="bold" color={MP.ink} numberOfLines={2}>{displayCardName(card.name)}</PixelText>
          <PixelText variant="ko" size={11} color={MP.ink3} style={{ marginTop: 3 }}>
            {[card.set !== '-' ? card.set : '', card.num !== '-' ? card.num : ''].filter(Boolean).join(' · ') || '세트/번호 미상'}
          </PixelText>
          <PixelText variant="ko" size={11} weight="bold" color={MP.ink} style={{ marginTop: 6 }}>
            현재시세 {priceLabel(cardProfit(card, priceMode).currentKrw, 'KRW')}
          </PixelText>
        </View>
      </View>

      {/* 직접뽑기 — 웹 cv-reg-check */}
      <MCheckRow P={MP} on={selfPulled} onPress={() => setSelfPulled((v) => !v)} label="직접 뽑은 카드예요" sub="(구입가 대신 현재시세를 기준가로)" />

      {/* 구입가격 — 라벨 우측 통화 토글, 인풋 안 단위 (웹 동일) */}
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <PixelText variant="ko" size={11} weight="bold" color={MP.ink2} style={{ paddingLeft: 2 }}>구입가격</PixelText>
          {!selfPulled ? (
            <View style={{ flexDirection: 'row', backgroundColor: MP.fieldBg, borderRadius: 999, padding: 2 }}>
              {(['KRW', 'JPY'] as PriceCurrency[]).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setBuyCur(c)}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: buyCur === c ? MP.btnBg : 'transparent' }}
                >
                  <PixelText variant="ko" size={10} weight="bold" color={buyCur === c ? MP.btnFg : MP.ink3}>
                    {c === 'JPY' ? '¥ 엔화' : '₩ 원화'}
                  </PixelText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        {selfPulled ? (
          <View style={{ backgroundColor: MP.fieldBg, borderRadius: 12, padding: 12 }}>
            <PixelText variant="ko" size={11} color={MP.ink3} style={{ lineHeight: 17 }}>
              현재시세 {priceLabel(cardProfit(card, priceMode).currentKrw / Math.max(1, buyQty), 'KRW')} 적용
            </PixelText>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: MP.pageBg, borderWidth: 1.5, borderColor: MP.fieldBd, borderRadius: 12, paddingHorizontal: 12 }}>
            <PixelText variant="ko" size={14} weight="bold" color={MP.ink2}>{buyCur === 'JPY' ? '¥' : '₩'}</PixelText>
            <TextInput
              value={buyPriceStr}
              onChangeText={setBuyPriceStr}
              placeholder={buyCur === 'JPY' ? '엔화 금액' : '원화 금액'}
              placeholderTextColor={MP.ink3}
              keyboardType="numeric"
              style={{ flex: 1, paddingVertical: 12, fontSize: 15, fontWeight: '700', color: MP.ink, padding: 0, paddingLeft: 2 }}
            />
          </View>
        )}
      </View>

      {/* 구입 날짜 + 수량 — 나란히 (웹 cv-manual-row) */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <PixelText variant="ko" size={11} weight="bold" color={MP.ink2} style={{ marginBottom: 6, paddingLeft: 2 }}>구입 날짜</PixelText>
          <View style={{ backgroundColor: MP.pageBg, borderWidth: 1.5, borderColor: MP.fieldBd, borderRadius: 12, paddingHorizontal: 12 }}>
            <TextInput
              value={buyYm}
              onChangeText={setBuyYm}
              placeholder="2026-08-04"
              placeholderTextColor={MP.ink3}
              style={{ paddingVertical: 12, fontSize: 13, fontWeight: '700', color: MP.ink, padding: 0 }}
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <PixelText variant="ko" size={11} weight="bold" color={MP.ink2} style={{ marginBottom: 6, paddingLeft: 2 }}>수량</PixelText>
          <View style={{ flexDirection: 'row', alignItems: 'stretch', borderWidth: 1.5, borderColor: MP.fieldBd, borderRadius: 12, backgroundColor: MP.pageBg, overflow: 'hidden' }}>
            <Pressable onPress={() => setBuyQty((q) => Math.max(1, q - 1))} style={{ width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: MP.fieldBg }}>
              <PixelText variant="ko" size={15} weight="bold" color={MP.ink}>−</PixelText>
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
              <PixelText variant="ko" size={14} weight="bold" color={MP.ink}>{buyQty}</PixelText>
            </View>
            <Pressable onPress={() => setBuyQty((q) => Math.min(999, q + 1))} style={{ width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: MP.fieldBg }}>
              <PixelText variant="ko" size={15} weight="bold" color={MP.ink}>＋</PixelText>
            </Pressable>
          </View>
        </View>
      </View>

      {/* 발매 지역 — 웹 동일 3버튼 */}
      <View>
        <PixelText variant="ko" size={11} weight="bold" color={MP.ink2} style={{ marginBottom: 6, paddingLeft: 2 }}>발매 지역</PixelText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([
            ['jp', '일본판'],
            ['kr', '한국판'],
            ['en', '영문판'],
          ] as const).map(([k, lb]) => (
            <MCatBtn key={k} P={MP} active={region === k} onPress={() => setRegion(k)} label={lb} />
          ))}
        </View>
      </View>

      {/* 등급여부 — 웹 cv-reg-check + 등급사/등급 */}
      <MCheckRow P={MP} on={graded} onPress={() => setGraded((v) => !v)} label="등급(그레이딩) 카드예요" />
      {graded ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.4 }}>
            <PixelText variant="ko" size={11} weight="bold" color={MP.ink2} style={{ marginBottom: 6, paddingLeft: 2 }}>등급사</PixelText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['PSA', 'BGS', 'CGC', 'SGC', 'ARS'].map((co) => (
                <MCatBtn key={co} P={MP} active={gradeCompany === co} onPress={() => setGradeCompany(co)} label={co} compact />
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <PixelText variant="ko" size={11} weight="bold" color={MP.ink2} style={{ marginBottom: 6, paddingLeft: 2 }}>등급</PixelText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {['10', '9', '8'].map((v) => (
                <MCatBtn key={v} P={MP} active={gradeValue === v} onPress={() => setGradeValue(v)} label={v} compact />
              ))}
            </View>
            <View style={{ backgroundColor: MP.pageBg, borderWidth: 1.5, borderColor: MP.fieldBd, borderRadius: 12, paddingHorizontal: 12 }}>
              <TextInput
                value={gradeValue}
                onChangeText={setGradeValue}
                placeholder="예) 10"
                placeholderTextColor={MP.ink3}
                keyboardType="numeric"
                maxLength={6}
                style={{ paddingVertical: 10, fontSize: 13, fontWeight: '700', color: MP.ink, padding: 0 }}
              />
            </View>
          </View>
        </View>
      ) : null}

      {/* 메모 — 웹 동일 */}
      <View>
        <PixelText variant="ko" size={11} weight="bold" color={MP.ink2} style={{ marginBottom: 6, paddingLeft: 2 }}>메모 (선택)</PixelText>
        <View style={{ backgroundColor: MP.pageBg, borderWidth: 1.5, borderColor: MP.fieldBd, borderRadius: 12, paddingHorizontal: 12 }}>
          <TextInput
            value={memo}
            onChangeText={setMemo}
            placeholder="구입 경로, 보관 위치, 컨디션 등"
            placeholderTextColor={MP.ink3}
            multiline
            maxLength={500}
            style={{ paddingVertical: 11, fontSize: 13, fontWeight: '600', color: MP.ink, minHeight: 72, textAlignVertical: 'top', padding: 0 }}
          />
        </View>
      </View>

      {/* 등록 CTA — 웹 cv-manual-submit(clean: 에메랄드 채움 라운드) */}
      <Pressable
        onPress={finalize}
        disabled={saving}
        style={{
          height: 50,
          borderRadius: 14,
          backgroundColor: MP.cta,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: saving ? 0.6 : 1,
          elevation: 4,
          shadowColor: MP.cta,
          shadowOpacity: 0.3,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          marginTop: 2,
        }}
      >
        <PixelText variant="ko" size={14} weight="bold" color="#ffffff">{saving ? '저장 중...' : '＋ 컬렉션에 등록'}</PixelText>
      </Pressable>
    </View>
  );
}
