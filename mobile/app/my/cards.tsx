/**
 * /my/cards — 내 자산 (웹 CollectionScreen 1:1).
 * 히어로(총 자산) → 자산 요약 → 자산 구성 → 가격 알림 → 내 카드 목록.
 * 목록: 뷰 2종(그리드 2열/리스트) + 정렬(가격순/등락순/등록일/이름순/테마순) +
 * 카드 ⋯ 메뉴(시세 보기/컬렉션에서 제거). 시세는 등급 일치(그레이딩=PSA10,
 * 비그레이딩=싱글) — 웹 allRows 와 동일 계산.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { PortfolioHero } from '@/components/PortfolioHero';
import { CollectionComposition } from '@/components/CollectionComposition';
import { CollectionSummary } from '@/components/CollectionSummary';
import { PixelText } from '@/components/PixelText';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { GradeMark } from '@/components/cv/GradeMark';
import { InlineLoginGate } from '@/components/InlineLoginGate';
import { useCurrency } from '@/components/CurrencyProvider';
import { useToast } from '@/components/ToastProvider';
import { usePriceMode } from '@/lib/priceMode';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import {
  fetchMyCardsSmart,
  fetchPortfolio,
  fetchPriceAlerts,
  deleteMyCard,
  SWR_MY_CARDS,
  SWR_PORTFOLIO,
  type MyCardRow,
  type PortfolioSummary,
} from '@/lib/myApi';
import { useSWR } from '@/lib/swr';
import { isAuthenticated, subscribeSession } from '@/lib/session';
import { parseCardStatics } from '../../../shared/cardStatics';

type SortKey = 'value' | 'change' | 'recent' | 'name' | 'game';
type ViewMode = 'grid' | 'list';

// KR 관례 — 상승 빨강 / 하락 파랑 (웹 UP/DOWN 동일).
const UP = '#E5484D';
const DOWN = '#2F6BFF';
// 이미지 없는 카드 폴백 배경 — 웹 FALLBACK_GRADS 의 대표색(단색 근사).
const FALLBACK_BG = ['#e0492f', '#f9b423', '#d799c4', '#7a69d6', '#2a2a30', '#25c485'];

function cardName(c: MyCardRow): string {
  return c.snkrdunkName || c.nickname || '이름 미상';
}
/** 테마순 정렬 순서 — 포켓몬 → 원피스 → 유희왕 → 기타/미분류 (웹 GAME_SORT_ORDER 동일). */
const GAME_SORT_ORDER: Record<string, number> = { pokemon: 0, onepiece: 1, yugioh: 2, sports: 3 };
function gameRank(c: MyCardRow): number {
  const g = c.game || parseCardStatics(cardName(c)).game;
  return GAME_SORT_ORDER[g] ?? 9;
}
function cardSub(c: MyCardRow): string {
  if (c.graded) return `${c.gradeCompany ?? 'PSA'} ${c.gradeValue ?? ''}`.trim();
  if (c.ocrSetCode) return [c.ocrSetCode.toUpperCase(), c.ocrCardNumber].filter(Boolean).join(' · ');
  return c.selfPulled ? '직접뽑기' : '싱글카드';
}
/** 손익률 부호색 — 이득 빨강 / 손해 파랑 / 기준 없음 잉크 (웹 profitColor 동일). */
function profitColor(pct: number | null, ink: string): string {
  if (pct == null) return ink;
  return pct >= 0 ? UP : DOWN;
}
function rankBadgeColor(rank: number, gold: string, ink: string): string {
  if (rank === 1) return gold;
  if (rank === 2) return '#9AA0A6';
  if (rank === 3) return '#C8732B';
  return ink;
}

interface Row {
  c: MyCardRow;
  curJpy: number;
  qty: number;
  basisJpy: number | null;
  profitPct: number | null;
  dayPct: number | null;
  changePct: number | null;
  value: number;
}

function useAuthed(): boolean {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  useEffect(() => subscribeSession(() => setAuthed(isAuthenticated())), []);
  return authed;
}

export default function MyCardsScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const authed = useAuthed();
  const { format, rate } = useCurrency();
  const { mode: priceMode } = usePriceMode();
  const toast = useToast();

  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortKey>('value');

  // SWR — 카드 정적 데이터는 디스크까지 캐싱, 재진입 시 즉시 그리고 "오늘의 금액"만
  // /api/me/cards/prices 로 받아 merge (fetchMyCardsSmart). 등록/삭제 시 자동 무효화.
  const { data, loading, error, refresh } = useSWR<MyCardRow[]>(SWR_MY_CARDS, fetchMyCardsSmart, {
    persist: true,
    enabled: authed,
    deps: [authed],
  });

  const { data: portfolioData } = useSWR<PortfolioSummary>(SWR_PORTFOLIO, fetchPortfolio, {
    persist: true,
    enabled: authed,
    deps: [authed],
  });
  const portfolio = portfolioData && portfolioData.totalCount > 0 ? portfolioData : null;
  const [alertCount, setAlertCount] = useState(0);
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    fetchPriceAlerts().then((a) => { if (alive) setAlertCount(a.filter((x) => !x.triggeredAt).length); }).catch(() => {});
    return () => { alive = false; };
  }, [authed]);

  // 웹 allRows 동일 — 등급 일치 시세(서버 currentPriceJpy: PSA10/9/8→등급가,
  // 타사→PSA10, 싱글=raw) × 수량. 기준가는 구매가 → 등록가(registerPriceJpy) 순.
  const allRows = useMemo<Row[]>(() => {
    return (data ?? []).map((c) => {
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
      const profitPct = basisJpy && curJpy > 0 ? ((curJpy - basisJpy) / basisJpy) * 100 : null;
      const t = c.trend ?? [];
      const dayPct =
        t.length >= 2 && t[t.length - 2] > 0 ? ((t[t.length - 1] - t[t.length - 2]) / t[t.length - 2]) * 100 : null;
      return { c, curJpy, qty, basisJpy, profitPct, dayPct, changePct: profitPct ?? dayPct, value: curJpy * qty };
    });
  }, [data, rate]);

  const rows = useMemo(() => {
    const arr = [...allRows];
    if (sort === 'value') arr.sort((a, b) => b.value - a.value);
    else if (sort === 'change') arr.sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
    else if (sort === 'name') arr.sort((a, b) => cardName(a.c).localeCompare(cardName(b.c), 'ko'));
    else if (sort === 'recent') arr.sort((a, b) => (b.c.createdAt || '').localeCompare(a.c.createdAt || ''));
    // 테마순 — 게임(포켓몬→원피스→…)별로 묶고 그룹 안은 가격 내림차순 (웹 동일).
    else if (sort === 'game') arr.sort((a, b) => gameRank(a.c) - gameRank(b.c) || b.value - a.value);
    return arr;
  }, [allRows, sort]);

  // 히어로 구매금액/평가손익 — 웹 CollectionScreen totals 동일(allRows 기준 합산).
  const heroTotals = useMemo(() => {
    let invested = 0;
    let current = 0;
    for (const r of allRows) {
      if (r.basisJpy && r.curJpy > 0) {
        invested += r.basisJpy * r.qty;
        current += r.curJpy * r.qty;
      }
    }
    return { invested, profit: current - invested };
  }, [allRows]);

  const handleRemove = useCallback(
    (id: number) => {
      Alert.alert('카드 삭제', '이 카드를 컬렉션에서 제거할까요?', [
        { text: '취소' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyCard(id);
              toast.success('카드가 삭제되었습니다');
              refresh();
            } catch {
              toast.error('삭제 실패');
            }
          },
        },
      ]);
    },
    [toast, refresh],
  );

  if (!authed) {
    return (
      <InlineLoginGate
        title="내 자산"
        feature="내 자산"
        description="스캔·구매·거래한 카드와 시세를 한곳에서 관리하세요."
        icon="📦"
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <CollectionHeader tc={tc} />
        <PortfolioHero totals={heroTotals} />
        {loading && !data ? (
          <View style={{ paddingTop: 30 }}><LoadingState /></View>
        ) : error ? (
          <View style={{ marginHorizontal: 14, marginTop: 14 }}>
            <ErrorView error={error} onRetry={refresh} />
          </View>
        ) : (data ?? []).length === 0 ? (
          <View style={{ marginHorizontal: 14, marginTop: 30 }}>
            <EmptyState
              icon="🃏"
              title="아직 보유 카드가 없어요"
              desc="카드를 추가하러 가볼까요?"
              ctaLabel="카드 추가하러 가기"
              onCtaPress={() => router.push('/cards/add' as never)}
            />
          </View>
        ) : (
          <>
            <View style={{ height: 12 }} />
            <CollectionSummary
              port={portfolio}
              cards={data ?? []}
              priceMode={priceMode}
              alertCount={alertCount}
              format={format}
              rate={rate}
            />
            <CollectionComposition cards={data ?? []} priceMode={priceMode} format={format} />

            {/* ── 내 카드 목록 (웹 동일: 헤더 + 그리드/리스트 토글 + 정렬 세그먼트) ── */}
            <View style={{ paddingHorizontal: space.gap }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <PixelText variant="ko" size={15} weight="bold" color={tc.ink}>
                  내 카드 목록 <PixelText variant="ko" size={15} weight="bold" color={tc.ink3}>({rows.length})</PixelText>
                </PixelText>
                <View style={{ flexDirection: 'row', gap: 4, backgroundColor: tc.pap2, borderRadius: 8, padding: 3 }}>
                  {(['grid', 'list'] as ViewMode[]).map((v) => {
                    const on = view === v;
                    const stroke = on ? tc.ink : tc.ink3;
                    return (
                      <Pressable key={v} onPress={() => setView(v)} style={{ width: 30, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? tc.white : 'transparent' }}>
                        {v === 'grid' ? (
                          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>
                            <Rect x={3} y={3} width={7} height={7} rx={1.5} /><Rect x={14} y={3} width={7} height={7} rx={1.5} />
                            <Rect x={3} y={14} width={7} height={7} rx={1.5} /><Rect x={14} y={14} width={7} height={7} rx={1.5} />
                          </Svg>
                        ) : (
                          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round">
                            <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                          </Svg>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 정렬 — 미니멀 세그먼트 (웹 동일) */}
              <View style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 2, backgroundColor: tc.pap2, borderRadius: 8, padding: 2, marginBottom: 14 }}>
                {(
                  [
                    { k: 'value', label: '가격순' },
                    { k: 'change', label: '등락순' },
                    { k: 'recent', label: '등록일' },
                    { k: 'name', label: '이름순' },
                    { k: 'game', label: '테마순' },
                  ] as Array<{ k: SortKey; label: string }>
                ).map((s) => {
                  const on = sort === s.k;
                  return (
                    <Pressable key={s.k} onPress={() => setSort(s.k)} style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, backgroundColor: on ? tc.white : 'transparent' }}>
                      <PixelText variant="ko" size={10} weight="bold" color={on ? tc.ink : tc.ink3}>{s.label}</PixelText>
                    </Pressable>
                  );
                })}
              </View>

              {rows.length === 0 ? (
                <PixelText variant="ko" size={11} color={tc.ink3} style={{ textAlign: 'center', paddingVertical: 30 }}>
                  해당 조건의 카드가 없어요
                </PixelText>
              ) : view === 'grid' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 }}>
                  {rows.map((r, i) => (
                    <CardGridItem key={r.c.id} row={r} rank={i + 1} format={format} onRemove={handleRemove} tc={tc} />
                  ))}
                </View>
              ) : (
                <View style={{ paddingBottom: 24 }}>
                  {rows.map((r, i, arr) => (
                    <CardListItem key={r.c.id} row={r} format={format} last={i === arr.length - 1} onRemove={handleRemove} tc={tc} />
                  ))}
                </View>
              )}
            </View>

            <PixelText variant="ko" size={9} color={tc.ink3} style={{ textAlign: 'center', lineHeight: 15, paddingHorizontal: space.gap }}>
              스니덩크 최근 체결 중앙값 기준 · 관심카드 제외 · 어제(KST 정각) 대비
            </PixelText>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ── 그리드 셀 — 웹 CardGridItem 동일 (2열, 정사각 썸네일, 랭크 배지, 그레이딩 라벨) ── */
function CardGridItem({ row, rank, format, onRemove, tc }: { row: Row; rank: number; format: (j: number) => string; onRemove: (id: number) => void; tc: ReturnType<typeof useThemeColors> }) {
  const { c, curJpy, qty, basisJpy, profitPct } = row;
  const img = c.snkrdunkImageUrl || c.photoUrl || null;
  const open = () => {
    if (c.snkrdunkApparelId) router.push(`/cards/snkrdunk/${c.snkrdunkApparelId}` as never);
  };
  return (
    <View style={{ width: '47.5%', position: 'relative' }}>
      <Pressable onPress={open} style={{ backgroundColor: tc.white, borderColor: tc.pap3, borderWidth: 1, borderRadius: 12, overflow: 'hidden' }}>
        <ThumbImage uri={img} bg={img ? tc.pap2 : FALLBACK_BG[rank % FALLBACK_BG.length]} emojiSize={42} style={{ width: '100%', aspectRatio: 1 }}>
          <View style={{ position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: rankBadgeColor(rank, tc.gold, tc.ink), alignItems: 'center', justifyContent: 'center' }}>
            <PixelText variant="ko" size={11} weight="bold" color="#fff">{rank}</PixelText>
          </View>
          {c.graded ? <GradedLabel gold={tc.gold} company={c.gradeCompany} grade={c.gradeValue} /> : null}
        </ThumbImage>
        <View style={{ paddingHorizontal: 9, paddingTop: 7, paddingBottom: 9 }}>
          <PixelText variant="ko" size={11} weight="bold" color={tc.ink} numberOfLines={1}>{cardName(c)}</PixelText>
          <PixelText variant="ko" size={9} color={tc.ink3} numberOfLines={1} style={{ marginTop: 1 }}>
            {cardSub(c)}{qty > 1 ? ` · ×${qty}` : ''}
          </PixelText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 4, marginTop: 6 }}>
            <PixelText variant="ko" size={12} weight="bold" color={profitColor(profitPct, tc.ink)} numberOfLines={1} style={{ flexShrink: 1 }}>
              {curJpy > 0 ? format(curJpy) : '—'}
            </PixelText>
            <ProfitTag pct={profitPct} size={10} />
          </View>
          <PixelText variant="ko" size={9} color={tc.ink3} numberOfLines={1} style={{ marginTop: 2 }}>
            등록 {basisJpy ? format(basisJpy) : '—'}
          </PixelText>
        </View>
      </Pressable>
      <View style={{ position: 'absolute', top: 6, right: 6, zIndex: 6 }}>
        <CardMenu apparelId={c.snkrdunkApparelId} onRemove={() => onRemove(c.id)} tc={tc} />
      </View>
    </View>
  );
}

/* ── 리스트 행 — 웹 CardListItem 동일 ── */
function CardListItem({ row, format, last, onRemove, tc }: { row: Row; format: (j: number) => string; last: boolean; onRemove: (id: number) => void; tc: ReturnType<typeof useThemeColors> }) {
  const { c, curJpy, qty, basisJpy, profitPct } = row;
  const img = c.snkrdunkImageUrl || c.photoUrl || null;
  const open = () => {
    if (c.snkrdunkApparelId) router.push(`/cards/snkrdunk/${c.snkrdunkApparelId}` as never);
  };
  return (
    <View style={{ position: 'relative', borderBottomWidth: last ? 0 : 1, borderBottomColor: tc.pap3 }}>
      <Pressable onPress={open} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingRight: 20, paddingLeft: 2 }}>
        <ThumbImage uri={img} size={48} emojiSize={22} style={{ borderRadius: 8 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText variant="ko" size={13} weight="bold" color={tc.ink} numberOfLines={1}>{cardName(c)}</PixelText>
          <PixelText variant="ko" size={10} color={tc.ink3} numberOfLines={1} style={{ marginTop: 2 }}>
            {cardSub(c)}{qty > 1 ? ` · ×${qty}` : ''}
          </PixelText>
          <PixelText variant="ko" size={9} color={tc.ink3} numberOfLines={1} style={{ marginTop: 4 }}>
            등록 {basisJpy ? format(basisJpy) : '—'}
          </PixelText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <PixelText variant="ko" size={13} weight="bold" color={profitColor(profitPct, tc.ink)}>
            {curJpy > 0 ? format(curJpy) : '—'}
          </PixelText>
          <View style={{ marginTop: 3 }}>
            <ProfitTag pct={profitPct} size={11} />
          </View>
        </View>
      </Pressable>
      <View style={{ position: 'absolute', top: '50%', right: -2, transform: [{ translateY: -13 }], zIndex: 6 }}>
        <CardMenu apparelId={c.snkrdunkApparelId} onRemove={() => onRemove(c.id)} tc={tc} plain />
      </View>
      {c.graded ? <GradedLabel gold={tc.gold} company={c.gradeCompany} grade={c.gradeValue} /> : null}
    </View>
  );
}

/** 현재가 옆 손익률 태그 — 부호색 ▲/▼ X% (웹 ProfitTag 동일, 매입가 없으면 미렌더). */
function ProfitTag({ pct, size = 11 }: { pct: number | null; size?: number }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <PixelText variant="ko" size={size} weight="bold" color={up ? UP : DOWN}>
      {up ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
    </PixelText>
  );
}

/** 그레이딩 표식 — 우하단 흰 필 배지(그레이딩사 로고 + 등급). 공통 컴포넌트 GradeMark 사용. */
function GradedLabel({ gold, company, grade }: { gold: string; company?: string | null; grade?: string | null }) {
  return <GradeMark company={company} grade={grade} height={12} gold={gold} />;
}

/** 카드 ⋯ 메뉴 — 시세 보기 / 컬렉션에서 제거 (웹 CardMenu 동일). */
function CardMenu({ apparelId, onRemove, tc, plain = false }: { apparelId: number | null; onRemove: () => void; tc: ReturnType<typeof useThemeColors>; plain?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={6}
        style={
          plain
            ? { width: 20, height: 26, alignItems: 'center', justifyContent: 'center' }
            : { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }
        }
      >
        <Text style={{ color: plain ? tc.ink3 : '#fff', fontSize: plain ? 17 : 15, fontWeight: '900', lineHeight: plain ? 18 : 16 }}>⋯</Text>
      </Pressable>
      {open ? (
        <View style={{ position: 'absolute', top: 28, right: 0, minWidth: 132, backgroundColor: tc.white, borderColor: tc.pap3, borderWidth: 1, borderRadius: 10, paddingVertical: 4, zIndex: 20, elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
          {apparelId ? (
            <Pressable
              onPress={() => {
                setOpen(false);
                router.push(`/cards/snkrdunk/${apparelId}` as never);
              }}
              style={{ paddingVertical: 9, paddingHorizontal: 13 }}
            >
              <PixelText variant="ko" size={11} weight="bold" color={tc.ink}>시세 보기</PixelText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              setOpen(false);
              onRemove();
            }}
            style={{ paddingVertical: 9, paddingHorizontal: 13 }}
          >
            <PixelText variant="ko" size={11} weight="bold" color={UP}>컬렉션에서 제거</PixelText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** 웹 CollectionHeader 동일 — "내 자산" + 검색/알림/도움말 아이콘. */
function CollectionHeader({ tc }: { tc: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
      <PixelText variant="ko" size={22} weight="bold" color={tc.ink} style={{ letterSpacing: -0.5 }}>
        내 자산
      </PixelText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Pressable onPress={() => router.push('/cards/snkrdunk/search' as never)} hitSlop={6}>
          <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={tc.ink} strokeWidth={2} strokeLinecap="round">
            <Circle cx={11} cy={11} r={7} />
            <Path d="m20 20-3.5-3.5" />
          </Svg>
        </Pressable>
        <Pressable onPress={() => router.push('/my/messages' as never)} hitSlop={6}>
          <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={tc.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <Path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </Svg>
        </Pressable>
        <Pressable onPress={() => router.push('/my/faq' as never)} hitSlop={6}>
          <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={tc.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx={12} cy={12} r={10} />
            <Path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
            <Path d="M12 17h.01" />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}
