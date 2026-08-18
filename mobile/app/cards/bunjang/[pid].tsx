/**
 * /cards/bunjang/[pid] — 번개장터 상품 상세 (웹 src/app/cards/bunjang/[pid]/page.tsx 포팅).
 * 리스트에서 매물을 누르면 외부 링크 대신 이 화면으로 들어와 이미지·설명·시세를 본다.
 */
import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelPress } from '@/components/cv/PixelPress';
import { LoadingState } from '@/components/cv/ListState';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { fetchBunjangProduct, type BunjangProduct } from '@/services/marketplace';
import { shotSource } from '@/lib/shotMode';

function fmtWon(n: number): string {
  if (!n || n <= 0) return '가격문의';
  return `${n.toLocaleString('ko-KR')}원`;
}

function fmtUpdated(ms: number): string {
  if (!ms) return '';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

/** 원본 비율을 유지해 폭 100%로 렌더(웹 width:100% height:auto 재현). */
function DetailImage({ uri }: { uri: string }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const [ratio, setRatio] = useState(0);
  useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (alive && w > 0 && h > 0) setRatio(w / h);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [uri]);
  return (
    <Image
      source={shotSource(uri)}
      style={{ width: '100%', aspectRatio: ratio || 1, borderWidth: 2, borderColor: tc.pap3, backgroundColor: tc.ink2 }}
      resizeMode="cover"
    />
  );
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 7, paddingVertical: 3, borderColor: tc.ink, borderWidth: 1 }}>
      <PixelText variant={txt} size={8} color={fg}>
        {label}
      </PixelText>
    </View>
  );
}

export default function BunjangDetailScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { pid } = useLocalSearchParams<{ pid?: string }>();
  const [product, setProduct] = useState<BunjangProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    fetchBunjangProduct(String(pid ?? ''))
      .then((p) => {
        if (!alive) return;
        if (p) setProduct(p);
        else setError(true);
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [pid]);

  const sold = product?.saleStatusText === '판매완료';

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="우리 장터 시세" />
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingState />
        </View>
      ) : error || !product ? (
        <View style={{ margin: 40, alignItems: 'center' }}>
          <PixelText variant="ko" size={12} color={tc.ink3} style={{ textAlign: 'center', lineHeight: 20 }}>
            상품을 불러오지 못했습니다.{'\n'}판매 종료됐거나 일시적인 오류일 수 있어요.
          </PixelText>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* 이미지 */}
          {product.images.length > 0 ? (
            <View style={{ gap: 10, marginHorizontal: 14, marginTop: 14 }}>
              {product.images.map((src) => (
                <DetailImage key={src} uri={src} />
              ))}
            </View>
          ) : null}

          {/* 제목·시세 */}
          <View style={{ paddingHorizontal: 14, paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              {product.saleStatusText ? (
                <Badge label={product.saleStatusText} bg={sold ? tc.ink3 : tc.grn} fg={tc.white} />
              ) : null}
              {product.conditionText ? <Badge label={product.conditionText} bg={tc.pap2} fg={tc.ink} /> : null}
            </View>

            <PixelText variant="ko" size={16} weight="bold" color={tc.ink} style={{ lineHeight: 23 }}>
              {product.name}
            </PixelText>

            <PixelText variant={txt} size={20} color={tc.red} style={{ marginTop: 12, letterSpacing: -0.5 }}>
              {fmtWon(product.price)}
            </PixelText>

            {/* 메타 */}
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              <PixelText variant={txt} size={9} color={tc.ink3}>❤ 찜 {product.favCount}</PixelText>
              <PixelText variant={txt} size={9} color={tc.ink3}>👁 조회 {product.viewCount}</PixelText>
              <PixelText variant={txt} size={9} color={tc.ink3}>💬 {product.commentCount}</PixelText>
              {product.freeShipping ? (
                <PixelText variant={txt} size={9} color={tc.grnDk}>무료배송</PixelText>
              ) : product.shippingFee > 0 ? (
                <PixelText variant={txt} size={9} color={tc.ink3}>
                  배송비 {product.shippingFee.toLocaleString('ko-KR')}원
                </PixelText>
              ) : null}
            </View>
            <PixelText variant={txt} size={8} color={tc.ink3} style={{ marginTop: 8, lineHeight: 13 }}>
              {[
                product.shopName,
                product.category,
                product.updatedAt > 0 ? `${fmtUpdated(product.updatedAt)} 갱신` : '',
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </PixelText>
          </View>

          {/* 설명 */}
          {product.description ? (
            <View
              style={{
                marginHorizontal: 14,
                marginTop: 16,
                padding: 14,
                backgroundColor: tc.pap2,
                borderWidth: 2,
                borderColor: tc.pap3,
              }}
            >
              <PixelText variant="ko" size={13} color={tc.ink} style={{ lineHeight: 20 }}>
                {product.description}
              </PixelText>
            </View>
          ) : null}

          {/* 번개장터로 이동 */}
          <View style={{ marginHorizontal: 14, marginTop: 16 }}>
            <PixelPress onPress={() => Linking.openURL(product.productUrl)} bg={tc.red} borderWidth={3} shadow={5}>
              <View style={{ paddingVertical: 13, alignItems: 'center' }}>
                <PixelText variant={txt} size={11} color={tc.white} style={{ letterSpacing: 0.5 }}>
                  번개장터에서 구매하기 →
                </PixelText>
              </View>
            </PixelPress>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
