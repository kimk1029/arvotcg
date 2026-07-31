/**
 * '내 자산' 총 자산 가치 히어로 — 웹 CollectionScreen 다크 히어로와 1:1 동일.
 * 전 테마 공통 디자인(웹도 테마 무관 inline 스타일): 다크 패널 + 우상단
 * 원화/엔화 토글 + 총액 + '어제 대비 등락' + 보유/구매금액/평가손익 스탯.
 * 총액은 서버 /api/me/portfolio 의 totalJpy — 등급 일치 합산(그레이딩 카드는
 * PSA10가, 비그레이딩은 싱글가). 싱글/PSA10 토글은 웹에 없으므로 제거.
 * 미로그인 시 잠금 오버레이.
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { PixelText } from '@/components/PixelText';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { isAuthenticated, subscribeSession } from '@/lib/session';
import { useCurrency } from '@/components/CurrencyProvider';
import { useCollection } from '@/lib/collection';
import { cardJpy } from '@/data/cardvault';
import { fetchMyCards, fetchPortfolio, type MyCardRow, type PortfolioSummary } from '@/lib/myApi';

/** 구매금액/평가손익 합계(엔) — 웹 CollectionScreen totals 와 동일 산식. */
export interface HeroTotals {
  invested: number;
  profit: number;
}

/** 서버 카드 행 → 웹 totals 산식: 기준가 = 구매가 ?? 등록가, 현재가 = 등급 일치 currentPriceJpy. */
export function computeHeroTotals(cards: MyCardRow[], rate: number): HeroTotals {
  let invested = 0;
  let current = 0;
  for (const c of cards) {
    const qty = Math.max(1, c.qty || 1);
    const buyJpy =
      c.buyPrice != null && c.buyPrice > 0
        ? c.buyCurrency === 'JPY'
          ? c.buyPrice
          : c.buyPrice / (rate || 1)
        : null;
    const basisJpy =
      buyJpy ?? (c.registerPriceJpy != null && c.registerPriceJpy > 0 ? c.registerPriceJpy : null);
    const curJpy =
      (c.currentPriceJpy ?? 0) > 0
        ? (c.currentPriceJpy as number)
        : c.graded
          ? c.pricePsa10Jpy ?? 0
          : c.priceSingleJpy ?? 0;
    if (basisJpy && curJpy > 0) {
      invested += basisJpy * qty;
      current += curJpy * qty;
    }
  }
  return { invested, profit: current - invested };
}

/** 로그인 상태를 반응형으로 구독. */
function useAuthed(): boolean {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  useEffect(() => {
    const sync = () => setAuthed(isAuthenticated());
    const unsub = subscribeSession(sync);
    sync();
    return unsub;
  }, []);
  return authed;
}

export function PortfolioHero({ totals: totalsProp }: { totals?: HeroTotals | null } = {}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const authed = useAuthed();
  const { format, rate, mode, setMode } = useCurrency();

  // 서버 포트폴리오 — totalJpy 는 등급 일치 합산(웹 동일 소스).
  const [port, setPort] = useState<PortfolioSummary | null>(null);
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    fetchPortfolio()
      .then((d) => alive && d && d.totalCount > 0 && setPort(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [authed]);

  // 구매금액/평가손익 — 웹 CollectionScreen totals 와 동일하게 서버 카드 행 기준.
  // 부모(내 카드 화면)가 이미 with-prices 를 갖고 있으면 prop 으로 받고,
  // 아니면(홈 등) 직접 조회. 로컬 캐시 집계는 더 이상 쓰지 않는다(웹은 서버 전용).
  const [fetchedTotals, setFetchedTotals] = useState<HeroTotals | null>(null);
  useEffect(() => {
    if (!authed || totalsProp !== undefined) return;
    let alive = true;
    fetchMyCards()
      .then((rows) => alive && setFetchedTotals(computeHeroTotals(rows, rate)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [authed, totalsProp, rate]);

  const totals = totalsProp !== undefined ? totalsProp : fetchedTotals;
  const investedJpy = totals?.invested ?? 0;
  const profitJpy = totals?.profit ?? 0;
  const hasInvested = investedJpy > 0;

  // 미로그인 폴백 표시용 로컬 합계(잠금 오버레이 뒤 배경 수치).
  const ownedAll = useCollection();
  const owned = ownedAll.filter((c) => !c.favorite);
  const localTotalJpy = owned.reduce((a, c) => a + cardJpy(c, 'single', rate), 0);
  const totalJpy = port ? port.totalJpy : localTotalJpy;
  const totalCount = port ? port.totalCount : owned.length;

  const realPct = port?.changePct ?? null;
  const realAbsJpy = port?.changeAbsJpy ?? null;
  const up = (realPct ?? 0) >= 0;

  return (
    <View style={{ marginHorizontal: 14, marginBottom: 6, position: 'relative' }}>
      <View style={authed ? undefined : { opacity: 0.35 }} pointerEvents={authed ? 'auto' : 'none'}>
        {/* 웹: linear-gradient(160deg,#22222a,#0e0e12) + radius 16.
            탭하면 포트폴리오 상세(전체화면)로 이동. 내부 통화 토글은 중첩 Pressable 이라 그대로 동작. */}
        <Pressable
          onPress={() => router.push('/my/portfolio' as never)}
          style={({ pressed }) => ({ backgroundColor: '#17171c', borderRadius: 16, padding: 20, overflow: 'hidden', opacity: pressed ? 0.92 : 1 })}
        >
          {/* 상단: 라벨(+상세 힌트) + 원화/엔화 토글 (웹 동일) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <PixelText variant="ko" size={12} weight="bold" color="rgba(255,255,255,0.65)">
                총 자산 가치
              </PixelText>
              <PixelText variant="ko" size={12} weight="bold" color="rgba(255,255,255,0.4)">›</PixelText>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 9, padding: 3 }}>
              {(['krw', 'jpy'] as const).map((m) => {
                const on = mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMode(m)}
                    style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 7, backgroundColor: on ? '#fff' : 'transparent' }}
                  >
                    <PixelText variant="ko" size={10} weight="bold" color={on ? '#16161a' : 'rgba(255,255,255,0.6)'}>
                      {m === 'krw' ? '원화' : '엔화'}
                    </PixelText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 총액 */}
          <PixelText variant="ko" size={28} weight="bold" color="#fff" style={{ marginTop: 12, letterSpacing: -0.5 }}>
            {format(totalJpy)}
          </PixelText>

          {/* 어제 대비 등락 — 서버 changePct 있을 때만 (웹 동일) */}
          {realPct != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
              <PixelText variant="ko" size={10} color="rgba(255,255,255,0.5)">어제 대비 등락</PixelText>
              <PixelText variant="ko" size={12} weight="bold" color={up ? '#FF6B5E' : '#6FA8FF'}>
                {up ? '+' : '-'}{format(Math.abs(realAbsJpy ?? 0))} ({up ? '+' : ''}{realPct.toFixed(2)}%) {up ? '▲' : '▼'}
              </PixelText>
            </View>
          ) : null}

          {/* 스탯 행 — 보유 카드 / 구매 금액 / 평가 손익 (웹 HeroStat 동일) */}
          <View style={{ flexDirection: 'row', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' }}>
            <HeroStat label="보유 카드" value={`${totalCount}장`} />
            <HeroStat label="구매 금액" value={hasInvested ? format(investedJpy) : '—'} flex={1.3} />
            <HeroStat
              label="평가 손익"
              value={hasInvested ? `${profitJpy >= 0 ? '+' : '-'}${format(Math.abs(profitJpy))}` : '—'}
              color={!hasInvested ? '#fff' : profitJpy >= 0 ? '#FF6B5E' : '#6FA8FF'}
              flex={1.2}
            />
          </View>
        </Pressable>
      </View>

      {!authed && (
        <Pressable
          onPress={() => router.push('/login' as never)}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 18 }}
        >
          <View style={{ backgroundColor: 'rgba(15,23,42,0.92)', borderColor: tc.gold, borderWidth: 3, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center', gap: 6 }}>
            <PixelText variant={txt} size={9} color={tc.gold} style={{ letterSpacing: 0.5 }}>
              🔒 PORTFOLIO LOCKED
            </PixelText>
            <PixelText variant="ko" size={12} weight="bold" color={tc.white} style={{ textAlign: 'center', lineHeight: 18 }}>
              로그인하고 나의{'\n'}가치변동을 확인하세요
            </PixelText>
            <PixelText variant={txt} size={9} color={tc.gold} style={{ marginTop: 4, letterSpacing: 0.5 }}>
              👉 TAP TO LOGIN
            </PixelText>
          </View>
        </Pressable>
      )}
    </View>
  );
}

/** 웹 CollectionScreen HeroStat 동일 — 라벨(10.5 흰50%) + 값(13.5 800 white). */
function HeroStat({ label, value, color = '#fff', flex = 1 }: { label: string; value: string; color?: string; flex?: number }) {
  return (
    <View style={{ flex }}>
      <PixelText variant="ko" size={10} color="rgba(255,255,255,0.5)">{label}</PixelText>
      <PixelText variant="ko" size={12} weight="bold" color={color} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 4 }}>
        {value}
      </PixelText>
    </View>
  );
}
