/**
 * 카메라 fast scan 결과 — 찍은 카드별 **탭**으로 분리해서 보여준다.
 *
 * 한 세션에 여러 장을 찍으면 탭이 장수만큼 생기고, 탭 하나에 그 카드의 코드
 * 인식 결과 + 코드로 찾은 후보 목록이 들어간다. 인식/검색은 촬영 즉시
 * [[useFastScan]] 이 백그라운드로 돌리므로 여기서는 상태만 그린다.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { SnkrdunkCardTile } from '@/components/cv/SnkrdunkCardTile';
import { EmptyState } from '@/components/cv/ListState';
import { useThemeColors, useThemeTextVariant, useTheme } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { useCurrency } from '@/components/CurrencyProvider';
import { rarityMetaOf } from '@/lib/cardRarity';
import type { ScanShot } from '@/lib/useFastScan';
import type { CardByCode } from '@/services/snkrdunk';

const STATUS_LABEL: Record<ScanShot['status'], string> = {
  reading: '코드 인식 중…',
  searching: '카드 찾는 중…',
  done: '',
  nocode: '코드를 못 읽었어요',
  empty: '해당 코드의 카드를 못 찾았어요',
};

interface Props {
  shots: ScanShot[];
  /** 후보 카드 선택 — 시세 상세/등록으로 보낸다. */
  onPickCard: (card: CardByCode, shot: ScanShot) => void;
  /** 카메라로 돌아가 더 찍기. */
  onAddMore: () => void;
  /** 이 촬영분 버리기. */
  onRemove: (id: string) => void;
  /** 코드로 못 찾았을 때 — 카드 전체를 AI 로 정밀 인식(기존 스캔 경로). */
  onPrecise: (shot: ScanShot) => void;
}

export function FastScanResults({ shots, onPickCard, onAddMore, onRemove, onPrecise }: Props) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { theme } = useTheme();
  const flat = isFlatTheme(theme);
  const { format: formatCurrency } = useCurrency();
  const [activeId, setActiveId] = useState<string | null>(shots[0]?.id ?? null);

  // 탭이 지워지거나 새로 생기면 유효한 탭으로 보정.
  useEffect(() => {
    if (shots.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !shots.some((s) => s.id === activeId)) setActiveId(shots[0].id);
  }, [shots, activeId]);

  const active = shots.find((s) => s.id === activeId) ?? shots[0] ?? null;
  if (!active) {
    return (
      <View style={{ margin: 14 }}>
        <EmptyState icon="📷" title="찍은 카드가 없어요" ctaLabel="카메라 열기" onCtaPress={onAddMore} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* 탭 바 — 찍은 순서대로. 가로 스크롤 대신 줄바꿈(안드로이드 가로 SV 높이 이슈 회피). */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 10,
        }}
      >
        {shots.map((s, i) => {
          const on = s.id === active.id;
          const busy = s.status === 'reading' || s.status === 'searching';
          return (
            <Pressable
              key={s.id}
              onPress={() => setActiveId(s.id)}
              accessibilityState={{ selected: on }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: on ? (flat ? tc.ink : tc.gold) : tc.pap2,
                borderWidth: 1,
                borderColor: on ? (flat ? tc.ink : tc.ink) : flat ? tc.pap3 : tc.ink,
                borderRadius: flat ? 999 : 0,
              }}
            >
              <PixelText variant={txt} size={9} weight={on ? 'bold' : 'normal'} color={on ? (flat ? tc.white : tc.ink) : tc.ink3}>
                카드 {i + 1}
              </PixelText>
              {busy ? (
                <ActivityIndicator size="small" color={on ? (flat ? tc.white : tc.ink) : tc.ink3} />
              ) : (
                <PixelText variant={txt} size={8} color={on ? (flat ? tc.white : tc.ink) : tc.ink3} style={{ opacity: 0.8 }}>
                  {s.status === 'done' ? `${s.cards.length}` : '!'}
                </PixelText>
              )}
            </Pressable>
          );
        })}

        <Pressable
          onPress={onAddMore}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: tc.white,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: flat ? tc.pap3 : tc.ink,
            borderRadius: flat ? 999 : 0,
          }}
        >
          <PixelText variant={txt} size={9} color={tc.ink2}>+ 더 찍기</PixelText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 인식 결과 헤더 — 찍은 사진 + 읽어낸 코드 */}
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            marginHorizontal: 14,
            marginBottom: 12,
            padding: 10,
            backgroundColor: tc.white,
            borderWidth: 1,
            borderColor: flat ? tc.pap3 : tc.ink,
            borderRadius: flat ? 14 : 0,
          }}
        >
          <ThumbImage uri={active.cardUri} size={72} borderColor={flat ? undefined : tc.ink} />
          <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 4 }}>
            {active.code?.setCode || active.code?.cardNumber ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <PixelText variant={txt} size={13} weight="bold" color={tc.ink}>
                  {active.code?.setCode ?? '?'} {active.code?.cardNumber ?? '?'}
                </PixelText>
                {active.code?.rarity ? (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      backgroundColor: rarityMetaOf(active.code.rarity).bg,
                      borderRadius: flat ? 999 : 0,
                    }}
                  >
                    <PixelText variant={txt} size={8} weight="bold" color={rarityMetaOf(active.code.rarity).fg}>
                      {rarityMetaOf(active.code.rarity).label}
                    </PixelText>
                  </View>
                ) : null}
              </View>
            ) : (
              <PixelText variant="ko" size={11} color={tc.ink3}>
                {STATUS_LABEL[active.status] || '코드 없음'}
              </PixelText>
            )}
            <PixelText variant={txt} size={8} color={tc.ink3}>
              {active.status === 'done'
                ? `${active.cards.length}건 · ${active.source === 'db' ? 'DB' : '신규 수집'} · ${active.elapsedMs}ms`
                : STATUS_LABEL[active.status]}
              {active.engine === 'server' ? ' · 서버인식' : ''}
            </PixelText>
            <Pressable onPress={() => onRemove(active.id)} hitSlop={6}>
              <PixelText variant={txt} size={8} color={tc.red}>이 촬영 지우기</PixelText>
            </Pressable>
          </View>
        </View>

        {/* 후보 목록 */}
        {active.status === 'reading' || active.status === 'searching' ? (
          <View style={{ paddingVertical: 30, alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={tc.gold} />
            <PixelText variant="ko" size={10} color={tc.ink3}>{STATUS_LABEL[active.status]}</PixelText>
            {/* 앱 실행 후 첫 인식은 문자인식 모델을 올리느라 몇 초 더 걸린다. */}
            {shots[0]?.id === active.id && active.status === 'reading' ? (
              <PixelText variant="ko" size={9} color={tc.ink3} style={{ opacity: 0.8 }}>
                첫 장은 문자인식 준비로 몇 초 걸려요
              </PixelText>
            ) : null}
          </View>
        ) : active.cards.length === 0 ? (
          <View style={{ marginHorizontal: 14 }}>
            <EmptyState
              icon="🔎"
              title={STATUS_LABEL[active.status] || '결과가 없어요'}
              desc={
                active.status === 'nocode'
                  ? '카드 좌하단(세트코드·번호)이 가이드 안에 오도록 다시 찍어 주세요.'
                  : `${active.code?.setCode ?? ''} ${active.code?.cardNumber ?? ''}`.trim()
              }
              ctaLabel="다시 찍기"
              onCtaPress={onAddMore}
            />
            {/* 코드가 안 읽히는 카드(구권·프로모 등)를 위한 기존 AI 정밀 인식 경로. */}
            <Pressable
              onPress={() => onPrecise(active)}
              style={{
                marginTop: 10,
                paddingVertical: 11,
                alignItems: 'center',
                backgroundColor: tc.white,
                borderWidth: 1,
                borderColor: flat ? tc.pap3 : tc.ink,
                borderRadius: flat ? 12 : 0,
              }}
            >
              <PixelText variant="ko" size={11} color={tc.ink}>AI 로 정밀 인식하기</PixelText>
            </Pressable>
          </View>
        ) : (
          <View style={{ marginHorizontal: 14, gap: 8 }}>
            {active.cards.map((c) => (
              <SnkrdunkCardTile
                key={c.apparelId}
                variant="row"
                onPress={() => onPickCard(c, active)}
                imageUrl={c.cdnImageUrl ?? c.imageUrl}
                koName={c.koName || c.shortName || c.name}
                subName={c.name}
                priceText={c.priceSingle > 0 ? formatCurrency(c.priceSingle) : c.minPrice > 0 ? formatCurrency(c.minPrice) : null}
                metaText={[c.setCode && c.cardNumber ? `${c.setCode} ${c.cardNumber}` : null, c.listingCount > 0 ? `매물 ${c.listingCount}건` : null]
                  .filter(Boolean)
                  .join(' · ') || null}
                thumbResizeMethod="resize"
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
