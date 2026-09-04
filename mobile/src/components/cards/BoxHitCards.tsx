/**
 * 박스 시세상세의 '힛카드 목록' — 해당 박스에서 나오는 싱글카드를 비싼 순으로
 * 가로 스크롤(스와이프)로 나열. 홈 'HOT 카드' 캐러셀과 같은 타일이지만
 * 자동으로 흘러가지 않고 손으로만 넘긴다(요구사항). 웹 src/components/cards/BoxHitCards 와 페어.
 *
 * 데이터는 팩 카탈로그 정본(NAS `/api/card-packs/{code}`) 하나만 쓴다 —
 * 기기에서 시세를 다시 계산하지 않는다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { PixelText } from '@/components/PixelText';
import { SectHd } from '@/components/cv/SectHd';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { GradeMark } from '@/components/cv/GradeMark';
import { useCurrency } from '@/components/CurrencyProvider';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { fetchPackHits, type PackHitCard } from '@/lib/myApi';

/** 가로로 보여줄 최대 장수 — 비싼 순 상위만(전체는 팩 페이지에서). */
const MAX = 20;
const TILE_W = 100;
const THUMB_H = 138;
/**
 * 가로 ScrollView 고정 높이 — RN 0.81 Fabric 안드로이드는 이 화면의 가로 SV
 * 콘텐츠 높이를 NaN 으로 측정해 이후 섹션이 통째로 사라진다(등급 카드와 같은 버그).
 * 썸네일 + 이름/가격 두 줄 + 상하 패딩.
 */
const ROW_H = THUMB_H + 52;

function hitPrice(h: PackHitCard): number {
  return h.headlinePrice > 0 ? h.headlinePrice : h.minPrice;
}

export function BoxHitCards({ packCode, setCode }: { packCode: string; setCode?: string | null }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { format } = useCurrency();
  const [hits, setHits] = useState<PackHitCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPackHits(packCode, 600)
      .then((pack) => {
        if (!alive) return;
        const singles = (pack?.hits ?? []).filter((h) => h.itemKind === 'single');
        singles.sort((a, b) => hitPrice(b) - hitPrice(a));
        setHits(singles.slice(0, MAX));
      })
      .catch(() => alive && setHits([]));
    return () => {
      alive = false;
    };
  }, [packCode]);

  const rankColor = useMemo(
    () => (rank: number) => (rank === 1 ? tc.gold : rank === 2 ? '#9AA0A6' : rank === 3 ? '#C8732B' : tc.ink),
    [tc],
  );

  // 조회 중/없음이면 섹션 자체를 만들지 않는다 (빈 상자 방지).
  if (hits !== null && hits.length === 0) return null;

  return (
    <>
      <View style={{ marginHorizontal: 14 }}>
        <SectHd
          title="🔥 힛카드 목록"
          more={setCode ? `${setCode.toUpperCase()} 전체 ›` : '전체 보기 ›'}
          onMore={() => router.push(`/cards/packs/${packCode}` as never)}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: ROW_H }}
        contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 12, gap: 12 }}
      >
        {(hits ?? []).map((h, i) => (
          <Pressable
            key={h.apparelId}
            onPress={() =>
              router.push(
                `/cards/snkrdunk/${h.apparelId}${h.headlineBasis ? `?grade=${encodeURIComponent(h.headlineBasis)}` : ''}` as never,
              )
            }
            style={{ width: TILE_W }}
          >
            <View style={{ width: TILE_W, height: THUMB_H, borderRadius: 11, overflow: 'hidden', backgroundColor: tc.pap2 }}>
              <ThumbImage uri={h.imageUrl} style={{ width: TILE_W, height: THUMB_H }} resizeMethod="resize" emojiSize={30} />
              <View
                style={{
                  position: 'absolute', top: 6, left: 6, width: 21, height: 21, borderRadius: 11,
                  backgroundColor: rankColor(i + 1), alignItems: 'center', justifyContent: 'center',
                }}
              >
                <PixelText variant={txt} size={10} weight="bold" color={tc.white}>{String(i + 1)}</PixelText>
              </View>
              {/* 대표가가 PSA10 기준이면 우하단 표식 — 목록 어디서나 같은 규칙(웹 동일). */}
              {h.headlineBasis === 'PSA 10' ? <GradeMark company="PSA" grade="10" height={9} /> : null}
            </View>
            <PixelText variant="ko" size={10} weight="bold" color={tc.ink} numberOfLines={1} style={{ marginTop: 8 }}>
              {h.shortName || h.koName || h.name}
            </PixelText>
            <PixelText variant={txt} size={11} weight="bold" color={tc.ink} numberOfLines={1} style={{ marginTop: 3 }}>
              {hitPrice(h) > 0 ? format(hitPrice(h)) : '—'}
            </PixelText>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}
