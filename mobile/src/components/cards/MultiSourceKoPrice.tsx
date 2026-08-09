/**
 * 한국판 멀티소스 시세 — 웹 MultiSourceKoPrice 패리티.
 * KREAM·TCGBox·네이버카페 등 국내 소스의 체결/판매가를 카드 코드+번호+등급으로
 * 매칭해 한 줄씩. 행 탭 시 소스 페이지 열기. (현재 KREAM 활성, 나머지 순차 추가)
 */
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { SectHd } from '@/components/cv/SectHd';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import { fetchKoPrices, type KoPriceQuery, type KoPriceRow } from '@/lib/koreaPrice';

export function MultiSourceKoPrice(props: KoPriceQuery) {
  const { name, setCode, cardNumber, rarity } = props;
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  // 국내 소스 가격은 KRW 원본 — 통화 설정이 엔화면 환율로 엔화 환산해 표시.
  const { mode, rate } = useCurrency();
  const fmt = (krw: number) =>
    mode === 'jpy' && rate > 0
      ? `¥${Math.round(krw / rate).toLocaleString('ja-JP')}`
      : `₩${Math.round(krw).toLocaleString('ko-KR')}`;
  const [state, setState] = useState<'loading' | 'done'>('loading');
  const [rows, setRows] = useState<KoPriceRow[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    setState('loading');
    fetchKoPrices({ name, setCode, cardNumber, rarity }, ctrl.signal)
      .then((r) => {
        setRows(r);
        setState('done');
      })
      .catch(() => setState('done'));
    return () => ctrl.abort();
  }, [name, setCode, cardNumber, rarity]);

  const low = useMemo(() => (rows.length ? Math.min(...rows.map((r) => r.price)) : 0), [rows]);

  return (
    <>
      <View style={{ marginHorizontal: 14, marginTop: 14 }}>
        <SectHd title="한국 시세" more={rows.length > 0 ? `${rows.length}개 소스` : undefined} />
      </View>
      <View style={{ marginHorizontal: 14, marginBottom: 4 }}>
        <PixelFrame bg={tc.white}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
            {state === 'loading' ? (
              <PixelText variant={txt} size={10} color={tc.ink3} style={{ textAlign: 'center', paddingVertical: 24 }}>
                국내 시세 조회 중…
              </PixelText>
            ) : rows.length === 0 ? (
              <PixelText variant={txt} size={10} color={tc.ink3} style={{ textAlign: 'center', paddingVertical: 24 }}>
                매칭되는 국내 시세가 아직 없어요
              </PixelText>
            ) : (
              rows.map((r, i) => {
                const isLow = r.price === low;
                const sold = r.kind === '체결';
                return (
                  <Pressable
                    key={`${r.source}-${i}`}
                    onPress={() => r.url && Linking.openURL(r.url).catch(() => {})}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 12,
                      borderBottomWidth: i < rows.length - 1 ? 1 : 0,
                      borderBottomColor: tc.pap3,
                    }}
                  >
                    <View style={{ minWidth: 64, alignItems: 'center', backgroundColor: tc.pap2, paddingVertical: 5, paddingHorizontal: 8 }}>
                      <PixelText variant={txt} size={10} weight="bold" color={tc.ink}>{r.label}</PixelText>
                    </View>
                    <View style={{ backgroundColor: tc.pap2, paddingVertical: 3, paddingHorizontal: 6 }}>
                      <PixelText variant={txt} size={8} weight="bold" color={sold ? tc.red : tc.ink3}>
                        {sold ? '체결가' : '판매가'}
                      </PixelText>
                    </View>
                    <View style={{ flex: 1 }} />
                    <PixelText variant={txt} size={13} weight="bold" color={isLow ? tc.red : tc.ink}>
                      {fmt(r.price)}
                    </PixelText>
                  </Pressable>
                );
              })
            )}
          </View>
        </PixelFrame>
        <PixelText variant={txt} size={8} color={tc.ink3} style={{ marginTop: 8, lineHeight: 13 }}>
          · 카드 코드·번호·등급으로 매칭한 국내 소스 시세예요. TCGBox·네이버카페 경매(체결가)는 순차 추가 중.
        </PixelText>
      </View>
    </>
  );
}
