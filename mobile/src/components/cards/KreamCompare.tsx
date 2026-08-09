/**
 * 시세 비교 — SNKRDUNK(엔화) vs KREAM(원화)를 통화 설정(엔/원)에 맞춰 나란히 보여준다.
 * 웹 src/components/cards/KreamCompare.tsx 의 모바일 포팅.
 * KREAM 은 코드(세트코드+번호) 우선 검색 → 빈결과면 카드명 폴백(웹 동일).
 * 코드 결과는 pickKreamByCode, 이름 결과는 bestKreamMatch 로 선별.
 */
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { SectHd } from '@/components/cv/SectHd';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import { api } from '@/lib/apiClient';
import {
  bestKreamMatch,
  kreamSearchQuery,
  pickKreamByCode,
  type KreamItemLite,
} from '../../../../shared/util/kreamMatch';

type KreamItem = KreamItemLite; // { id, name, price(KRW), imageUrl, productUrl }

export function KreamCompare({
  query,
  snkrPriceJpy,
  cardNumber,
  setCode,
  rarity,
}: {
  query: string;
  snkrPriceJpy: number;
  cardNumber?: string | null;
  setCode?: string | null;
  rarity?: string | null;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { rate, mode, format } = useCurrency();
  // 비교 계산은 JPY 단일 기준 — 표시만 통화 설정(format)에 따른다. KREAM price 는 원화 원본.
  const fmt = (jpy: number) => (!jpy || jpy <= 0 ? '—' : format(jpy));
  const [state, setState] = useState<'loading' | 'done'>('loading');
  const [items, setItems] = useState<KreamItem[]>([]);
  // 코드(setCode+번호) 검색으로 받은 결과인지 — 선별 로직이 갈린다(웹 동일).
  const [viaCode, setViaCode] = useState(false);

  // 코드 우선 검색 → 빈결과면 카드명으로 폴백.
  const { q: searchKw, byCode } = useMemo(
    () => kreamSearchQuery({ cardNumber, setCode, rarity }, query),
    [cardNumber, setCode, rarity, query],
  );

  useEffect(() => {
    if (!searchKw) {
      setState('done');
      return;
    }
    let alive = true;
    setState('loading');
    const getItems = async (kw: string): Promise<KreamItem[]> => {
      try {
        const j = await api<{ items?: KreamItem[] }>(`/api/kream/search?q=${encodeURIComponent(kw)}`, { auth: false });
        return j.items ?? [];
      } catch {
        return [];
      }
    };
    (async () => {
      let its = await getItems(searchKw);
      let code = byCode;
      if (byCode && its.length === 0) {
        its = await getItems(query); // 코드 검색 빈결과 → 이름 폴백
        code = false;
      }
      if (!alive) return;
      setItems(its);
      setViaCode(code);
      setState('done');
    })();
    return () => {
      alive = false;
    };
  }, [searchKw, byCode, query]);

  const item = useMemo(
    () =>
      viaCode
        ? pickKreamByCode(items, { cardNumber, setCode, rarity })
        : bestKreamMatch(items, query, { cardNumber, setCode, rarity }),
    [items, viaCode, query, cardNumber, setCode, rarity],
  );

  const searchUrl = `https://kream.co.kr/search?keyword=${encodeURIComponent(searchKw || query)}`;
  const snkrJpy = snkrPriceJpy > 0 ? snkrPriceJpy : 0;
  // KREAM price 는 원화 → 환율로 엔화 환산해 동일 기준으로 비교.
  const kreamJpy = item?.price && rate > 0 ? item.price / rate : 0;

  const cmp = useMemo(() => {
    if (snkrJpy <= 0 || kreamJpy <= 0) return null;
    const diff = kreamJpy - snkrJpy;
    const cheaper = diff > 0 ? 'snkr' : diff < 0 ? 'kream' : 'same';
    const pct = (Math.abs(diff) / Math.min(snkrJpy, kreamJpy)) * 100;
    return { diff, cheaper, pct };
  }, [snkrJpy, kreamJpy]);

  return (
    <>
      <View style={{ marginHorizontal: 14 }}>
        <SectHd title="시세 비교" more="SNKRDUNK vs 크림" />
      </View>
      <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
        <PixelFrame bg={tc.white}>
          <View style={{ padding: 16 }}>
            {/* 비교 기준 — 양쪽 모두 RAW(비등급) 동일 기준 (웹 KreamCompare 동일). */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ backgroundColor: tc.pap2, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999 }}>
                <PixelText variant={txt} size={9} weight="bold" color={tc.grn} style={{ letterSpacing: 0.3 }}>
                  RAW · 비등급 기준 비교
                </PixelText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10 }}>
              <Col tc={tc} txt={txt} name="SNKRDUNK" sub={mode === 'krw' ? 'RAW 최근거래가 · 원화환산' : 'RAW 최근거래가'} price={fmt(snkrJpy)} highlight={cmp?.cheaper === 'snkr'} />
              <View style={{ width: 1, backgroundColor: tc.pap3 }} />
              <Col
                tc={tc}
                txt={txt}
                name="크림 KREAM"
                sub={mode === 'jpy' ? 'RAW 즉시판매가 · 엔화환산' : 'RAW 즉시판매가'}
                price={state === 'loading' ? '조회 중…' : fmt(kreamJpy)}
                highlight={cmp?.cheaper === 'kream'}
                onPress={item?.productUrl ? () => Linking.openURL(item.productUrl).catch(() => {}) : undefined}
              />
            </View>

            {cmp ? (
              <View style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: tc.pap2 }}>
                {cmp.cheaper === 'same' ? (
                  <PixelText variant={txt} size={11} weight="bold" color={tc.ink} style={{ textAlign: 'center' }}>
                    두 플랫폼 시세가 비슷해요
                  </PixelText>
                ) : (
                  <PixelText variant={txt} size={11} weight="bold" color={tc.ink} style={{ textAlign: 'center' }}>
                    <PixelText variant={txt} size={11} weight="bold" color={cmp.cheaper === 'snkr' ? tc.blu : tc.red}>
                      {cmp.cheaper === 'snkr' ? 'SNKRDUNK' : '크림'}
                    </PixelText>
                    {' 이 '}
                    <PixelText variant={txt} size={11} weight="bold" color={tc.red}>{fmt(Math.abs(cmp.diff))}</PixelText>
                    {` 저렴 (${cmp.pct.toFixed(1)}%)`}
                  </PixelText>
                )}
              </View>
            ) : null}

            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <PixelText variant={txt} size={9} color={tc.ink3} numberOfLines={1} style={{ flex: 1 }}>
                {state === 'loading' ? '크림 시세 조회 중…' : item ? `크림 매칭: ${item.name}` : '크림에서 일치하는 상품을 찾지 못했어요'}
              </PixelText>
              <Pressable onPress={() => Linking.openURL(item?.productUrl ?? searchUrl).catch(() => {})} hitSlop={6}>
                <PixelText variant={txt} size={10} weight="bold" color={tc.blu}>크림에서 보기 ↗</PixelText>
              </Pressable>
            </View>
            <PixelText variant={txt} size={8} color={tc.ink3} style={{ marginTop: 8, lineHeight: 13 }}>
              · 이베이·메루카리·야후옥션 비교는 준비 중이에요.
            </PixelText>
          </View>
        </PixelFrame>
      </View>
    </>
  );
}

function Col({
  tc,
  txt,
  name,
  sub,
  price,
  highlight,
  onPress,
}: {
  tc: ReturnType<typeof useThemeColors>;
  txt: 'pixel' | 'ko';
  name: string;
  sub: string;
  price: string;
  highlight?: boolean;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <PixelText variant={txt} size={11} weight="bold" color={tc.ink}>{name}</PixelText>
      <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 3 }}>{sub}</PixelText>
      <PixelText variant={txt} size={16} weight="bold" color={highlight ? tc.red : tc.ink} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 8 }}>
        {price}
      </PixelText>
      {highlight ? (
        <View style={{ alignSelf: 'flex-start', marginTop: 5, backgroundColor: tc.red, paddingHorizontal: 6, paddingVertical: 2 }}>
          <PixelText variant={txt} size={8} weight="bold" color={tc.white}>최저</PixelText>
        </View>
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable style={{ flex: 1, minWidth: 0 }} onPress={onPress}>{inner}</Pressable>
  ) : (
    <View style={{ flex: 1, minWidth: 0 }}>{inner}</View>
  );
}
