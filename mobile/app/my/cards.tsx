/**
 * /my/cards — 내 자산 (웹 CollectionScreen 1:1).
 * 히어로(총 자산 + 자산 요약 7일/30일) → 내 카드 목록.
 * (자산 구성 파이는 총 자산 탭 → 포트폴리오 상세로 이동.)
 * 목록: 기본 리스트형, 뷰 2종(그리드 2열/리스트) + 정렬(가격순/등락순/등록일/이름순/테마순) +
 * 중복 등록 카드는 한 줄로 묶고(×N) 펼치면 장별 등록가/손익 +
 * 카드 ⋯ 메뉴(시세 보기/컬렉션에서 제거). 시세는 등급 일치(그레이딩=PSA10,
 * 비그레이딩=싱글) — 웹 allRows 와 동일 계산.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { PortfolioHero } from '@/components/PortfolioHero';
import { FavoritesView } from '@/components/FavoritesView';
import { PixelText } from '@/components/PixelText';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { GradeMark } from '@/components/cv/GradeMark';
import { InlineLoginGate } from '@/components/InlineLoginGate';
import { useCurrency } from '@/components/CurrencyProvider';
import { useToast } from '@/components/ToastProvider';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import {
  fetchMyCardsSmart,
  deleteMyCard,
  SWR_MY_CARDS,
  type MyCardRow,
} from '@/lib/myApi';
import { useSWR } from '@/lib/swr';
import { isAuthenticated, subscribeSession } from '@/lib/session';
import { parseCardStatics } from '../../../shared/cardStatics';
import { SegmentedTabs, SegIcons } from '@/components/cv/SegmentedTabs';
import { groupDuplicates, type CardGroup } from '../../../shared/collectionGroup';
import { evaluationUnitJpy } from '../../../shared/snkrdunkPrice';

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
  /** 표시용 현재가 — 실시세, 없으면 등록가 폴백. */
  curJpy: number;
  /** 실시세(등급 일치). 0 이면 시세 미확보 — 손익 계산에서 제외. */
  gradePriceJpy: number;
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

type AssetTab = 'assets' | 'favorites';

export default function MyCardsScreen() {
  const tc = useThemeColors();
  // 내 자산 ↔ 관심카드 탭 (웹 CollectionScreen 페어)
  const [tab, setTab] = useState<AssetTab>('assets');
  const txt = useThemeTextVariant();
  const authed = useAuthed();
  const { format, rate } = useCurrency();
  const toast = useToast();

  // 기본은 리스트형 — 한 화면에 더 많은 카드와 등록가/손익을 같이 본다 (웹 동일).
  const [view, setView] = useState<ViewMode>('list');
  const [sort, setSort] = useState<SortKey>('value');
  // 박스 제외 — 목록·손익 합계에서 박스(미개봉 상품)를 뺀다 (웹 CollectionScreen 동일).
  const [excludeBox, setExcludeBox] = useState(false);

  // SWR — 카드 정적 데이터는 디스크까지 캐싱, 재진입 시 즉시 그리고 "오늘의 금액"만
  // /api/me/cards/prices 로 받아 merge (fetchMyCardsSmart). 등록/삭제 시 자동 무효화.
  const { data, loading, error, refresh } = useSWR<MyCardRow[]>(SWR_MY_CARDS, fetchMyCardsSmart, {
    persist: true,
    enabled: authed,
    deps: [authed],
  });

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
      const gradePriceJpy =
        (c.currentPriceJpy ?? 0) > 0
          ? (c.currentPriceJpy as number)
          : c.graded
            ? c.pricePsa10Jpy ?? 0
            : c.priceSingleJpy ?? 0;
      // 시세를 아직 못 받은 카드도 등록가로 평가액에 잡히게 — 폴백 정본 evaluationUnitJpy(웹·서버 동일).
      const curJpy = evaluationUnitJpy({ gradeJpy: gradePriceJpy, basisJpy });
      const profitPct = basisJpy && gradePriceJpy > 0 ? ((gradePriceJpy - basisJpy) / basisJpy) * 100 : null;
      const t = c.trend ?? [];
      const dayPct =
        t.length >= 2 && t[t.length - 2] > 0 ? ((t[t.length - 1] - t[t.length - 2]) / t[t.length - 2]) * 100 : null;
      return { c, curJpy, gradePriceJpy, qty, basisJpy, profitPct, dayPct, changePct: profitPct ?? dayPct, value: curJpy * qty };
    });
  }, [data, rate]);
  const boxCount = useMemo(() => allRows.filter((r) => r.c.itemKind === 'box').length, [allRows]);
  const visibleRows = useMemo(
    () => (excludeBox ? allRows.filter((r) => r.c.itemKind !== 'box') : allRows),
    [allRows, excludeBox],
  );

  const rows = useMemo(() => {
    const arr = [...visibleRows];
    if (sort === 'value') arr.sort((a, b) => b.value - a.value);
    else if (sort === 'change') arr.sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
    else if (sort === 'name') arr.sort((a, b) => cardName(a.c).localeCompare(cardName(b.c), 'ko'));
    else if (sort === 'recent') arr.sort((a, b) => (b.c.createdAt || '').localeCompare(a.c.createdAt || ''));
    // 테마순 — 게임(포켓몬→원피스→…)별로 묶고 그룹 안은 가격 내림차순 (웹 동일).
    else if (sort === 'game') arr.sort((a, b) => gameRank(a.c) - gameRank(b.c) || b.value - a.value);
    return arr;
  }, [visibleRows, sort]);

  // 중복 등록(같은 카드·같은 등급)은 한 줄로 묶는다 — 정본 shared/collectionGroup (웹 동일).
  const groups = useMemo(() => groupDuplicates(rows), [rows]);

  // 히어로 구매금액/평가손익 — 웹 CollectionScreen totals 동일(allRows 기준 합산).
  const heroTotals = useMemo(() => {
    let invested = 0;
    let current = 0;
    for (const r of visibleRows) {
      // 손익은 실시세가 있는 카드만 — 등록가 폴백 카드는 손익 0 으로 섞이지 않게 (웹 동일).
      if (r.basisJpy && r.gradePriceJpy > 0) {
        invested += r.basisJpy * r.qty;
        current += r.gradePriceJpy * r.qty;
      }
    }
    return { invested, profit: current - invested };
  }, [visibleRows]);

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
        <CollectionHeader tc={tc} tab={tab} setTab={setTab} />
        {tab === 'favorites' ? (
          <FavoritesView />
        ) : (
        <>
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

              {/* 정렬 — 미니멀 세그먼트 (웹 동일) + 박스 제외 체크박스 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <View style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 2, backgroundColor: tc.pap2, borderRadius: 8, padding: 2 }}>
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
              {boxCount > 0 ? (
                <Pressable onPress={() => setExcludeBox((v) => !v)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: excludeBox ? tc.ink : tc.ink3, backgroundColor: excludeBox ? tc.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {excludeBox ? <PixelText variant="ko" size={10} weight="bold" color={tc.white}>✓</PixelText> : null}
                  </View>
                  <PixelText variant="ko" size={10} weight="bold" color={excludeBox ? tc.ink : tc.ink3}>{`박스 제외 (${boxCount})`}</PixelText>
                </Pressable>
              ) : null}
              </View>

              {groups.length === 0 ? (
                <PixelText variant="ko" size={11} color={tc.ink3} style={{ textAlign: 'center', paddingVertical: 30 }}>
                  해당 조건의 카드가 없어요
                </PixelText>
              ) : view === 'grid' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 }}>
                  {groups.map((g, i) => (
                    <CardGridItem key={g.key} group={g} rank={i + 1} format={format} onRemove={handleRemove} tc={tc} />
                  ))}
                </View>
              ) : (
                <View style={{ paddingBottom: 24 }}>
                  {groups.map((g, i, arr) => (
                    <CardListItem key={g.key} group={g} format={format} last={i === arr.length - 1} onRemove={handleRemove} tc={tc} />
                  ))}
                </View>
              )}
            </View>

            <PixelText variant="ko" size={9} color={tc.ink3} style={{ textAlign: 'center', lineHeight: 15, paddingHorizontal: space.gap }}>
              스니덩크 최근 체결 중앙값 기준 · 관심카드 제외 · 등락은 등록가 대비 누적
            </PixelText>
          </>
        )}
        </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * 컬렉션 카드 → 시세상세 이동. 목록이 보여준 가격의 등급 기준(priceBasis)을
 * `?grade=` 로 넘겨 상세 첫 화면이 같은 등급·같은 금액으로 열리게 한다
 * (RAW 저장 카드는 RAW 탭 먼저, PSA10 은 탭으로 전환).
 */
function openCardDetail(apparelId: number | null | undefined, basis?: string | null): void {
  if (!apparelId) return;
  const q = basis ? `?grade=${encodeURIComponent(basis)}` : '';
  router.push(`/cards/snkrdunk/${apparelId}${q}` as never);
}

/* ── 그리드 셀 — 웹 CardGridItem 동일 (2열, 정사각 썸네일, 랭크 배지, 그레이딩 라벨) ── */
function CardGridItem({ group, rank, format, onRemove, tc }: { group: CardGroup<Row>; rank: number; format: (j: number) => string; onRemove: (id: number) => void; tc: ReturnType<typeof useThemeColors> }) {
  const { c, curJpy, basisJpy } = group.head;
  // 중복 등록은 한 타일로 — 장수·손익률은 그룹 합산 기준 (웹 동일).
  const qty = group.qty;
  const profitPct = group.profitPct;
  const img = c.snkrdunkImageUrl || c.photoUrl || null;
  const open = () => openCardDetail(c.snkrdunkApparelId, c.priceBasis);
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
            등록 {basisJpy ? format(basisJpy) : '—'}{group.items.length > 1 ? ` 외 ${group.items.length - 1}건` : ''}
          </PixelText>
        </View>
      </Pressable>
      <View style={{ position: 'absolute', top: 6, right: 6, zIndex: 6 }}>
        <CardMenu apparelId={c.snkrdunkApparelId} basis={c.priceBasis} onRemove={() => onRemove(c.id)} tc={tc} />
      </View>
    </View>
  );
}

/* ── 리스트 행 — 웹 CardListItem 동일: 썸네일 | 카드명+등급배지 / 등록가·장수 | 오늘가 / 차액·등락률 ── */
function CardListItem({ group, format, last, onRemove, tc }: { group: CardGroup<Row>; format: (j: number) => string; last: boolean; onRemove: (id: number) => void; tc: ReturnType<typeof useThemeColors> }) {
  const { c } = group.head;
  const dup = group.items.length > 1;
  const [open, setOpen] = useState(false);
  const img = c.snkrdunkImageUrl || c.photoUrl || null;
  const openDetail = () => openCardDetail(c.snkrdunkApparelId, c.priceBasis);
  const profit = group.profitAbsJpy;
  const up = (profit ?? 0) >= 0;
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: tc.pap3 }}>
      <View style={{ position: 'relative' }}>
        <Pressable onPress={openDetail} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingRight: 24, paddingLeft: 2 }}>
          {/* 카드 비율 썸네일 */}
          <ThumbImage uri={img} emojiSize={26} style={{ width: 54, height: 74, borderRadius: 8 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            {/* 카드명 + 등급 배지(무등급이면 회색 칩) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <PixelText variant="ko" size={13.5} weight="bold" color={tc.ink} numberOfLines={1} style={{ flexShrink: 1 }}>{cardName(c)}</PixelText>
              {c.graded ? (
                <GradedLabel gold={tc.gold} company={c.gradeCompany} grade={c.gradeValue} height={11} inline />
              ) : (
                <View style={{ backgroundColor: tc.pap2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                  <PixelText variant="ko" size={9.5} weight="bold" color={tc.ink3}>무등급</PixelText>
                </View>
              )}
            </View>
            {/* 등록(기준)가 · 보유 장수 */}
            <PixelText variant="ko" size={11} color={tc.ink3} numberOfLines={1} style={{ marginTop: 6 }}>
              {`등록 ${group.head.basisJpy ? format(group.head.basisJpy) : '—'} · ${group.qty}장${dup ? ` (${group.items.length}건)` : ''}`}
            </PixelText>
          </View>
          {/* 오늘 가격(평가액) + 등록가 대비 차액·등락률 */}
          <View style={{ alignItems: 'flex-end' }}>
            <PixelText variant="ko" size={14} weight="bold" color={tc.ink}>
              {group.value > 0 ? format(group.value) : '—'}
            </PixelText>
            {profit != null && group.profitPct != null ? (
              <PixelText variant="ko" size={11.5} weight="bold" color={up ? UP : DOWN} style={{ marginTop: 5 }}>
                {`${up ? '▲' : '▼'} ${format(Math.abs(profit))} (${up ? '+' : '-'}${Math.abs(group.profitPct).toFixed(1)}%)`}
              </PixelText>
            ) : null}
          </View>
        </Pressable>
        <View style={{ position: 'absolute', top: '50%', right: -4, transform: [{ translateY: -13 }], zIndex: 6 }}>
          {dup ? (
            <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8} style={{ width: 22, height: 26, alignItems: 'center', justifyContent: 'center' }}>
              <PixelText variant="ko" size={11} color={tc.ink3}>{open ? '▲' : '▼'}</PixelText>
            </Pressable>
          ) : (
            <CardMenu apparelId={c.snkrdunkApparelId} basis={c.priceBasis} onRemove={() => onRemove(c.id)} tc={tc} plain />
          )}
        </View>
      </View>

      {/* 중복 등록분 — 장마다 등록가·손익이 다르므로 각각 보여준다. */}
      {dup && open ? (
        <View style={{ paddingLeft: 66, paddingBottom: 10 }}>
          {group.items.map((r, i) => (
            <View key={r.c.id} style={{ position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 7, paddingRight: 24 }}>
              <PixelText variant="ko" size={10} color={tc.ink3} numberOfLines={1} style={{ flexShrink: 1 }}>
                {`${i + 1}번째${r.qty > 1 ? ` · ×${r.qty}` : ''} · 등록 ${r.basisJpy ? format(r.basisJpy) : '—'}`}
              </PixelText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <PixelText variant="ko" size={12} weight="bold" color={profitColor(r.profitPct, tc.ink)}>
                  {r.value > 0 ? format(r.value) : '—'}
                </PixelText>
                <ProfitTag pct={r.profitPct} size={10} />
              </View>
              <View style={{ position: 'absolute', top: '50%', right: -4, transform: [{ translateY: -13 }] }}>
                <CardMenu apparelId={r.c.snkrdunkApparelId} basis={r.c.priceBasis} onRemove={() => onRemove(r.c.id)} tc={tc} plain />
              </View>
            </View>
          ))}
        </View>
      ) : null}
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
function GradedLabel({ gold, company, grade, height = 12, inline }: { gold: string; company?: string | null; grade?: string | null; height?: number; inline?: boolean }) {
  return <GradeMark company={company} grade={grade} height={height} gold={gold} inline={inline} />;
}

/** 카드 ⋯ 메뉴 — 시세 보기 / 컬렉션에서 제거 (웹 CardMenu 동일). */
function CardMenu({ apparelId, basis, onRemove, tc, plain = false }: { apparelId: number | null; basis?: string | null; onRemove: () => void; tc: ReturnType<typeof useThemeColors>; plain?: boolean }) {
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
                openCardDetail(apparelId, basis);
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

/** 웹 CollectionHeader 동일 — "내 자산" + 검색 아이콘. */
function CollectionHeader({
  tc, tab, setTab,
}: {
  tc: ReturnType<typeof useThemeColors>;
  tab: AssetTab;
  setTab: (t: AssetTab) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
      <SegmentedTabs
        items={[
          { id: 'assets', label: '내 자산', icon: SegIcons.wallet },
          { id: 'favorites', label: '관심카드', icon: SegIcons.star },
        ]}
        value={tab}
        onChange={setTab}
        track={tc.pap2}
        activeBg={tc.ink}
        activeFg={tc.paper}
        inactiveFg={tc.ink3}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Pressable onPress={() => router.push('/cards/snkrdunk/search' as never)} hitSlop={6}>
          <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={tc.ink} strokeWidth={2} strokeLinecap="round">
            <Circle cx={11} cy={11} r={7} />
            <Path d="m20 20-3.5-3.5" />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}
