/**
 * 자산 요약(7일/30일/누적) — 내 컬렉션 상단.
 * 웹 CollectionScreen 의 "자산 요약" 섹션 모바일 포팅. 모두 실데이터.
 *  - 7일/30일 변화: 서버 포트폴리오 history(일별 평가액) 델타.
 *  - 누적 수익률: 보유 카드 매입가(basis) 대비 현재가 합.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { PixelText } from '@/components/PixelText';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import type { MyCardRow, PortfolioSummary } from '@/lib/myApi';

interface Delta {
  abs: number;
  pct: number;
}

export function CollectionSummary({
  port,
  cards,
  priceMode,
  format,
  rate,
}: {
  port: PortfolioSummary | null;
  cards: MyCardRow[];
  priceMode: 'single' | 'psa10';
  format: (jpy: number) => string;
  rate: number;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();

  // 7일/30일 변화 — 서버 history 기준 (웹 over(days) 와 동일).
  const summary = useMemo(() => {
    const h = port?.history ?? [];
    const over = (days: number): Delta | null => {
      if (h.length < 2) return null;
      const last = h[h.length - 1].totalJpy;
      const base = h[Math.max(0, h.length - 1 - days)].totalJpy;
      if (!base) return null;
      return { abs: last - base, pct: ((last - base) / base) * 100 };
    };
    return { d7: over(7), d30: over(30) };
  }, [port]);

  // 누적 수익률 — 웹 CollectionScreen totals 와 동일:
  //  · 기준가 = 구매가 우선, 없으면 등록가(등록 시점 등급 기준 시세 스냅)
  //  · 현재가 = 등급 일치 currentPriceJpy(PSA10/9/8→등급가, 타사→PSA10, 싱글→raw)
  const totals = useMemo(() => {
    let invested = 0;
    let current = 0;
    for (const c of cards) {
      const cur =
        (c.currentPriceJpy ?? 0) > 0
          ? c.currentPriceJpy ?? 0
          : c.graded
            ? c.pricePsa10Jpy ?? 0
            : c.priceSingleJpy ?? 0;
      const qty = Math.max(1, c.qty ?? 1);
      const buyJpy =
        c.buyPrice != null && c.buyPrice > 0
          ? c.buyCurrency === 'JPY'
            ? c.buyPrice
            : c.buyPrice / (rate || 1)
          : null;
      const basis =
        buyJpy ?? (c.registerPriceJpy != null && c.registerPriceJpy > 0 ? c.registerPriceJpy : null);
      if (basis && cur > 0) {
        invested += basis * qty;
        current += cur * qty;
      }
    }
    const profit = current - invested;
    const pct = invested > 0 ? (profit / invested) * 100 : null;
    return { profit, pct };
  }, [cards, rate]);

  return (
    <View style={{ paddingHorizontal: space.gap, marginBottom: space.cg }}>
      <PixelText variant="ko" size={15} weight="bold" color={tc.ink} style={{ marginBottom: 10 }}>
        자산 요약
      </PixelText>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <SummaryCell tc={tc} txt={txt} label="7일 변화" delta={summary.d7} format={format} />
        <SummaryCell tc={tc} txt={txt} label="30일 변화" delta={summary.d30} format={format} />
        <SummaryCell
          tc={tc}
          txt={txt}
          label="누적 수익률"
          pctOnly={totals.pct}
          sub={totals.pct != null ? `${totals.profit >= 0 ? '+' : '-'}${format(Math.abs(totals.profit))}` : undefined}
          format={format}
        />
      </View>
    </View>
  );
}

function SummaryCell({
  tc,
  txt,
  label,
  delta,
  pctOnly,
  sub,
  format,
}: {
  tc: ReturnType<typeof useThemeColors>;
  txt: 'pixel' | 'ko';
  label: string;
  delta?: Delta | null;
  pctOnly?: number | null;
  sub?: string;
  format: (jpy: number) => string;
}) {
  const pct = delta ? delta.pct : pctOnly ?? null;
  const color = pct == null ? tc.ink3 : pct >= 0 ? tc.red : tc.blu;
  const main = delta
    ? `${delta.abs >= 0 ? '+' : '-'}${format(Math.abs(delta.abs))}`
    : pct != null
      ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
      : '—';
  const subText = delta && pct != null ? `(${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)` : sub;
  return (
    <View style={{ flex: 1, borderColor: tc.pap3, borderWidth: 1, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 10, backgroundColor: tc.white, minHeight: 88 }}>
      <PixelText variant={txt} size={10} color={tc.ink3} numberOfLines={1}>{label}</PixelText>
      <PixelText variant={txt} size={13} weight="bold" color={color} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 7 }}>
        {main}
      </PixelText>
      {subText ? (
        <PixelText variant={txt} size={9} color={tc.ink3} numberOfLines={1} style={{ marginTop: 3 }}>{subText}</PixelText>
      ) : null}
    </View>
  );
}
