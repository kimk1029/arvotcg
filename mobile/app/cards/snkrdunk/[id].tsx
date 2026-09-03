import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { CardActions } from '@/components/CardActions';
import { KreamCompare } from '@/components/cards/KreamCompare';
import { MultiSourceKoPrice } from '@/components/cards/MultiSourceKoPrice';
import { PsaPopPanel } from '@/components/cards/PsaPopPanel';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { SectHd } from '@/components/cv/SectHd';
import { SnkrdunkPriceChart } from '@/components/cv/SnkrdunkPriceChart';
import { useThemeColors, useTheme, useThemeTextVariant } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import {
  downsamplePricePoints,
  fetchSnkrdunkApparel,
  fetchSnkrdunkSalesChart,
  fetchSnkrdunkSalesHistory,
  localizeSnkrdunkText,
  priceDownsampleUnit,
  priceUnitLabelKo,
  SNKRDUNK_FEATURED_CARDS,
  type SnkrdunkApparel,
  type SnkrdunkSalesChart,
  type SnkrdunkSalesHistory,
} from '@/services/snkrdunk';
import { jaToKoCached, jaToKoServer } from '@/lib/cardLang';
import { useCurrency } from '@/components/CurrencyProvider';
import { parseKreamHints } from '../../../../shared/util/kreamMatch';
import {
  defaultGradeKey,
  gradeAggsFromHistory,
  gradeDisplayJpy,
  gradeUplift,
  type SnkrGradeAgg,
} from '../../../../shared/snkrdunkPrice';
import { isGradedSnkrdunkBadge } from '../../../../shared/snkrdunk';
import { shotSetCode, shotSource, shotText } from '@/lib/shotMode';

/* ── 등급 집계 — 정본 shared gradeAggsFromHistory 하나만 쓴다(웹과 동일 표본·통계) ── */
type GradeAgg = SnkrGradeAgg;

const isGradedBadge = (b: string) => isGradedSnkrdunkBadge(b);
/** 거래내역 행의 등급 배지 강조용(웹 동일) — 색만 결정, 시세 계산엔 쓰지 않는다. */
const PSA_ANY_RE = /PSA\s*\d+/i;

function gradePredicate(key: string): (badge: string) => boolean {
  if (key === 'RAW') return (b) => !isGradedBadge(b);
  const n = key.replace(/[^\d]/g, '');
  const re = new RegExp(`PSA\\s*${n}\\b`, 'i');
  return (b) => re.test(b);
}

const GRADE_COLOR: Record<string, (tc: ReturnType<typeof useThemeColors>) => string> = {
  'PSA 10': (tc) => tc.red,
  'PSA 9': (tc) => tc.blu,
  'PSA 8': (tc) => tc.pur,
  RAW: (tc) => tc.grn,
};

/** 등급 카드 고정 높이 — 가로 SV 의 NaN 높이 측정 우회용(명시 높이 필수). */
const GRADE_CARD_H = 208;

const RANGES: Array<{ label: string; days: number }> = [
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '1년', days: 365 },
  { label: '전체', days: 0 },
];

export default function SnkrdunkDetail() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { theme } = useTheme();
  // 모든 가격은 통화 설정(엔/원)을 따른다 — 웹 <Price jpy> 동일 (JPY 원본 → format).
  const { format } = useCurrency();
  const fmtYen = (n: number) => (!n ? '—' : format(n));
  const flat = isFlatTheme(theme);
  const { id, grade } = useLocalSearchParams<{ id: string; grade?: string }>();
  const apparelId = Number(id);
  const seed = SNKRDUNK_FEATURED_CARDS.find((c) => c.apparelId === apparelId);

  const [apparel, setApparel] = useState<SnkrdunkApparel | null>(null);
  const [history, setHistory] = useState<SnkrdunkSalesHistory | null>(null);
  const [chart, setChart] = useState<SnkrdunkSalesChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [gradeKey, setGradeKey] = useState<string | null>(null);
  const [region, setRegion] = useState('일본판');
  const [rangeIdx, setRangeIdx] = useState(4); // 전체

  useEffect(() => {
    if (!Number.isInteger(apparelId) || apparelId <= 0) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const [a, h, c] = await Promise.all([
        fetchSnkrdunkApparel(apparelId),
        fetchSnkrdunkSalesHistory(apparelId),
        fetchSnkrdunkSalesChart(apparelId),
      ]);
      if (!alive) return;
      setApparel(a);
      setHistory(h);
      setChart(c);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [apparelId]);

  // 표시명 일→한 — 서버 공통 엔진(단건). 도착 전엔 캐시/로컬 폴백으로 즉시 표시.
  const originalJp = apparel?.localizedName ?? '';
  const [koNameSrv, setKoNameSrv] = useState<string | null>(null);
  useEffect(() => {
    if (!originalJp) return;
    let alive = true;
    jaToKoServer(originalJp).then((ko) => alive && setKoNameSrv(ko)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [originalJp]);
  const displayNameKo = seed?.shortName
    ? jaToKoCached(seed.shortName)
    : koNameSrv ?? (originalJp ? jaToKoCached(originalJp) : '카드 정보');
  // KREAM 매칭 정확도용 힌트 — 카드명(일/한)·상품번호에서 setCode/번호/등급 추출.
  const kreamHints = useMemo(
    () => parseKreamHints(originalJp, displayNameKo, apparel?.productNumber),
    [originalJp, displayNameKo, apparel?.productNumber],
  );
  const allPoints = chart?.points ?? [];

  const historyList = history?.history ?? [];
  const grades = useMemo<GradeAgg[]>(() => gradeAggsFromHistory(historyList), [historyList]);
  // 목록에서 `?grade=` 로 넘어온 등급이 있으면 그 탭으로 연다 — 목록에 보이던 가격과
  // 상세 첫 화면 가격이 같아진다. 그 등급에 체결이 없으면 기본(최다거래 등급).
  const requestedGrade = grades.find((g) => g.key === grade && g.count > 0)?.key;
  const defaultGrade = requestedGrade ?? defaultGradeKey(grades);
  const effectiveGrade = gradeKey ?? defaultGrade;
  const sel = grades.find((g) => g.key === effectiveGrade) ?? grades[grades.length - 1];
  // 정본 gradeDisplayJpy — 홈 HOT·내 컬렉션 목록가와 같은 통계(최근 체결 중앙값).
  const headlinePrice = gradeDisplayJpy(sel, apparel?.minPrice ?? 0);
  const rawGrade = grades.find((g) => g.key === 'RAW');
  const rawRecent = gradeDisplayJpy(rawGrade, apparel?.minPrice ?? 0);
  // 등급별 투자 수익률 — RAW 평균가 → PSA10 평균가 상승폭 (웹 동일, 정본 shared).
  const uplift = gradeUplift(rawGrade?.avg ?? 0, grades.find((g) => g.key === 'PSA 10')?.avg ?? 0);

  // 등록 팝업의 등급별 등록가 미리보기용 — PSA10/9는 집계 재사용, PSA8은 거래내역에서.
  const gradePrices = useMemo(() => {
    const pick = (key: string) => {
      const g = grades.find((x) => x.key === key);
      return g?.median || g?.avg || 0;
    };
    const psa8 = historyList.find((h) => /PSA\s*8\b/i.test((h.condition || h.label || '').trim()))?.price ?? 0;
    return { single: rawRecent, psa10: pick('PSA 10'), psa9: pick('PSA 9'), psa8 };
  }, [grades, historyList, rawRecent]);

  // 전일/주간 변동 — 전체 차트 기준 (웹과 동일).
  const change = useMemo(() => {
    const pts = [...allPoints].sort((a, b) => a[0] - b[0]);
    if (pts.length < 2) return { prevDiff: 0, prevPct: null as number | null, wkDiff: 0, wkPct: null as number | null };
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const prevDiff = last[1] - prev[1];
    const prevPct = prev[1] > 0 ? (prevDiff / prev[1]) * 100 : null;
    const weekAgoTs = last[0] - 7 * 86_400_000;
    let base = pts[0];
    for (const p of pts) {
      if (p[0] <= weekAgoTs) base = p;
      else break;
    }
    const wkDiff = last[1] - base[1];
    const wkPct = base[1] > 0 ? (wkDiff / base[1]) * 100 : null;
    return { prevDiff, prevPct, wkDiff, wkPct };
  }, [allPoints]);

  // 차트 — 기간 필터 후 다운샘플.
  const chartData = useMemo(() => {
    const pts = [...allPoints].sort((a, b) => a[0] - b[0]);
    const days = RANGES[rangeIdx].days;
    const filtered =
      days > 0 && pts.length > 0 ? pts.filter((p) => p[0] >= pts[pts.length - 1][0] - days * 86_400_000) : pts;
    return downsamplePricePoints(filtered.length >= 2 ? filtered : pts);
  }, [allPoints, rangeIdx]);
  const chartUnit = priceDownsampleUnit(chartData);
  const chartUnitLabel = chartUnit === 'monthly' ? '월 평균' : chartUnit === 'weekly' ? '주 평균' : '거래 단위';
  const chartMore =
    chartUnit === 'raw' ? `최근 ${chartData.length}건` : `${chartData.length}${priceUnitLabelKo(chartUnit)} 평균`;

  // 최근 거래내역 — 선택 등급으로 필터(빈 등급이면 전체).
  const filteredTrades = useMemo(() => {
    const pred = gradePredicate(effectiveGrade);
    const matched = historyList.filter((h) => pred((h.condition || h.label || '').trim()));
    return (matched.length > 0 ? matched : historyList).slice(0, 20);
  }, [historyList, effectiveGrade]);

  // 거래가 있는 등급만 — 거래내역 등급 토글 노출용(PSA10·RAW 등 전환, 웹 동일).
  const tradeGrades = useMemo(() => grades.filter((g) => g.count > 0), [grades]);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="시세 상세" />
      {/* ScrollView 는 데이터 도착 후 마운트 — 항상 마운트해 두고 내용만 갈아끼우면
          Fabric(RN 0.81) 안드로이드가 콘텐츠 높이를 재측정하지 못해 뷰포트 아래
          자식들이 통째로 클리핑되는 버그가 있다(일본판 섹션 미표시 원인).
          정상 동작하는 packs/[code] 와 동일한 조건부 마운트 패턴. */}
      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <PixelText variant={txt} size={10} color={tc.ink3}>불러오는 중...</PixelText>
        </View>
      ) : !apparel ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <PixelText variant={txt} size={10} color={tc.ink3}>상품 정보를 가져오지 못했습니다.</PixelText>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <>
            {/* ── HERO ── */}
            <View style={{ paddingHorizontal: 14 }}>
              <Pressable
                onPress={() => apparel.imageUrl && setZoomOpen(true)}
                style={{ alignItems: 'center', marginBottom: 14 }}
              >
                <View style={{ width: 150, height: 210, backgroundColor: tc.pap2, borderColor: tc.ink, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {apparel.imageUrl ? (
                    <Image source={shotSource(apparel.imageUrl)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 44 }}>🃏</Text>
                  )}
                </View>
              </Pressable>
              <PixelText variant="ko" size={15} weight="bold" color={tc.ink} numberOfLines={2} style={{ textAlign: 'center', lineHeight: 20 }}>
                {displayNameKo}
              </PixelText>
              {originalJp && originalJp !== displayNameKo ? (
                <PixelText variant={txt} size={9} color={tc.ink3} numberOfLines={1} style={{ textAlign: 'center', marginTop: 5 }}>
                  {originalJp}
                </PixelText>
              ) : null}

              {/* 태그 칩 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
                <Chip tc={tc} txt={txt}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tc.red }} />
                  <PixelText variant={txt} size={10} weight="bold" color={tc.ink}>일본판</PixelText>
                </Chip>
                {seed?.category ? (
                  <View style={{ backgroundColor: tc.pur, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <PixelText variant={txt} size={10} weight="bold" color={tc.white}>{seed.category}</PixelText>
                  </View>
                ) : null}
                {apparel.productNumber ? (
                  <Chip tc={tc} txt={txt} muted>
                    <PixelText variant={txt} size={10} color={tc.ink3}>{shotSetCode(apparel.productNumber)}</PixelText>
                  </Chip>
                ) : null}
              </View>

              {/* 가격 박스 */}
              <View style={{ marginTop: 14 }}>
                <PixelFrame bg={tc.white}>
                  <View style={{ padding: 16 }}>
                    {/* 헤드라인 등급 탭 — 목록에서 넘어온 기준이 기본 선택. 바로 옆에서
                        RAW ↔ PSA 10 을 전환할 수 있게(웹 CardDetailView 동일).
                        체결이 있는 등급만 노출한다. */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <PixelText variant={txt} size={11} weight="bold" color={tc.ink3}>
                        최근 체결가{tradeGrades.length > 1 ? '' : ` (${shotText(effectiveGrade)})`}
                      </PixelText>
                      {tradeGrades.length > 1 ? (
                        <View style={{ flexDirection: 'row', gap: 3, backgroundColor: tc.pap2, borderRadius: 999, padding: 3 }}>
                          {tradeGrades.map((g) => {
                            const on = g.key === effectiveGrade;
                            const gc = (GRADE_COLOR[g.key] ?? (() => tc.ink))(tc);
                            return (
                              <Pressable
                                key={g.key}
                                onPress={() => setGradeKey(g.key)}
                                hitSlop={4}
                                style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: on ? gc : 'transparent' }}
                              >
                                <PixelText variant={txt} size={10} weight="bold" color={on ? tc.white : tc.ink3}>
                                  {shotText(g.key)}
                                </PixelText>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                    <PixelText variant={txt} size={26} weight="bold" color={tc.ink} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 5 }}>
                      {fmtYen(headlinePrice)}
                    </PixelText>
                    <View style={{ flexDirection: 'row', gap: 20, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: tc.pap3 }}>
                      <View style={{ flex: 1 }}>
                        <PixelText variant={txt} size={10} color={tc.ink3}>전일 대비</PixelText>
                        <View style={{ marginTop: 5 }}><Delta tc={tc} txt={txt} diff={change.prevDiff} pct={change.prevPct} fmt={fmtYen} /></View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <PixelText variant={txt} size={10} color={tc.ink3}>7일 변동률</PixelText>
                        <View style={{ marginTop: 5 }}><Delta tc={tc} txt={txt} diff={change.wkDiff} pct={change.wkPct} fmt={fmtYen} /></View>
                      </View>
                    </View>
                    <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 12 }}>
                      {`최저매물 ${fmtYen(apparel.minPrice)}`}{apparel.listingCountText ? ` · 매물 ${apparel.listingCountText}건` : ''}
                    </PixelText>
                  </View>
                </PixelFrame>
              </View>
            </View>

            {/* ── 액션 ── */}
            <CardActions
              apparelId={apparelId}
              cardName={displayNameKo || undefined}
              imageUrl={apparel.imageUrl ?? null}
              currentPriceJpy={rawRecent || apparel.minPrice || null}
              gradePrices={gradePrices}
            />

            {/* ── 지역 탭 (일본판 스니덩크 / 한국판 멀티소스) ── */}
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 6, borderBottomWidth: 1, borderBottomColor: tc.pap3 }}>
              {['일본판', '한국판'].map((r) => {
                const ready = true;
                const active = region === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => ready && setRegion(r)}
                    disabled={!ready}
                    style={{ paddingVertical: 9, paddingHorizontal: 8, marginBottom: -1, borderBottomWidth: 2.5, borderBottomColor: active ? tc.ink : 'transparent', opacity: ready ? 1 : 0.5, flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  >
                    <PixelText variant={txt} size={13} weight={active ? 'bold' : 'normal'} color={active ? tc.ink : tc.ink3}>{r}</PixelText>
                  </Pressable>
                );
              })}
            </View>

            {/* ── 한국판 — 멀티소스 체결/판매가 (코드+번호+등급 매칭, 웹 동일) ── */}
            {region === '한국판' ? (
              <MultiSourceKoPrice
                name={displayNameKo}
                setCode={kreamHints.setCode}
                cardNumber={kreamHints.cardNumber}
                rarity={kreamHints.rarity}
              />
            ) : null}

            {region === '일본판' ? (
            <>
            {/* ── 등급 카드 (가로 스크롤, 웹 동일 카드폭 176) —
                RN 0.81 Fabric 은 이 화면의 가로 SV 콘텐츠 높이를 NaN 으로 측정해
                이후 섹션이 전부 사라진다. SV 에 명시적 height 를 줘 측정을 우회. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ height: GRADE_CARD_H + 28 }}
              contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 14, gap: 12 }}
            >
              {grades.map((g) => {
                const isSel = g.key === effectiveGrade;
                const gc = (GRADE_COLOR[g.key] ?? (() => tc.ink))(tc);
                return (
                  <Pressable key={g.key} onPress={() => setGradeKey(g.key)} style={{ width: 176, height: GRADE_CARD_H }}>
                    <PixelFrame bg={tc.white} border={isSel ? gc : tc.pap3} borderWidth={isSel ? 3 : 2}>
                      <View style={{ padding: 14 }}>
                        <View style={{ alignSelf: 'flex-start', backgroundColor: gc, paddingHorizontal: 9, paddingVertical: 4 }}>
                          <PixelText variant={txt} size={10} weight="bold" color={tc.white}>{shotText(g.key)}</PixelText>
                        </View>
                        {/* adjustsFontSizeToFit 금지 — 가로 ScrollView(무한폭 측정) 안에서 RN 0.81
                            Android 레이아웃이 폭주해 섹션 전체가 빈 공간이 되는 원인이었음. */}
                        <PixelText variant={txt} size={16} weight="bold" color={tc.ink} numberOfLines={1} style={{ marginTop: 10 }}>{fmtYen(g.median)}</PixelText>
                        <View style={{ marginTop: 11, gap: 8 }}>
                          <GradeRow tc={tc} txt={txt} label="최근 체결" value={fmtYen(g.recent)} />
                          <GradeRow tc={tc} txt={txt} label="평균가" value={fmtYen(g.avg)} />
                          <GradeRow tc={tc} txt={txt} label="최근 최저" value={fmtYen(g.low)} />
                          <GradeRow tc={tc} txt={txt} label="거래 건수" value={g.count > 0 ? `${g.count}건` : '—'} />
                          <GradeRow tc={tc} txt={txt} label="최저매물" value={g.key === 'RAW' ? fmtYen(apparel.minPrice) : '—'} />
                        </View>
                      </View>
                    </PixelFrame>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* ── PSA 인구 리포트 (등급별 pop — cert 1회 등록 후 공유, 웹 동일) ── */}
            <PsaPopPanel setCode={kreamHints.setCode} cardNumber={kreamHints.cardNumber} />

            {/* ── 시세 비교 (SNKRDUNK vs 크림) ── */}
            <KreamCompare
              query={displayNameKo}
              snkrPriceJpy={rawRecent}
              cardNumber={kreamHints.cardNumber}
              setCode={kreamHints.setCode}
              rarity={kreamHints.rarity}
            />

            {/* ── 가격 추이 (기간 탭) ── */}
            <View style={{ marginHorizontal: 14 }}>
              <SectHd title="가격 추이" more={chartMore} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 6, marginBottom: 10 }}>
              {RANGES.map((r, i) => {
                const active = i === rangeIdx;
                return (
                  <Pressable key={r.label} onPress={() => setRangeIdx(i)} style={{ paddingVertical: 7, paddingHorizontal: 14, backgroundColor: active ? tc.ink : tc.pap2 }}>
                    <PixelText variant={txt} size={11} weight="bold" color={active ? tc.white : tc.ink3}>{r.label}</PixelText>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
              <PixelFrame bg={tc.white}>
                <View style={{ padding: 14 }}>
                  <SnkrdunkPriceChart points={chartData} unitLabel={chartUnitLabel} rawCount={allPoints.length} />
                </View>
              </PixelFrame>
            </View>

            {/* ── 최근 거래 내역 (등급 전환) ── */}
            <View style={{ marginHorizontal: 14 }}>
              <SectHd title="최근 거래 내역" more={`${filteredTrades.length}건`} />
            </View>
            {/* 등급 토글 — 거래가 있는 등급(PSA10/RAW 등)만 노출, 바꿔서 볼 수 있게 (웹 동일). */}
            {tradeGrades.length > 1 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 6, marginBottom: 10 }}>
                {tradeGrades.map((g) => {
                  const active = g.key === effectiveGrade;
                  const gc = (GRADE_COLOR[g.key] ?? (() => tc.ink))(tc);
                  return (
                    <Pressable
                      key={g.key}
                      onPress={() => setGradeKey(g.key)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 13,
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: active ? gc : tc.pap3,
                        backgroundColor: active ? gc : 'transparent',
                      }}
                    >
                      <PixelText variant={txt} size={11} weight="bold" color={active ? tc.white : tc.ink3}>
                        {shotText(g.key)} · {g.count}건
                      </PixelText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
              <PixelFrame bg={flat ? tc.white : tc.ink2}>
                <View style={{ paddingHorizontal: flat ? 14 : 10, paddingTop: 8, paddingBottom: 10, overflow: 'hidden' }}>
                  {filteredTrades.length > 0 ? (
                    filteredTrades.map((h, i, arr) => {
                      const date = localizeSnkrdunkText(h.date);
                      const badge = h.condition || localizeSnkrdunkText(h.label) || '일반';
                      const isPsa = PSA_ANY_RE.test(badge);
                      const divider = flat ? tc.pap3 : 'rgba(255,255,255,0.08)';
                      // 플랫(클린·다크): 흰 패널 + 웹 행 스타일 / 픽셀: 다크 로그 스타일.
                      const badgeBg = flat ? tc.pap2 : isPsa ? tc.gold : 'rgba(255,255,255,0.12)';
                      const badgeFg = flat ? (isPsa ? tc.goldDk : tc.ink3) : isPsa ? tc.ink : tc.white;
                      const priceColor = flat ? (i === 0 ? tc.red : tc.ink) : i === 0 ? tc.goldLt : tc.gold;
                      const dateColor = flat ? tc.ink3 : 'rgba(255,255,255,0.55)';
                      return (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: flat ? 9 : 6, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: divider }}>
                          <View style={{ minWidth: 56, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: badgeBg, borderColor: flat ? 'transparent' : isPsa ? tc.ink : 'rgba(255,255,255,0.18)', borderWidth: flat ? 0 : 1, marginRight: 8, alignItems: 'center' }}>
                            <PixelText variant={txt} size={8} weight={flat ? 'bold' : 'normal'} color={badgeFg}>{badge}</PixelText>
                          </View>
                          <PixelText variant={txt} size={flat ? 13 : 10} weight={flat ? 'bold' : 'normal'} color={priceColor} numberOfLines={1} style={{ flex: 1 }}>{fmtYen(h.price)}</PixelText>
                          <PixelText variant={txt} size={flat ? 10 : 8} color={dateColor}>{date}</PixelText>
                        </View>
                      );
                    })
                  ) : (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <PixelText variant={txt} size={9} color={flat ? tc.ink3 : 'rgba(255,255,255,0.55)'}>거래내역이 없습니다</PixelText>
                    </View>
                  )}
                </View>
              </PixelFrame>
            </View>

            {/* ── 등급별 투자 수익률 — RAW 평균가 → PSA10 평균가 상승폭 (웹 동일, 정본 shared gradeUplift) ── */}
            <View style={{ marginHorizontal: 14 }}>
              <SectHd title="등급별 투자 수익률" more="RAW → PSA 10" />
            </View>
            <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
              <PixelFrame bg={tc.white}>
                <View style={{ padding: 16 }}>
                  {uplift ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10 }}>
                        <View style={{ flex: 1, backgroundColor: tc.pap2, borderRadius: flat ? 10 : 0, paddingHorizontal: 12, paddingVertical: 10 }}>
                          <PixelText variant={txt} size={9} weight="bold" color={tc.ink3}>RAW 평균가</PixelText>
                          <PixelText variant={txt} size={14} weight="bold" color={tc.ink} numberOfLines={1} style={{ marginTop: 5 }}>{fmtYen(uplift.rawAvg)}</PixelText>
                        </View>
                        <PixelText variant={txt} size={14} color={tc.ink3} style={{ alignSelf: 'center' }}>→</PixelText>
                        <View style={{ flex: 1, backgroundColor: tc.goldSoft, borderRadius: flat ? 10 : 0, paddingHorizontal: 12, paddingVertical: 10 }}>
                          <PixelText variant={txt} size={9} weight="bold" color={tc.goldDk}>PSA 10 평균가</PixelText>
                          <PixelText variant={txt} size={14} weight="bold" color={tc.ink} numberOfLines={1} style={{ marginTop: 5 }}>{fmtYen(uplift.psa10Avg)}</PixelText>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
                        <PixelText variant={txt} size={10} color={tc.ink3}>그레이딩 상승폭</PixelText>
                        <PixelText variant={txt} size={15} weight="bold" color={uplift.diff >= 0 ? tc.red : tc.blu} numberOfLines={1} style={{ flexShrink: 1 }}>
                          {uplift.diff >= 0 ? '+' : '−'}{fmtYen(Math.abs(uplift.diff))} ({uplift.diff >= 0 ? '+' : ''}{uplift.pct.toFixed(1)}%)
                        </PixelText>
                      </View>
                      <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 8, lineHeight: 14 }}>
                        최근 거래 평균 기준 단순 시세차 — 그레이딩 비용·수수료·기간은 반영되지 않아요.
                      </PixelText>
                    </>
                  ) : (
                    <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                      <PixelText variant={txt} size={10} color={tc.ink3}>RAW·PSA 10 거래 데이터가 모두 있어야 계산할 수 있어요</PixelText>
                    </View>
                  )}
                </View>
              </PixelFrame>
            </View>

            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <PixelText variant={txt} size={8} color={tc.ink3}>데이터 출처: snkrdunk.com (10분 캐시)</PixelText>
            </View>
            </>
            ) : null}
          </>
        </ScrollView>
      )}

      <Modal visible={zoomOpen} transparent animationType="fade" onRequestClose={() => setZoomOpen(false)}>
        <Pressable onPress={() => setZoomOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          {apparel?.imageUrl ? (
            <Image source={shotSource(apparel.imageUrl)} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
          ) : null}
          <View style={{ position: 'absolute', top: 40, right: 20, backgroundColor: tc.ink, paddingHorizontal: 10, paddingVertical: 6, borderColor: tc.gold, borderWidth: 2 }}>
            <PixelText variant={txt} size={11} color={tc.gold}>✕ 닫기</PixelText>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Chip({ tc, txt, children, muted }: { tc: ReturnType<typeof useThemeColors>; txt: 'pixel' | 'ko'; children: React.ReactNode; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: tc.pap2, paddingHorizontal: 11, paddingVertical: 6 }}>
      {children}
    </View>
  );
}

function GradeRow({ tc, txt, label, value }: { tc: ReturnType<typeof useThemeColors>; txt: 'pixel' | 'ko'; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
      <PixelText variant={txt} size={10} color={tc.ink3} numberOfLines={1}>{label}</PixelText>
      <PixelText variant={txt} size={11} weight="bold" color={tc.ink} numberOfLines={1} style={{ flexShrink: 1 }}>{value}</PixelText>
    </View>
  );
}

function Delta({ tc, txt, diff, pct, fmt }: { tc: ReturnType<typeof useThemeColors>; txt: 'pixel' | 'ko'; diff: number; pct: number | null; fmt: (n: number) => string }) {
  if (pct == null) return <PixelText variant={txt} size={13} weight="bold" color={tc.ink3}>—</PixelText>;
  const up = diff >= 0;
  return (
    <PixelText variant={txt} size={13} weight="bold" color={up ? tc.red : tc.blu}>
      {up ? '+' : '−'} {fmt(Math.abs(diff))} ({up ? '+' : ''}{pct.toFixed(2)}%)
    </PixelText>
  );
}
