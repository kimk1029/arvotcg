/**
 * /my/cards — 내 자산 (웹 CollectionScreen 1:1).
 * 히어로(총 자산) → 내 카드 목록. (7일/30일 변화는 포트폴리오 상세로 이동)
 * (자산 구성 파이는 총 자산 탭 → 포트폴리오 상세로 이동.)
 * 목록: 기본 리스트형, 뷰 2종(그리드 2열/리스트) + 정렬(가격순/등락순/등록일/이름순/테마순) +
 * 중복 등록 카드는 한 줄로 묶고(×N) 펼치면 장별 등록가/손익 +
 * 카드 ⋯ 메뉴(시세 보기/컬렉션에서 제거). 시세는 등급 일치(그레이딩=PSA10,
 * 비그레이딩=싱글) — 웹 allRows 와 동일 계산.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { CardRegisterSheet } from '@/components/CardRegisterSheet';
import type { RegisterInitial } from '@/components/CardRegisterForm';
import type { CardItem } from '@/data/cardvault';
import { router } from 'expo-router';
import { AdBanner } from '@/components/AdBanner';
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
  bundleMyCards,
  SWR_MY_CARDS,
  type MyCardRow,
} from '@/lib/myApi';
import { useSWR, swrSet } from '@/lib/swr';
import { isAuthenticated, subscribeSession } from '@/lib/session';
import { parseCardStatics } from '../../../shared/cardStatics';
import { SegmentedTabs, SegIcons } from '@/components/cv/SegmentedTabs';
import { groupDuplicates, type CardGroup } from '../../../shared/collectionGroup';
import { evaluationUnitJpy } from '../../../shared/snkrdunkPrice';
import { collectionTotals } from '../../../shared/collectionTotals';
import { regionBadge } from '../../../shared/collectionBadges';

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
  // 삭제 낙관 반영 — 서버 응답을 기다리지 않고 목록·총액에서 즉시 뺀다.
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  // 등록 정보 수정 — ⋯ 메뉴 '등록 정보 수정' → 등록 시트를 기존 값으로 채워 띄운다 (웹 동일).
  const [editing, setEditing] = useState<MyCardRow | null>(null);
  // 묶음 만들기 — 선택 모드에서 카드를 고르고 '묶기'. 서버 bundleId 로 저장 (웹 동일).
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

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
    return (data ?? []).filter((c) => !removedIds.includes(c.id)).map((c) => {
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
  }, [data, rate, removedIds]);
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

  // 총 자산 가치 — 정본 shared/collectionTotals (웹·마이페이지·포트폴리오와 같은 숫자).
  const heroLocal = useMemo(() => collectionTotals(visibleRows.map((r) => r.c), rate), [visibleRows, rate]);
  const heroTotalJpy = heroLocal.totalJpy;
  const heroCount = heroLocal.qty;

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

  // 삭제 — 목록에서 먼저 빼고(총액도 즉시 감소) 서버 처리는 뒤에서. 완료되면 토스트,
  // 실패하면 되돌린다 (웹 CollectionScreen 동일).
  const handleRemove = useCallback(
    (id: number) => {
      Alert.alert('카드 삭제', '이 카드를 컬렉션에서 제거할까요?', [
        { text: '취소' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setRemovedIds((ids) => [...ids, id]);
            try {
              await deleteMyCard(id);
              // 재조회(refresh)는 하지 않는다 — 캐시가 비면 로딩 상태로 한 번 더 깜빡인다.
              // 남은 목록을 그대로 캐시에 넣어 두면 재진입도 즉시 그려진다.
              swrSet(SWR_MY_CARDS, (data ?? []).filter((c) => c.id !== id), { persist: true });
              toast.success('카드가 컬렉션에서 삭제되었습니다');
            } catch {
              setRemovedIds((ids) => ids.filter((x) => x !== id));
              toast.error('삭제에 실패했어요. 잠시 후 다시 시도해 주세요');
            }
          },
        },
      ]);
    },
    [toast, data],
  );

  // 묶음 만들기/해제 — 캐시에 bundleId 반영 후 refresh(캐시 시드로 즉시 그리고 백그라운드 갱신).
  const handleBundle = useCallback(
    async (ids: number[], bundle: boolean) => {
      try {
        await bundleMyCards(ids, bundle);
        setSelecting(false);
        setSelected([]);
        refresh();
        toast.success(bundle ? `${ids.length}장을 묶었어요` : '묶음을 해제했어요');
      } catch {
        toast.error(bundle ? '묶기에 실패했어요' : '묶음 해제에 실패했어요');
      }
    },
    [refresh, toast],
  );
  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

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
        <PortfolioHero totals={heroTotals} totalJpy={heroTotalJpy} totalCount={heroCount} />
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
            {/* 광고 — 자산 히어로와 카드 목록 사이. */}
            <AdBanner marginHorizontal={space.gap} marginBottom={14} />
            {/* ── 내 카드 목록 (웹 동일: 헤더 + 그리드/리스트 토글 + 정렬 세그먼트) ── */}
            <View style={{ paddingHorizontal: space.gap }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <PixelText variant="ko" size={15} weight="bold" color={tc.ink}>
                  내 카드 목록 <PixelText variant="ko" size={15} weight="bold" color={tc.ink3}>({rows.length})</PixelText>
                </PixelText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* 묶기 — 선택 모드 토글 (웹 동일). 리스트형에서 고른 뒤 하단 바의 '묶기'. */}
                <Pressable
                  onPress={() => { setSelecting((v) => !v); setSelected([]); if (!selecting) setView('list'); }}
                  style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: selecting ? tc.ink : tc.pap3, backgroundColor: selecting ? tc.ink : tc.white }}
                >
                  <PixelText variant="ko" size={10} weight="bold" color={selecting ? tc.white : tc.ink}>{selecting ? '선택 취소' : '묶기'}</PixelText>
                </Pressable>
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
                    <CardGridItem key={g.key} group={g} rank={i + 1} format={format} onRemove={handleRemove} onEdit={setEditing} onUnbundle={(ids) => handleBundle(ids, false)} tc={tc} />
                  ))}
                </View>
              ) : (
                <View style={{ paddingBottom: 24 }}>
                  {groups.map((g, i, arr) => (
                    <CardListItem
                      key={g.key}
                      group={g}
                      format={format}
                      last={i === arr.length - 1}
                      onRemove={handleRemove}
                      onEdit={setEditing}
                      onUnbundle={(ids) => handleBundle(ids, false)}
                      selecting={selecting}
                      selected={selected}
                      onToggleSelect={toggleSelect}
                      tc={tc}
                    />
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

      {/* 선택 모드 하단 바 — 2장 이상 고르면 '묶기' 활성 (웹 동일). */}
      {selecting ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 100, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: tc.ink, borderRadius: 999, paddingVertical: 8, paddingLeft: 18, paddingRight: 8, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}>
            <PixelText variant="ko" size={12} weight="bold" color={tc.white}>{`${selected.length}장 선택`}</PixelText>
            <Pressable
              disabled={selected.length < 2}
              onPress={() => handleBundle(selected, true)}
              style={{ paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, backgroundColor: selected.length < 2 ? 'rgba(255,255,255,0.25)' : tc.white }}
            >
              <PixelText variant="ko" size={12} weight="bold" color={selected.length < 2 ? 'rgba(255,255,255,0.6)' : tc.ink}>묶기</PixelText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 등록 정보 수정 시트 — 시세상세 등록 팝업과 같은 폼을 기존 값으로 채워 띄운다 (웹 수정 모달 페어). */}
      {editing ? (
        <CardRegisterSheet
          visible
          card={{ apparelId: editing.snkrdunkApparelId ?? 0, name: cardName(editing), imageUrl: editing.snkrdunkImageUrl || editing.photoUrl, currentPriceJpy: editing.currentPriceJpy ?? null }}
          item={rowToCardItem(editing)}
          editId={editing.id}
          initial={rowToInitial(editing)}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            // 서버가 돌려준 행(등록가 재산정 포함)을 캐시에 merge 하고 refresh — 시드로 즉시 그려져 스피너가 없다.
            const id = editing.id;
            const cur = data ?? [];
            swrSet(
              SWR_MY_CARDS,
              cur.map((c) => (c.id === id && updated ? { ...c, ...pickEditable(updated) } : c)),
              { persist: true },
            );
            refresh();
          }}
        />
      ) : null}
    </View>
  );
}

/** MyCardRow → 등록 폼이 받는 CardItem (수정 모드 미리보기용). */
function rowToCardItem(c: MyCardRow): CardItem {
  return {
    id: c.id,
    name: cardName(c),
    set: c.ocrSetCode ?? '-',
    num: c.ocrCardNumber ?? '-',
    game: '포켓몬',
    rar: 'R',
    grade: null,
    price: c.currentPriceJpy ?? 0,
    priceSingle: (c.currentPriceJpy ?? 0) > 0 ? c.currentPriceJpy : undefined,
    priceCurrency: 'JPY',
    trend: [],
    emoji: '🃏',
    owned: true,
    snkrdunkApparelId: c.snkrdunkApparelId ?? undefined,
    imageUrl: c.snkrdunkImageUrl || c.photoUrl || undefined,
  };
}

/** MyCardRow → 등록 폼 초기값 (웹 CollectionScreen initial 동일 규칙). */
function rowToInitial(c: MyCardRow): RegisterInitial {
  return {
    selfPulled: c.selfPulled ?? false,
    buyPrice: c.buyPrice != null && c.buyPrice > 0 ? String(c.buyPrice) : '',
    buyCurrency: c.buyCurrency === 'JPY' ? 'JPY' : 'KRW',
    buyDate: c.buyDate ?? '',
    qty: Math.max(1, c.qty || 1),
    region: c.region === 'kr' || c.region === 'en' ? c.region : 'jp',
    graded: c.graded ?? false,
    gradeCompany: c.gradeCompany ?? 'PSA',
    gradeValue: c.gradeValue ?? '',
    memo: c.memo ?? '',
  };
}

/** 서버 갱신 행에서 목록 캐시에 덮어쓸 편집 필드만 — 시세 필드는 기존 값 유지. */
function pickEditable(u: MyCardRow): Partial<MyCardRow> {
  return {
    buyPrice: u.buyPrice ?? null, buyCurrency: u.buyCurrency ?? null, qty: u.qty, buyDate: u.buyDate ?? null,
    region: u.region ?? null, memo: u.memo ?? null, selfPulled: u.selfPulled, graded: u.graded,
    gradeCompany: u.gradeCompany ?? null, gradeValue: u.gradeValue ?? null, registerPriceJpy: u.registerPriceJpy,
  };
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
function CardGridItem({ group, rank, format, onRemove, onEdit, onUnbundle, tc }: { group: CardGroup<Row>; rank: number; format: (j: number) => string; onRemove: (id: number) => void; onEdit: (c: MyCardRow) => void; onUnbundle: (ids: number[]) => void; tc: ReturnType<typeof useThemeColors> }) {
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
        <CardMenu
          menuKey={`grid:${c.id}`}
          apparelId={c.snkrdunkApparelId}
          basis={c.priceBasis}
          onRemove={() => onRemove(c.id)}
          onEdit={group.items.length === 1 ? () => onEdit(c) : undefined}
          onUnbundle={c.bundleId ? () => onUnbundle(group.items.map((r) => r.c.id)) : undefined}
          tc={tc}
        />
      </View>
    </View>
  );
}

/** 카드 이름 아랫줄 배지 — 등급(PSA 10 / 무등급) + 언어판(일판/한판/영판) + 묶음(N장). 웹 BadgeRow 동일. */
function BadgeRow({ c, bundleCount, tc }: { c: MyCardRow; bundleCount?: number; tc: ReturnType<typeof useThemeColors> }) {
  const lang = regionBadge(c.region);
  const Chip = ({ label, dark }: { label: string; dark?: boolean }) => (
    <View style={{ backgroundColor: dark ? tc.ink : tc.pap2, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
      <PixelText variant="ko" size={9} weight="bold" color={dark ? tc.white : tc.ink3}>{label}</PixelText>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
      {c.graded ? <GradedLabel gold={tc.gold} company={c.gradeCompany} grade={c.gradeValue} height={9} inline /> : <Chip label="무등급" />}
      {lang ? <Chip label={lang} /> : null}
      {bundleCount != null && bundleCount > 1 ? <Chip label={`묶음 ${bundleCount}장`} dark /> : null}
    </View>
  );
}

/** 묶음 썸네일 — 카드 이미지가 부채꼴로 겹치고 우하단에 장수 배지 (웹 FanThumb 동일). */
function FanThumb({ srcs, count, tc }: { srcs: Array<string | null>; count: number; tc: ReturnType<typeof useThemeColors> }) {
  const layers = srcs.slice(0, 3);
  const n = layers.length;
  return (
    <View style={{ width: 54, height: 74 }}>
      {layers.map((src, i) => {
        // 뒤 카드일수록 왼쪽·위로 살짝 벗어나며 기울인다(부채꼴). 맨 앞(i=n-1)이 정위치.
        const k = n - 1 - i;
        return (
          <ThumbImage
            key={i}
            uri={src}
            emojiSize={22}
            style={{ position: 'absolute', left: 0, top: 0, width: 46, height: 64, borderRadius: 6, zIndex: i + 1, transform: [{ translateX: k * -4 }, { translateY: k * -3 }, { rotate: `${k * -8}deg` }] }}
          />
        );
      })}
      <View style={{ position: 'absolute', right: -2, bottom: 2, zIndex: 5, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: tc.ink, alignItems: 'center', justifyContent: 'center' }}>
        <PixelText variant="ko" size={10} weight="bold" color={tc.white}>{String(count)}</PixelText>
      </View>
    </View>
  );
}

/** 선택 모드 체크박스. */
function SelectBox({ on, tc }: { on: boolean; tc: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: on ? tc.ink : tc.pap3, backgroundColor: on ? tc.ink : tc.white, alignItems: 'center', justifyContent: 'center' }}>
      {on ? <PixelText variant="ko" size={11} weight="bold" color={tc.white}>✓</PixelText> : null}
    </View>
  );
}

/* ── 리스트 행 — 웹 CardListItem 동일: 썸네일(묶음=부채꼴) | 카드명 / 배지줄 / 등록가·장수 | 평가액 / 손익 ── */
function CardListItem({
  group, format, last, onRemove, onEdit, onUnbundle, selecting, selected, onToggleSelect, tc,
}: {
  group: CardGroup<Row>; format: (j: number) => string; last: boolean;
  onRemove: (id: number) => void; onEdit: (c: MyCardRow) => void; onUnbundle: (ids: number[]) => void;
  selecting: boolean; selected: number[]; onToggleSelect: (id: number) => void;
  tc: ReturnType<typeof useThemeColors>;
}) {
  const { c } = group.head;
  const dup = group.items.length > 1;
  const [open, setOpen] = useState(false);
  const img = c.snkrdunkImageUrl || c.photoUrl || null;
  const openDetail = () => openCardDetail(c.snkrdunkApparelId, c.priceBasis);
  const profit = group.profitAbsJpy;
  const up = (profit ?? 0) >= 0;
  const allSelected = group.items.every((r) => selected.includes(r.c.id));
  const toggleGroup = () => group.items.forEach((r) => { if (selected.includes(r.c.id) === allSelected) onToggleSelect(r.c.id); });
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: tc.pap3 }}>
      <View style={{ position: 'relative' }}>
        <Pressable onPress={selecting ? toggleGroup : openDetail} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingRight: 24, paddingLeft: 2 }}>
          {selecting ? <SelectBox on={allSelected} tc={tc} /> : null}
          {/* 썸네일 — 묶음이면 부채꼴 + 장수 배지 */}
          {dup ? (
            <FanThumb srcs={group.items.map((r) => r.c.snkrdunkImageUrl || r.c.photoUrl || null)} count={group.qty} tc={tc} />
          ) : (
            <ThumbImage uri={img} emojiSize={26} style={{ width: 54, height: 74, borderRadius: 8 }} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            {/* 카드명 — 배지는 아랫줄로 빼서 이름이 잘리지 않게 */}
            <PixelText variant="ko" size={13.5} weight="bold" color={tc.ink} numberOfLines={1}>{cardName(c)}</PixelText>
            <BadgeRow c={c} bundleCount={dup ? group.qty : undefined} tc={tc} />
            {/* 등록(기준)가 · 보유 장수(진하게). 묶음은 등록 합계. */}
            <PixelText variant="ko" size={11} color={tc.ink3} numberOfLines={1} style={{ marginTop: 5 }}>
              {dup ? `등록 합계 ${group.investedJpy > 0 ? format(group.investedJpy) : '—'}` : `등록 ${group.head.basisJpy ? format(group.head.basisJpy) : '—'}`}
              {' · '}
              <PixelText variant="ko" size={11} weight="bold" color={tc.ink}>{`${group.qty}장`}</PixelText>
            </PixelText>
          </View>
          {/* 평가금액(검정 볼드) + 등록가 대비 손익(한 단계 작게, 상승 빨강/하락 파랑) */}
          <View style={{ alignItems: 'flex-end' }}>
            <PixelText variant="ko" size={14} weight="bold" color={tc.ink}>
              {group.value > 0 ? format(group.value) : '—'}
            </PixelText>
            {profit != null && group.profitPct != null ? (
              <PixelText variant="ko" size={10.5} weight="bold" color={up ? UP : DOWN} style={{ marginTop: 4 }}>
                {`${up ? '▲' : '▼'} ${format(Math.abs(profit))} (${up ? '+' : '-'}${Math.abs(group.profitPct).toFixed(1)}%)`}
              </PixelText>
            ) : null}
          </View>
        </Pressable>
        {/* ⋯ 메뉴 — 우측 세로 중앙. 묶음이면 펼치기 버튼으로 대체(메뉴는 하위 행에). */}
        {!selecting ? (
          <View style={{ position: 'absolute', top: '50%', right: -4, transform: [{ translateY: -13 }], zIndex: 6 }}>
            {dup ? (
              <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8} style={{ width: 22, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                <PixelText variant="ko" size={11} color={tc.ink3}>{open ? '▲' : '▼'}</PixelText>
              </Pressable>
            ) : (
              <CardMenu menuKey={`list:${c.id}`} apparelId={c.snkrdunkApparelId} basis={c.priceBasis} onRemove={() => onRemove(c.id)} onEdit={() => onEdit(c)} tc={tc} plain />
            )}
          </View>
        ) : null}
      </View>

      {/* 묶음 하위 행 — 장마다 등록가·등록일·개별 손익이 다르므로 각각. 현재가는 같은 카드면 전부 같다. */}
      {dup && open && !selecting ? (
        <View style={{ paddingLeft: 66, paddingBottom: 10 }}>
          {c.bundleId ? (
            <Pressable onPress={() => onUnbundle(group.items.map((r) => r.c.id))} style={{ alignSelf: 'flex-start', backgroundColor: tc.pap2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4 }}>
              <PixelText variant="ko" size={10} weight="bold" color={tc.ink3}>🧩 묶음 해제</PixelText>
            </Pressable>
          ) : null}
          {group.items.map((r, i) => {
            // 장별 차액 — 현재 평가액 − 기준가×수량. 금액은 검정, 차액만 부호색 (웹 동일).
            const diff = r.basisJpy != null && r.gradePriceJpy > 0 ? r.value - r.basisJpy * r.qty : null;
            const diffUp = (diff ?? 0) >= 0;
            const date = (r.c.buyDate || r.c.createdAt || '').slice(0, 10);
            return (
              // 뒤 행이 위로 쌓이게(zIndex) + 메뉴는 위로 펼쳐 다음 행에 가리지 않는다.
              <View key={r.c.id} style={{ position: 'relative', zIndex: i + 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 7, paddingRight: 24 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <PixelText variant="ko" size={11} weight="bold" color={tc.ink} numberOfLines={1}>{`${i + 1}. ${cardName(r.c)}`}</PixelText>
                  <PixelText variant="ko" size={10} color={tc.ink3} numberOfLines={1} style={{ marginTop: 2 }}>
                    {`등록 ${r.basisJpy ? format(r.basisJpy) : '—'}${r.qty > 1 ? ` · ×${r.qty}` : ''}${date ? ` · ${date}` : ''}`}
                  </PixelText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <PixelText variant="ko" size={12} weight="bold" color={tc.ink}>{r.curJpy > 0 ? format(r.curJpy) : '—'}</PixelText>
                  {diff != null ? (
                    <PixelText variant="ko" size={10} weight="bold" color={diffUp ? UP : DOWN} style={{ marginTop: 2 }}>
                      {`${diffUp ? '▲' : '▼'} ${format(Math.abs(diff))}${r.profitPct != null ? ` (${diffUp ? '+' : '-'}${Math.abs(r.profitPct).toFixed(1)}%)` : ''}`}
                    </PixelText>
                  ) : null}
                </View>
                <View style={{ position: 'absolute', top: '50%', right: -4, transform: [{ translateY: -13 }] }}>
                  <CardMenu menuKey={`item:${r.c.id}`} apparelId={r.c.snkrdunkApparelId} basis={r.c.priceBasis} onRemove={() => onRemove(r.c.id)} onEdit={() => onEdit(r.c)} tc={tc} plain up />
                </View>
              </View>
            );
          })}
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

/* ── ⋯ 메뉴는 화면에 하나만 (웹 CollectionScreen 동일) ───────────────
 * 카드마다 open 상태를 따로 들면 여러 개가 동시에 열린다. 모듈 스코프에
 * '열린 메뉴 키' 하나만 두고 useSyncExternalStore 로 구독한다. */
let openMenuKey: string | null = null;
const menuSubs = new Set<() => void>();
function setOpenMenuKey(k: string | null): void {
  openMenuKey = k;
  menuSubs.forEach((f) => f());
}
function subscribeMenu(f: () => void): () => void {
  menuSubs.add(f);
  return () => { menuSubs.delete(f); };
}
function useMenuOpen(key: string): boolean {
  return useSyncExternalStore(subscribeMenu, () => openMenuKey, () => null) === key;
}

/** 카드 ⋯ 메뉴 — 시세 보기 / 등록 정보 수정 / 묶음 해제 / 컬렉션에서 제거 (웹 CardMenu 동일). */
function CardMenu({ menuKey, apparelId, basis, onRemove, onEdit, onUnbundle, tc, plain = false, up = false }: { menuKey: string; apparelId: number | null; basis?: string | null; onRemove: () => void; onEdit?: () => void; onUnbundle?: () => void; tc: ReturnType<typeof useThemeColors>; plain?: boolean; up?: boolean }) {
  const open = useMenuOpen(menuKey);
  const setOpen = (v: boolean) => setOpenMenuKey(v ? menuKey : null);
  // 화면 아래쪽 행이면 위로 펼친다 — 아래로 열면 하단 탭바 뒤로 들어가 눌리지 않는다.
  const [autoUp, setAutoUp] = useState(false);
  const wrapRef = useRef<View>(null);
  const toggle = () => {
    wrapRef.current?.measureInWindow((_x, y, _w, h) => {
      // 남은 아래 공간(플로팅 탭바 ~90 + 메뉴 ~100) 부족하면 위로.
      setAutoUp(Dimensions.get('window').height - (y + h) < 190);
    });
    setOpenMenuKey(open ? null : menuKey);
  };
  const openUp = up || autoUp;
  return (
    <View ref={wrapRef} style={{ position: 'relative' }}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        style={
          plain
            ? { width: 20, height: 26, alignItems: 'center', justifyContent: 'center' }
            : { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }
        }
      >
        <Text style={{ color: plain ? tc.ink3 : '#fff', fontSize: plain ? 17 : 15, fontWeight: '900', lineHeight: plain ? 18 : 16 }}>⋯</Text>
      </Pressable>
      {/* up: 아래 행에 가려지지 않게 버튼 위로 펼친다(그룹 펼침 목록). */}
      {open ? (
        <View style={{ position: 'absolute', ...(openUp ? { bottom: 28 } : { top: 28 }), right: 0, minWidth: 132, backgroundColor: tc.white, borderColor: tc.pap3, borderWidth: 1, borderRadius: 10, paddingVertical: 4, zIndex: 30, elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
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
          {onEdit ? (
            <Pressable onPress={() => { setOpen(false); onEdit(); }} style={{ paddingVertical: 9, paddingHorizontal: 13 }}>
              <PixelText variant="ko" size={11} weight="bold" color={tc.ink}>등록 정보 수정</PixelText>
            </Pressable>
          ) : null}
          {onUnbundle ? (
            <Pressable onPress={() => { setOpen(false); onUnbundle(); }} style={{ paddingVertical: 9, paddingHorizontal: 13 }}>
              <PixelText variant="ko" size={11} weight="bold" color={tc.ink}>묶음 해제</PixelText>
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
