import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Image, Pressable } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { LoadingState } from '@/components/cv/ListState';
import { useCurrency } from '@/components/CurrencyProvider';
import { usePriceMode } from '@/lib/priceMode';
import { fetchPortfolio, fetchMyCards, type PortfolioSummary, type MyCardRow } from '@/lib/myApi';
import { colors } from '@/theme/tokens';
import { useTheme, useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';

type Filter = 'all' | 'up' | 'down' | 'graded' | 'pull';
type Range = 7 | 30 | 90 | 0; // 0 = 전체

// 클린(플랫) 다크 트레이딩 보드 팔레트 — 웹 .cv-pf-board 참고.
const BOARD = '#0C1426';
const CELL = '#101c30';
const CELL2 = '#16233b';
const LINE = 'rgba(255,255,255,0.08)';
const WHITE = '#FFFFFF';
const W60 = 'rgba(255,255,255,0.6)';
const W38 = 'rgba(255,255,255,0.38)';
const UP = '#22C55E';
const DOWN = '#FF6B7A';

export default function PortfolioPage() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { theme } = useTheme();
  const flat = isFlatTheme(theme);
  const { format, rate } = useCurrency();
  const { mode: priceMode } = usePriceMode();
  const [port, setPort] = useState<PortfolioSummary | null>(null);
  const [cards, setCards] = useState<MyCardRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  // 웹 PortfolioScreen 동일 — 정렬/필터/차트 기간.
  const [sort, setSort] = useState<'value' | 'change'>('value');
  const [filter, setFilter] = useState<Filter>('all');
  const [range, setRange] = useState<Range>(30);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, c] = await Promise.all([fetchPortfolio(), fetchMyCards()]);
        if (!alive) return;
        setPort(p);
        setCards(c);
      } catch {
        if (alive) setErr('포트폴리오를 불러오지 못했어요');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const usePsa10 = priceMode === 'psa10';

  const allRows = useMemo(() => {
    if (!cards) return [];
    return cards.map((c) => {
      const curJpy = usePsa10 && (c.pricePsa10Jpy ?? 0) > 0 ? (c.pricePsa10Jpy as number) : c.priceSingleJpy ?? 0;
      const qty = Math.max(1, c.qty || 1);
      const basisJpy =
        c.buyPrice != null && c.buyPrice > 0
          ? c.buyCurrency === 'JPY'
            ? c.buyPrice
            : c.buyPrice / (rate || 1)
          : null;
      const profitPct = basisJpy && curJpy > 0 ? ((curJpy - basisJpy) / basisJpy) * 100 : null;
      const t = c.trend ?? [];
      const dayPct =
        t.length >= 2 && t[t.length - 2] > 0 ? ((t[t.length - 1] - t[t.length - 2]) / t[t.length - 2]) * 100 : null;
      return { c, curJpy, qty, basisJpy, profitPct, dayPct, changePct: profitPct ?? dayPct, value: curJpy * qty };
    });
  }, [cards, usePsa10, rate]);

  // 필터 + 정렬 — 웹 rows 동일.
  const rows = useMemo(() => {
    let r = allRows;
    if (filter === 'up') r = r.filter((x) => (x.changePct ?? 0) > 0);
    else if (filter === 'down') r = r.filter((x) => (x.changePct ?? 0) < 0);
    else if (filter === 'graded') r = r.filter((x) => x.c.graded);
    else if (filter === 'pull') r = r.filter((x) => x.c.selfPulled);
    return [...r].sort((a, b) =>
      sort === 'value' ? b.value - a.value : (b.changePct ?? -999) - (a.changePct ?? -999),
    );
  }, [allRows, filter, sort]);

  const totals = useMemo(() => {
    let invested = 0;
    let current = 0;
    for (const r of allRows) {
      if (r.basisJpy && r.curJpy > 0) {
        invested += r.basisJpy * r.qty;
        current += r.curJpy * r.qty;
      }
    }
    const profit = current - invested;
    const pct = invested > 0 ? (profit / invested) * 100 : null;
    return { invested, current, profit, pct };
  }, [allRows]);

  // 오늘의 등락 — 웹 movers 동일.
  const movers = useMemo(() => {
    const withChg = allRows.filter((r) => r.changePct != null);
    if (withChg.length === 0) return { up: null, down: null, nUp: 0, nDown: 0 };
    const sorted = [...withChg].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
    return {
      up: (sorted[0].changePct ?? 0) > 0 ? sorted[0] : null,
      down: (sorted[sorted.length - 1].changePct ?? 0) < 0 ? sorted[sorted.length - 1] : null,
      nUp: withChg.filter((r) => (r.changePct ?? 0) > 0).length,
      nDown: withChg.filter((r) => (r.changePct ?? 0) < 0).length,
    };
  }, [allRows]);

  const bodyBg = flat ? BOARD : tc.paper;

  return (
    <View style={{ flex: 1, backgroundColor: bodyBg }}>
      <AppBar onBack={() => router.push('/my' as never)} title="포트폴리오" />
      {err ? (
        <View style={{ padding: 30, alignItems: 'center' }}>
          <PixelText variant={txt} size={11} color={flat ? DOWN : tc.red}>⚠ {err}</PixelText>
        </View>
      ) : !port || !cards ? (
        <LoadingState />
      ) : port.totalCount === 0 ? (
        <View style={{ padding: 30, alignItems: 'center', gap: 12 }}>
          <PixelText variant={txt} size={11} color={flat ? W60 : tc.ink3}>아직 보유 카드가 없어요</PixelText>
          <Pressable onPress={() => router.push('/cards/add' as never)}>
            <PixelText variant={txt} size={11} color={flat ? '#7FB0FF' : tc.blu}>카드 추가하러 가기 →</PixelText>
          </Pressable>
        </View>
      ) : flat ? (
        /* ─────────── 클린(플랫) 다크 보드 — 웹 PortfolioScreen 패리티 ─────────── */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 120, gap: 16 }}>
          {/* 평가액 헤더 */}
          {(() => {
            const totalJpy = usePsa10 && (port.totalPsa10Jpy ?? 0) > 0 ? (port.totalPsa10Jpy as number) : port.totalJpy;
            const up = (port.changePct ?? 0) >= 0;
            return (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: UP }} />
                    <PixelText variant={txt} size={10} weight="bold" color={W60} style={{ letterSpacing: 1 }}>
                      MY PORTFOLIO{usePsa10 ? ' · PSA10' : ''}
                    </PixelText>
                  </View>
                  <PixelText variant={txt} size={9} color={W38}>{port.asOfDate ?? '실시간'} · KST</PixelText>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  <PixelText variant={txt} size={34} weight="bold" color={tc.gold} style={{ letterSpacing: -1 }}>
                    {format(totalJpy)}
                  </PixelText>
                  {port.changePct != null && (
                    <PixelText variant={txt} size={13} weight="bold" color={up ? UP : DOWN} style={{ marginBottom: 4 }}>
                      {up ? '▲ +' : '▼ '}
                      {port.changePct.toFixed(2)}%
                      {port.changeAbsJpy != null ? ` (${up ? '+' : '-'}${format(Math.abs(port.changeAbsJpy))})` : ''}
                    </PixelText>
                  )}
                </View>
                <PixelText variant={txt} size={9} color={W38} style={{ marginTop: 6 }}>
                  {port.pricedCount}/{port.totalCount}장 · 어제(KST)대비
                </PixelText>
              </View>
            );
          })()}

          {/* KPI 그리드 6종 — 다크 셀 */}
          {(() => {
            const totalJpy = usePsa10 && (port.totalPsa10Jpy ?? 0) > 0 ? (port.totalPsa10Jpy as number) : port.totalJpy;
            const gradedCount = cards.filter((c) => c.graded).length;
            return (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <KpiFlat label="매입 합계" value={totals.invested > 0 ? format(totals.invested) : '—'} txt={txt} />
                <KpiFlat label="현재 평가" value={totals.current > 0 ? format(totals.current) : format(totalJpy)} color={tc.gold} txt={txt} />
                <KpiFlat
                  label="평가손익"
                  value={totals.pct != null ? `${totals.profit >= 0 ? '+' : '-'}${format(Math.abs(totals.profit))}` : '—'}
                  sub={totals.pct != null ? `${totals.pct >= 0 ? '+' : ''}${totals.pct.toFixed(1)}%` : undefined}
                  color={totals.pct == null ? undefined : totals.profit >= 0 ? UP : DOWN}
                  txt={txt}
                />
                <KpiFlat label="보유" value={`${cards.length}장`} txt={txt} />
                <KpiFlat label="시세반영" value={`${port.pricedCount}/${port.totalCount}`} color="#7FB0FF" txt={txt} />
                <KpiFlat label="그레이딩" value={`${gradedCount}건`} color="#A78BFA" txt={txt} />
              </View>
            );
          })()}

          {/* 차트 기간 탭 */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([7, 30, 90, 0] as Range[]).map((r) => {
              const on = range === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRange(r)}
                  style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9, backgroundColor: on ? tc.gold : CELL }}
                >
                  <PixelText variant={txt} size={11} weight="bold" color={on ? '#16161a' : W60}>{r === 0 ? '전체' : `${r}일`}</PixelText>
                </Pressable>
              );
            })}
          </View>

          {/* 일별 차트 */}
          <PortfolioChart flat history={range === 0 ? port.history : port.history.slice(-range)} format={format} selIdx={selIdx} onSelect={setSelIdx} />

          {/* 오늘의 등락 (movers) */}
          {movers.up || movers.down ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Mover flat row={movers.up} dir="up" tc={tc} txt={txt} />
              <Mover flat row={movers.down} dir="down" tc={tc} txt={txt} />
            </View>
          ) : null}

          {/* 필터 5종 */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(
              [
                { k: 'all', label: '전체', n: allRows.length },
                { k: 'up', label: '🔺상승', n: movers.nUp },
                { k: 'down', label: '🔻하락', n: movers.nDown },
                { k: 'graded', label: '🏅등급', n: cards.filter((c) => c.graded).length },
                { k: 'pull', label: '🎁직뽑', n: cards.filter((c) => c.selfPulled).length },
              ] as Array<{ k: Filter; label: string; n: number }>
            ).map((f) => {
              const on = filter === f.k;
              return (
                <Pressable
                  key={f.k}
                  onPress={() => setFilter(f.k)}
                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: on ? WHITE : CELL }}
                >
                  <PixelText variant={txt} size={11} weight="bold" color={on ? '#16161a' : W60}>
                    {f.label} {f.n}
                  </PixelText>
                </Pressable>
              );
            })}
          </View>

          {/* 리스트 헤더 + 정렬 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <PixelText variant={txt} size={11} weight="bold" color={W60} style={{ letterSpacing: 1 }}>
              보유 종목 {rows.length}
            </PixelText>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['value', 'change'] as const).map((s) => {
                const on = sort === s;
                return (
                  <Pressable key={s} onPress={() => setSort(s)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: on ? tc.gold : CELL }}>
                    <PixelText variant={txt} size={10} weight="bold" color={on ? '#16161a' : W60}>{s === 'value' ? '평가액순' : '등락순'}</PixelText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 리스트 — 다크 행 */}
          <View style={{ gap: 8 }}>
            {rows.length === 0 ? (
              <PixelText variant={txt} size={11} color={W38} style={{ textAlign: 'center', paddingVertical: 20 }}>
                해당 조건의 종목이 없어요
              </PixelText>
            ) : null}
            {rows.map(({ c, curJpy, profitPct, dayPct, basisJpy, qty }) => {
              const img = c.snkrdunkImageUrl || c.photoUrl || null;
              const name = c.snkrdunkName || c.nickname || '이름 미상';
              const changePct = profitPct ?? dayPct;
              const changeUp = (changePct ?? 0) >= 0;
              return (
                <View key={c.id} style={{ flexDirection: 'row', gap: 10, padding: 10, alignItems: 'center', backgroundColor: CELL, borderRadius: 12 }}>
                  <View style={{ width: 40, height: 56, borderRadius: 6, backgroundColor: CELL2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <PixelText variant={txt} size={18}>🃏</PixelText>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <PixelText variant="ko" size={12.5} weight="bold" color={WHITE} numberOfLines={1}>
                      {name}
                      {c.graded ? `  [${c.gradeCompany ?? 'PSA'} ${c.gradeValue ?? ''}]` : ''}
                    </PixelText>
                    <PixelText variant={txt} size={9.5} color={W38} style={{ marginTop: 3 }}>
                      {[c.ocrSetCode?.toUpperCase(), c.ocrCardNumber].filter(Boolean).join(' · ')}
                      {qty > 1 ? ` · ×${qty}` : ''}
                      {c.selfPulled ? ' · 직접뽑기' : ''}
                    </PixelText>
                  </View>
                  {Array.isArray(c.trend) && c.trend.length >= 2 ? (
                    <SparkFlat trend={c.trend} up={changeUp} />
                  ) : null}
                  <View style={{ alignItems: 'flex-end' }}>
                    <PixelText variant={txt} size={12} weight="bold" color={WHITE}>{curJpy > 0 ? format(curJpy) : '시세없음'}</PixelText>
                    {changePct != null && (
                      <PixelText variant={txt} size={10} weight="bold" color={changeUp ? UP : DOWN} style={{ marginTop: 3 }}>
                        {changeUp ? '▲ +' : '▼ '}
                        {changePct.toFixed(1)}% {basisJpy != null ? '매입' : '전일'}
                      </PixelText>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <PixelText variant={txt} size={9} color={W38} style={{ textAlign: 'center', marginTop: 4, lineHeight: 14 }}>
            스니덩크 최근 체결 중앙값 기준 · 관심카드 제외 · 어제(KST 정각) 대비
          </PixelText>
        </ScrollView>
      ) : (
        /* ─────────── 픽셀 테마 — 기존 입체 픽셀 레이아웃 ─────────── */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 14 }}>
          {/* 평가액 헤더 */}
          {(() => {
            const totalJpy = usePsa10 && (port.totalPsa10Jpy ?? 0) > 0 ? (port.totalPsa10Jpy as number) : port.totalJpy;
            const up = (port.changePct ?? 0) >= 0;
            return (
              <PixelFrame bg={tc.ink} borderWidth={3} shadow={6}>
                <View style={{ padding: 14 }}>
                  <PixelText variant={txt} size={9} color="rgba(255,255,255,0.5)" style={{ letterSpacing: 0.5 }}>
                    총 평가액 (스니덩크 시세 합계)
                  </PixelText>
                  <PixelText variant={txt} size={24} color={tc.gold} style={{ marginTop: 6 }}>
                    {format(totalJpy)}
                  </PixelText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {port.changePct != null && (
                      <PixelText variant={txt} size={12} color={up ? '#22C55E' : '#FF6B7A'}>
                        {up ? '▲ +' : '▼ '}
                        {port.changePct.toFixed(2)}%
                        {port.changeAbsJpy != null ? ` (${up ? '+' : '-'}${format(Math.abs(port.changeAbsJpy))})` : ''}
                      </PixelText>
                    )}
                    <PixelText variant={txt} size={9} color="rgba(255,255,255,0.45)">
                      {port.pricedCount}/{port.totalCount}장 · 어제(KST)대비
                    </PixelText>
                  </View>
                  {totals.pct != null && (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' }}>
                      <PixelText variant={txt} size={10} color="rgba(255,255,255,0.7)" style={{ lineHeight: 16 }}>
                        매입 {format(totals.invested)} → 현재 {format(totals.current)}
                        {`\n`}
                        <PixelText variant={txt} size={10} color={totals.profit >= 0 ? '#22C55E' : '#FF6B7A'}>
                          {totals.profit >= 0 ? '+' : '-'}
                          {format(Math.abs(totals.profit))} ({totals.profit >= 0 ? '+' : ''}
                          {totals.pct.toFixed(1)}%)
                        </PixelText>
                      </PixelText>
                    </View>
                  )}
                </View>
              </PixelFrame>
            );
          })()}

          {/* KPI 인포그래픽 그리드 — 웹 동일 6종 */}
          {(() => {
            const totalJpy = usePsa10 && (port.totalPsa10Jpy ?? 0) > 0 ? (port.totalPsa10Jpy as number) : port.totalJpy;
            const gradedCount = cards.filter((c) => c.graded).length;
            return (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Kpi label="매입 합계" value={totals.invested > 0 ? format(totals.invested) : '—'} />
                <Kpi label="현재 평가" value={totals.current > 0 ? format(totals.current) : format(totalJpy)} color={tc.gold} />
                <Kpi
                  label="평가손익"
                  value={totals.pct != null ? `${totals.profit >= 0 ? '+' : '-'}${format(Math.abs(totals.profit))}` : '—'}
                  sub={totals.pct != null ? `${totals.pct >= 0 ? '+' : ''}${totals.pct.toFixed(1)}%` : undefined}
                  color={totals.pct == null ? undefined : totals.profit >= 0 ? tc.red : tc.blu}
                />
                <Kpi label="보유" value={`${cards.length}장`} />
                <Kpi label="시세반영" value={`${port.pricedCount}/${port.totalCount}`} color="#7FB0FF" />
                <Kpi label="그레이딩" value={`${gradedCount}건`} color="#A78BFA" />
              </View>
            );
          })()}

          {/* 차트 기간 탭 — 웹 동일 7/30/90/전체 */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([7, 30, 90, 0] as Range[]).map((r) => {
              const on = range === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRange(r)}
                  style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: on ? tc.ink : tc.white, borderColor: tc.ink, borderWidth: 2 }}
                >
                  <PixelText variant={txt} size={9} color={on ? tc.gold : tc.ink3}>{r === 0 ? '전체' : `${r}일`}</PixelText>
                </Pressable>
              );
            })}
          </View>

          {/* 일별 차트 */}
          <PortfolioChart history={range === 0 ? port.history : port.history.slice(-range)} format={format} selIdx={selIdx} onSelect={setSelIdx} />

          {/* 오늘의 등락 (movers) — 웹 동일 */}
          {movers.up || movers.down ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Mover row={movers.up} dir="up" tc={tc} txt={txt} />
              <Mover row={movers.down} dir="down" tc={tc} txt={txt} />
            </View>
          ) : null}

          {/* 필터 — 웹 동일 5종(건수 표시) */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(
              [
                { k: 'all', label: '전체', n: allRows.length },
                { k: 'up', label: '🔺상승', n: movers.nUp },
                { k: 'down', label: '🔻하락', n: movers.nDown },
                { k: 'graded', label: '🏅등급', n: cards.filter((c) => c.graded).length },
                { k: 'pull', label: '🎁직뽑', n: cards.filter((c) => c.selfPulled).length },
              ] as Array<{ k: Filter; label: string; n: number }>
            ).map((f) => {
              const on = filter === f.k;
              return (
                <Pressable
                  key={f.k}
                  onPress={() => setFilter(f.k)}
                  style={{ paddingVertical: 7, paddingHorizontal: 10, backgroundColor: on ? tc.ink : tc.white, borderColor: tc.ink, borderWidth: 2 }}
                >
                  <PixelText variant={txt} size={9} color={on ? tc.gold : tc.ink3}>
                    {f.label} {f.n}
                  </PixelText>
                </Pressable>
              );
            })}
          </View>

          {/* 리스트 헤더 + 정렬 — 웹 동일 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <PixelText variant={txt} size={11} color={tc.ink2} style={{ letterSpacing: 1 }}>
              보유 종목 {rows.length}
            </PixelText>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['value', 'change'] as const).map((s) => {
                const on = sort === s;
                return (
                  <Pressable key={s} onPress={() => setSort(s)} style={{ paddingVertical: 5, paddingHorizontal: 8, backgroundColor: on ? tc.gold : tc.white, borderColor: tc.ink, borderWidth: 2 }}>
                    <PixelText variant={txt} size={8} color={tc.ink}>{s === 'value' ? '평가액순' : '등락순'}</PixelText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {rows.length === 0 ? (
              <PixelText variant={txt} size={10} color={tc.ink3} style={{ textAlign: 'center', paddingVertical: 20 }}>
                해당 조건의 종목이 없어요
              </PixelText>
            ) : null}
            {rows.map(({ c, curJpy, profitPct, dayPct, basisJpy, qty }) => {
              const img = c.snkrdunkImageUrl || c.photoUrl || null;
              const name = c.snkrdunkName || c.nickname || '이름 미상';
              const changePct = profitPct ?? dayPct;
              const changeUp = (changePct ?? 0) >= 0;
              return (
                <PixelFrame key={c.id} borderWidth={3} shadow={4}>
                  <View style={{ flexDirection: 'row', gap: 10, padding: 10, alignItems: 'center' }}>
                    <View style={{ width: 40, height: 56, borderColor: tc.ink, borderWidth: 2, backgroundColor: tc.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {img ? (
                        <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <PixelText variant={txt} size={18}>🃏</PixelText>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <PixelText variant="ko" size={12} weight="bold" numberOfLines={1}>
                        {name}
                        {c.graded ? `  [${c.gradeCompany ?? 'PSA'} ${c.gradeValue ?? ''}]` : ''}
                      </PixelText>
                      <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 3 }}>
                        {[c.ocrSetCode?.toUpperCase(), c.ocrCardNumber].filter(Boolean).join(' · ')}
                        {qty > 1 ? ` · ×${qty}` : ''}
                        {c.selfPulled ? ' · 직접뽑기' : ''}
                      </PixelText>
                    </View>
                    {Array.isArray(c.trend) && c.trend.length >= 2 ? (
                      <Spark trend={c.trend} up={changeUp} tc={tc} />
                    ) : null}
                    <View style={{ alignItems: 'flex-end' }}>
                      <PixelText variant={txt} size={11}>{curJpy > 0 ? format(curJpy) : '시세없음'}</PixelText>
                      {changePct != null && (
                        <PixelText variant={txt} size={10} color={changeUp ? tc.grnDk : tc.red} style={{ marginTop: 3 }}>
                          {changeUp ? '▲ +' : '▼ '}
                          {changePct.toFixed(1)}% {basisJpy != null ? '매입' : '전일'}
                        </PixelText>
                      )}
                    </View>
                  </View>
                </PixelFrame>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/** KPI 셀 (픽셀) — 웹 Kpi 동일 (3열 그리드). */
function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={{ width: '31.5%', flexGrow: 1, backgroundColor: tc.white, borderColor: tc.ink, borderWidth: 2, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }}>
      <PixelText variant={txt} size={10} weight="bold" color={color ?? tc.ink} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </PixelText>
      {sub ? (
        <PixelText variant={txt} size={8} color={color ?? tc.ink3} style={{ marginTop: 2 }}>{sub}</PixelText>
      ) : null}
      <PixelText variant={txt} size={8} color={tc.ink3} style={{ marginTop: 4 }}>{label}</PixelText>
    </View>
  );
}

/** KPI 셀 (클린 다크 보드) — 둥근 다크 셀. */
function KpiFlat({ label, value, sub, color, txt }: { label: string; value: string; sub?: string; color?: string; txt: 'pixel' | 'ko' }) {
  return (
    <View style={{ width: '31.5%', flexGrow: 1, backgroundColor: CELL, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 8, alignItems: 'center' }}>
      <PixelText variant={txt} size={13} weight="bold" color={color ?? WHITE} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </PixelText>
      {sub ? (
        <PixelText variant={txt} size={9} weight="bold" color={color ?? W60} style={{ marginTop: 3 }}>{sub}</PixelText>
      ) : null}
      <PixelText variant={txt} size={9} color={W38} style={{ marginTop: 5 }}>{label}</PixelText>
    </View>
  );
}

/** 오늘의 등락 TOP — 웹 Mover 동일. */
function Mover({
  row,
  dir,
  tc,
  txt,
  flat,
}: {
  row: { c: MyCardRow; changePct: number | null } | null;
  dir: 'up' | 'down';
  tc: ReturnType<typeof useThemeColors>;
  txt: 'pixel' | 'ko';
  flat?: boolean;
}) {
  const color = dir === 'up' ? UP : DOWN;
  const pixelColor = dir === 'up' ? tc.red : tc.blu;
  const head = dir === 'up' ? '▲ 상승 TOP' : '▼ 하락 TOP';
  const boxStyle = flat
    ? ({ flex: 1, backgroundColor: CELL, borderRadius: 12, padding: 12 } as const)
    : ({ flex: 1, backgroundColor: tc.white, borderColor: tc.ink, borderWidth: 2, padding: 10 } as const);
  const nameColor = flat ? WHITE : tc.ink;
  const subColor = flat ? W38 : tc.ink3;
  const headColor = flat ? color : pixelColor;
  const valColor = flat ? color : pixelColor;
  return (
    <View style={boxStyle}>
      <PixelText variant={txt} size={9} weight="bold" color={headColor}>{head}</PixelText>
      {row ? (
        <>
          <PixelText variant="ko" size={11} weight="bold" color={nameColor} numberOfLines={1} style={{ marginTop: 6 }}>
            {row.c.snkrdunkName || row.c.nickname || '이름 미상'}
          </PixelText>
          <PixelText variant={txt} size={11} weight="bold" color={valColor} style={{ marginTop: 3 }}>
            {(row.changePct ?? 0) >= 0 ? '+' : ''}{(row.changePct ?? 0).toFixed(1)}%
          </PixelText>
        </>
      ) : (
        <PixelText variant={txt} size={10} color={subColor} style={{ marginTop: 6 }}>—</PixelText>
      )}
    </View>
  );
}

/** 카드별 미니 스파크라인 (픽셀). */
function Spark({ trend, up, tc }: { trend: number[]; up: boolean; tc: ReturnType<typeof useThemeColors> }) {
  const color = up ? tc.red : tc.blu;
  return <SparkPath trend={trend} color={color} />;
}
/** 카드별 미니 스파크라인 (클린). */
function SparkFlat({ trend, up }: { trend: number[]; up: boolean }) {
  return <SparkPath trend={trend} color={up ? UP : DOWN} />;
}
function SparkPath({ trend, color }: { trend: number[]; color: string }) {
  const pts = (trend ?? []).filter((n) => typeof n === 'number' && n > 0);
  if (pts.length < 2) return null;
  const w = 46;
  const h = 22;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const stepX = w / (pts.length - 1);
  const d = pts
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${(h - ((v - min) / span) * (h - 4) - 2).toFixed(1)}`)
    .join(' ');
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PortfolioChart({
  history,
  format,
  selIdx,
  onSelect,
  flat,
}: {
  history: Array<{ date: string; totalJpy: number }>;
  format: (jpy: number) => string;
  selIdx: number | null;
  onSelect: (i: number | null) => void;
  flat?: boolean;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const inkColor = flat ? W60 : tc.ink3;
  const strongColor = flat ? WHITE : tc.ink;

  const Wrap = ({ children }: { children: React.ReactNode }) =>
    flat ? (
      <View style={{ backgroundColor: CELL, borderRadius: 12, padding: 12 }}>{children}</View>
    ) : (
      <PixelFrame borderWidth={3} shadow={4}>
        <View style={{ padding: 12 }}>{children}</View>
      </PixelFrame>
    );

  if (history.length < 2) {
    return (
      <Wrap>
        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <PixelText variant={txt} size={9} color={inkColor}>
            일별 데이터가 2일 이상 쌓이면 차트가 표시돼요
          </PixelText>
        </View>
      </Wrap>
    );
  }
  const W = 320;
  const H = 120;
  const PAD = 8;
  const vals = history.map((h) => h.totalJpy);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const step = (W - PAD * 2) / (history.length - 1);
  const xy = (i: number) => ({
    x: PAD + i * step,
    y: H - PAD - ((history[i].totalJpy - min) / span) * (H - PAD * 2),
  });
  const d = history
    .map((_, i) => {
      const { x, y } = xy(i);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const overallUp = vals[vals.length - 1] >= vals[0];
  const stroke = overallUp ? '#22C55E' : '#E63946';

  const sel = selIdx != null && selIdx >= 0 && selIdx < history.length ? selIdx : null;
  const selPrev = sel != null && sel > 0 ? history[sel - 1].totalJpy : null;
  const selPct = sel != null && selPrev && selPrev > 0 ? ((history[sel].totalJpy - selPrev) / selPrev) * 100 : null;

  return (
    <Wrap>
      {sel != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <PixelText variant={txt} size={10} color={inkColor}>{history[sel].date}</PixelText>
          <PixelText variant={txt} size={14} weight="bold" color={strongColor}>{format(history[sel].totalJpy)}</PixelText>
          {selPct != null && (
            <PixelText variant={txt} size={11} weight="bold" color={selPct >= 0 ? (flat ? UP : tc.grnDk) : (flat ? DOWN : tc.red)}>
              {selPct >= 0 ? '▲ +' : '▼ '}
              {selPct.toFixed(2)}%
            </PixelText>
          )}
        </View>
      ) : (
        <PixelText variant={txt} size={9} color={inkColor} style={{ marginBottom: 8 }}>
          차트의 점을 눌러 그 날의 금액·등락률을 확인하세요
        </PixelText>
      )}
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
        {history.map((_, i) => {
          const { x } = xy(i);
          return (
            <Rect
              key={`hit-${i}`}
              x={x - step / 2}
              y={0}
              width={step}
              height={H}
              fill="transparent"
              onPress={() => onSelect(i)}
            />
          );
        })}
        {sel != null && (
          <Line x1={xy(sel).x} y1={0} x2={xy(sel).x} y2={H} stroke={inkColor} strokeWidth={1} strokeDasharray="3,3" />
        )}
        {history.map((_, i) => {
          const { x, y } = xy(i);
          const isSel = i === sel;
          return <Circle key={`pt-${i}`} cx={x} cy={y} r={isSel ? 4 : 2} fill={isSel ? (flat ? WHITE : tc.ink) : stroke} onPress={() => onSelect(i)} />;
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <PixelText variant={txt} size={8} color={inkColor}>{history[0].date}</PixelText>
        <PixelText variant={txt} size={8} color={inkColor}>최근 {history.length}일</PixelText>
        <PixelText variant={txt} size={8} color={inkColor}>{history[history.length - 1].date}</PixelText>
      </View>
    </Wrap>
  );
}
