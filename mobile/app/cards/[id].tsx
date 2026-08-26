import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, View, Pressable, TextInput, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar, ABtn } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { CardThumb } from '@/components/cv/CardThumb';
import { RarBadge } from '@/components/cv/RarBadge';
import { GradeBadge } from '@/components/cv/GradeBadge';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { Seg } from '@/components/cv/Seg';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant, useInputFont } from '@/components/ThemeProvider';
import { cardPrice, displayCardName, fmt, inferCardCurrency, priceLabel, type CardItem } from '@/data/cardvault';
import { updateCard, useCollection } from '@/lib/collection';
import { usePriceMode } from '@/lib/priceMode';
import {
  downsamplePricePoints,
  fetchSnkrdunkApparel,
  fetchSnkrdunkSalesChart,
  fetchSnkrdunkSalesHistory,
  hasPsa10Transactions,
  localizeSnkrdunkText,
  priceDownsampleUnit,
  priceUnitLabelKo,
  recentTransactionMedian,
  recoverSnkrdunkApparelId,
  salesHistoryToPoints,
  snkrdunkApparelUrl,
  type SnkrdunkApparel,
  type SnkrdunkSalesChart,
  type SnkrdunkSalesHistory,
} from '@/services/snkrdunk';
import { SnkrdunkPriceChart, type ChartSeries } from '@/components/cv/SnkrdunkPriceChart';

type Tab = 'info' | 'grade' | 'price' | 'sell';
type GradeResult = {
  centering: number;
  corners: number;
  edges: number;
  surface: number;
  score: number;
};

export default function CardDetail() {
  // 클린·다크는 시스템 산세리프 — 인풋/placeholder 가 비트맵 폰트로 남지 않게.
  const inputFont = useInputFont();
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useCollection();
  const card = collection.find((c) => String(c.id) === String(id)) as CardItem | undefined;
  const [tab, setTab] = useState<Tab>('info');
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  if (!card) {
    return (
      <View style={{ flex: 1, backgroundColor: tc.paper }}>
        <AppBar onBack={() => router.back()} title="카드 없음" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PixelText variant={txt} size={11} color={tc.ink3}>
            카드를 찾을 수 없어요
          </PixelText>
        </View>
      </View>
    );
  }

  const runGrade = () => {
    setAnalyzing(true);
    setTimeout(() => {
      const c = 7 + Math.random() * 3;
      const e = 7 + Math.random() * 3;
      const ed = 7 + Math.random() * 3;
      const s = 7 + Math.random() * 3;
      const avg = (c + e + ed + s) / 4;
      setGradeResult({
        centering: +c.toFixed(1),
        corners: +e.toFixed(1),
        edges: +ed.toFixed(1),
        surface: +s.toFixed(1),
        score: +avg.toFixed(1),
      });
      setAnalyzing(false);
    }, 1800);
  };

  const max = Math.max(...card.trend);
  const min = Math.min(...card.trend);
  const change = card.trend[card.trend.length - 1] - card.trend[0];
  const changePct = Math.round((change / card.trend[0]) * 100);

  // Snkrdunk live fetch. We refresh apparel + history + chart on every 시세
  // tab open so the user always sees the latest market state, not whatever
  // was cached when they added the card. For legacy cards saved before we
  // persisted snkrdunkApparelId, recover it via a one-shot name+num search
  // when the card has snkrdunk-like signals (URL / name pattern).
  const storedApparelId = card.snkrdunkApparelId;
  const [resolvedApparelId, setResolvedApparelId] = useState<number | null>(
    storedApparelId ?? null,
  );
  const [snkrApparel, setSnkrApparel] = useState<SnkrdunkApparel | null>(null);
  const [snkrHistory, setSnkrHistory] = useState<SnkrdunkSalesHistory | null>(null);
  const [snkrChart, setSnkrChart] = useState<SnkrdunkSalesChart | null>(null);
  const [snkrLoading, setSnkrLoading] = useState(false);

  const looksLikeSnkrdunk =
    Boolean(card.snkrdunkApparelId) ||
    Boolean(card.imageUrl && /snkrdunk\.com/i.test(card.imageUrl)) ||
    /\[[A-Za-z]+-P\b|プロモ/.test(card.name ?? '');

  // Recover apparelId for legacy snkrdunk cards via a precise search that
  // requires both setCode + cardNumber in the result title — otherwise we
  // risk overwriting the card's price with a wildly different sibling
  // print's price.
  useEffect(() => {
    if (storedApparelId) return; // already known
    if (!looksLikeSnkrdunk) return;
    let alive = true;
    (async () => {
      const apparelId = await recoverSnkrdunkApparelId({
        name: card.name,
        set: card.set,
        num: card.num,
        imageUrl: card.imageUrl,
      });
      if (alive && apparelId) setResolvedApparelId(apparelId);
    })();
    return () => { alive = false; };
  }, [storedApparelId, looksLikeSnkrdunk, card.name, card.set, card.num, card.imageUrl]);

  const apparelId = resolvedApparelId;

  useEffect(() => {
    if (!apparelId) return;
    let alive = true;
    setSnkrLoading(true);
    (async () => {
      const [a, h, c] = await Promise.all([
        fetchSnkrdunkApparel(apparelId),
        fetchSnkrdunkSalesHistory(apparelId),
        fetchSnkrdunkSalesChart(apparelId),
      ]);
      if (!alive) return;
      setSnkrApparel(a);
      setSnkrHistory(h);
      setSnkrChart(c);
      setSnkrLoading(false);
    })();
    return () => { alive = false; };
  }, [apparelId]);

  // Live medians per market segment — singles (raw / un-graded) is the
  // default, PSA10 is opt-in via the global toggle. The toggle itself only
  // appears for cards that actually have a PSA10 sale on record (packs /
  // boxes never do, so the control would be useless there).
  const liveSingle = recentTransactionMedian(snkrHistory, 'single');
  const livePsa10 = recentTransactionMedian(snkrHistory, 'psa10');
  const liveMin = snkrApparel?.minPrice ?? null;
  const hasPsa10 = hasPsa10Transactions(snkrHistory);
  const { mode: globalPriceMode, setMode: setPriceMode, toggle: togglePriceMode } = usePriceMode();
  // Force singles when this card has no PSA10 data — don't show garbage if
  // user toggled PSA10 on another card and lands here.
  const priceMode = hasPsa10 ? globalPriceMode : 'single';
  const livePicked = priceMode === 'psa10' ? livePsa10 : liveSingle;
  const liveJpy = livePicked ?? liveMin ?? null;
  const storedCurrency = inferCardCurrency(card);
  const displayPrice = liveJpy && liveJpy > 0
    ? priceLabel(liveJpy, 'JPY')
    : priceLabel(cardPrice(card, priceMode), storedCurrency);
  const displayName = displayCardName(card.name);

  // Build the two chart series from sales-history. Snkrdunk's
  // sales-chart endpoint is empty for many newer cards, so deriving
  // [timestamp, price] from history gives us a chart even there.
  const singleSeriesPoints = salesHistoryToPoints(snkrHistory, 'single');
  const psa10SeriesPoints = salesHistoryToPoints(snkrHistory, 'psa10');
  const chartSeries: ChartSeries[] = [];
  if (singleSeriesPoints.length >= 2) {
    chartSeries.push({ label: '싱글', color: tc.red, points: singleSeriesPoints });
  }
  if (psa10SeriesPoints.length >= 2 && hasPsa10) {
    chartSeries.push({ label: 'PSA10', color: tc.gold, points: psa10SeriesPoints });
  }

  // Sync both segment prices back to the collection so the home portfolio
  // can switch between singles and PSA10 totals without re-fetching, and
  // `card.price` (legacy field) mirrors the singles price so views that
  // don't know about the toggle stay correct by default.
  useEffect(() => {
    if (!card || !apparelId) return;
    const singleP = liveSingle ?? liveMin ?? 0;
    const psa10P = livePsa10 ?? 0;
    if (singleP <= 0 && psa10P <= 0) return;
    const needsUpdate =
      (singleP > 0 && card.priceSingle !== singleP) ||
      (psa10P > 0 && card.pricePsa10 !== psa10P) ||
      card.priceCurrency !== 'JPY' ||
      card.snkrdunkApparelId !== apparelId;
    if (!needsUpdate) return;
    const patch: Partial<CardItem> = {
      priceCurrency: 'JPY',
      snkrdunkApparelId: apparelId,
    };
    if (singleP > 0) {
      patch.priceSingle = singleP;
      patch.price = singleP;
      patch.trend = [singleP];
    }
    if (psa10P > 0) patch.pricePsa10 = psa10P;
    updateCard(card.id, patch);
  }, [card, apparelId, liveSingle, livePsa10, liveMin]);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title={displayName} right={<ABtn>🏷</ABtn>} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 40 }}>
        {/* Hero card image — portrait aspect ratio (63/88) so the card art
            isn't cropped top/bottom. Snkrdunk's bg-removed artwork already
            has roughly card-shaped framing, so cover mode lets it fill the
            frame edge-to-edge with no letterbox padding. Border is thin (2px)
            so the frame doesn't eat into the image either. */}
        <View style={{ alignItems: 'center', marginBottom: 4 }}>
          <View style={{ width: '60%', maxWidth: 240 }}>
            <ThumbImage
              uri={card.imageUrl}
              bg={tc.pap3}
              borderColor={tc.ink}
              emoji={card.emoji || '🃏'}
              emojiSize={64}
              style={{ width: '100%', aspectRatio: 63 / 88 }}
            >
              {card.grade ? (
                <View style={{ position: 'absolute', top: 6, right: 6 }}>
                  <GradeBadge g={card.grade} />
                </View>
              ) : null}
              <View style={{ position: 'absolute', top: 6, left: 6 }}>
                <RarBadge rar={card.rar} />
              </View>
            </ThumbImage>
          </View>
        </View>

        {/* Quick info chips */}
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            marginHorizontal: 14,
            marginTop: 14,
            marginBottom: 12,
          }}
        >
          {[
            ['세트', card.set],
            ['번호', card.num],
            ['게임', card.game],
          ].map(([l, v]) => (
            <View
              key={l}
              style={{
                flex: 1,
                backgroundColor: tc.white,
                paddingHorizontal: 8,
                paddingVertical: 9,
                alignItems: 'center',
                borderColor: tc.ink,
                borderWidth: 2,
              }}
            >
              <PixelText variant={txt} size={8} color={tc.ink3} style={{ marginBottom: 4 }}>
                {l}
              </PixelText>
              <PixelText variant={txt} size={9} numberOfLines={1} style={{ textAlign: 'center', lineHeight: 14 }}>
                {v}
              </PixelText>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={{ marginHorizontal: 14, marginBottom: 14 }}>
          <Seg
            value={tab}
            onChange={(t) => setTab(t)}
            tabs={[
              { id: 'info', label: '정보' },
              { id: 'grade', label: '그레이딩' },
              { id: 'price', label: '시세' },
              { id: 'sell', label: '판매' },
            ]}
            size={9}
          />
        </View>

        {tab === 'info' && (
          <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
            {[
              ['카드명', displayName],
              ['세트', card.set],
              ['번호', card.num],
              ['게임', card.game],
              ['희귀도', card.rar],
              ['등급', card.grade ? `PSA ${card.grade}` : '미그레이딩'],
              ['현재 시세', displayPrice],
            ].map(([l, v], i) => (
              <View
                key={l}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 11,
                  borderBottomWidth: 2,
                  borderBottomColor: tc.pap3,
                }}
              >
                <PixelText variant={txt} size={10} color={tc.ink3}>
                  {l}
                </PixelText>
                <PixelText variant={txt} size={10}>
                  {v}
                </PixelText>
              </View>
            ))}
          </View>
        )}

        {tab === 'grade' && (
          <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
            <PixelFrame bg={tc.pap2} borderWidth={3}>
            <View style={{ padding: 14 }}>
              <PixelText variant={txt} size={11} style={{ marginBottom: 8, letterSpacing: 0.5 }}>
                📷 AI 모의 그레이딩
              </PixelText>
              <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginBottom: 12, lineHeight: 18 }}>
                카드 상태를 AI가 센터링·코너·엣지·표면 4항목으로 PSA 점수를 예측합니다
              </PixelText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <PixelPress wrapStyle={{ flex: 1 }}>
                  <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                    <PixelText variant={txt} size={10}>
                      📷 사진 촬영
                    </PixelText>
                  </View>
                </PixelPress>
                <PixelPress
                  wrapStyle={{ flex: 1 }}
                  onPress={runGrade}
                  disabled={analyzing}
                  bg={tc.gold}
                  hi={tc.goldLt}
                  lo={tc.goldDk}
                >
                  <View style={{ paddingVertical: 10, alignItems: 'center', opacity: analyzing ? 0.6 : 1 }}>
                    <PixelText variant={txt} size={10}>
                      {analyzing ? '분석 중...' : '▶ 분석 시작'}
                    </PixelText>
                  </View>
                </PixelPress>
              </View>
            </View>
            </PixelFrame>
            {analyzing ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <PixelText variant={txt} size={11} color={tc.ink3} style={{ lineHeight: 22, textAlign: 'center' }}>
                  AI 분석 중...{`\n`}잠시만 기다려주세요 🔍
                </PixelText>
              </View>
            ) : null}
            {gradeResult ? (
              <>
                <View style={{ marginTop: 12, marginBottom: 12 }}>
                <PixelFrame
                  bg={tc.ink2}
                  borderWidth={4}
                  shadow={6}
                  hi="rgba(255,255,255,0.1)"
                  lo="rgba(0,0,0,0.4)"
                  inner={4}
                >
                <View style={{ padding: 16 }}>
                  <PixelText
                    variant={txt}
                    size={42}
                    color={tc.gold}
                    style={{ textAlign: 'center', letterSpacing: -2, marginBottom: 4 }}
                  >
                    {gradeResult.score}
                  </PixelText>
                  <PixelText
                    variant={txt}
                    size={11}
                    color="rgba(255,255,255,0.6)"
                    style={{ textAlign: 'center', letterSpacing: 1, marginBottom: 14 }}
                  >
                    {gradeResult.score >= 9.5
                      ? 'PSA 10 ★ 잠재'
                      : gradeResult.score >= 8.5
                        ? 'PSA 9 우수'
                        : gradeResult.score >= 7.5
                          ? 'PSA 8 양호'
                          : 'PSA 7 이하'}
                  </PixelText>
                  {(
                    [
                      ['센터링', gradeResult.centering, '#22C55E'],
                      ['코너', gradeResult.corners, '#3A5BD9'],
                      ['엣지', gradeResult.edges, '#7C3AED'],
                      ['표면', gradeResult.surface, '#F97316'],
                    ] as const
                  ).map(([nm, val, col]) => (
                    <View
                      key={nm}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}
                    >
                      <PixelText variant={txt} size={10} color="rgba(255,255,255,0.6)" style={{ width: 48 }}>
                        {nm}
                      </PixelText>
                      <View
                        style={{
                          flex: 1,
                          height: 11,
                          backgroundColor: tc.ink,
                          borderColor: tc.ink,
                          borderWidth: 1,
                        }}
                      >
                        <View style={{ width: `${val * 10}%`, height: '100%', backgroundColor: col }} />
                      </View>
                      <PixelText variant={txt} size={10} color={col} style={{ width: 22, textAlign: 'right' }}>
                        {val}
                      </PixelText>
                    </View>
                  ))}
                </View>
                </PixelFrame>
                </View>
                <PixelFrame bg={tc.pap2} borderWidth={2}>
                  <View style={{ padding: 12 }}>
                    <PixelText variant={txt} size={9} color={tc.ink2} style={{ lineHeight: 18 }}>
                      💡 PSA {Math.round(gradeResult.score)} 예상 — 참고용 수치입니다. 공식 그레이딩은 PSA/BGS에 의뢰하세요.
                    </PixelText>
                  </View>
                </PixelFrame>
              </>
            ) : null}
          </View>
        )}

        {tab === 'price' && (
          <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
            {/* Header card — current price + snkrdunk source tag */}
            <PixelFrame
              bg={tc.ink2}
              borderWidth={4}
              shadow={5}
              hi="rgba(255,255,255,0.1)"
              lo="rgba(0,0,0,0.4)"
              inner={3}
            >
              <View style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    {apparelId ? (
                      <View style={{ alignSelf: 'flex-start', backgroundColor: tc.ink, paddingHorizontal: 5, paddingVertical: 2, borderColor: tc.gold, borderWidth: 1, marginBottom: 6 }}>
                        <PixelText variant={txt} size={8} color={tc.gold}>
                          🇯🇵 스니덩크 시세 {snkrLoading ? '· 로딩…' : snkrApparel ? '· LIVE' : '· 오프라인'}
                        </PixelText>
                      </View>
                    ) : null}
                    <PixelText variant={txt} size={20} color={tc.gold}>
                      {displayPrice}
                    </PixelText>
                    {apparelId ? (
                      <PixelText variant={txt} size={9} color="rgba(255,255,255,0.55)" style={{ marginTop: 4 }}>
                        {priceMode === 'psa10' ? 'PSA10 최근 체결가 평균' : '싱글 최근 체결가 평균'} (최근 5건)
                      </PixelText>
                    ) : null}
                    {apparelId && liveMin != null && liveMin > 0 ? (
                      <PixelText variant={txt} size={9} color="rgba(255,255,255,0.45)" style={{ marginTop: 6 }}>
                        최저 매물 ¥{liveMin.toLocaleString('ja-JP')}
                        {snkrApparel?.listingCountText ? ` · ${snkrApparel.listingCountText}건` : ''}
                      </PixelText>
                    ) : null}
                    {!apparelId ? (
                      <PixelText
                        variant={txt}
                        size={11}
                        color={change >= 0 ? tc.grn : tc.red}
                        style={{ marginTop: 6 }}
                      >
                        {change >= 0 ? '▲' : '▼'} {Math.abs(changePct)}% (7일)
                      </PixelText>
                    ) : null}
                  </View>
                  {/* Singles / PSA10 toggle — only when this card has
                      PSA10 sales history. Packs/boxes never do so the
                      control would just be noise. Tapping flips the global
                      mode so home portfolio + every card price flips
                      together. */}
                  {apparelId && hasPsa10 ? (
                    <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start' }}>
                      <Pressable
                        onPress={togglePriceMode}
                        style={{
                          flexDirection: 'row',
                          borderColor: tc.gold,
                          borderWidth: 1,
                          backgroundColor: 'rgba(0,0,0,0.3)',
                        }}
                      >
                        {(['single', 'psa10'] as const).map((m) => (
                          <View
                            key={m}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              backgroundColor: priceMode === m ? tc.gold : 'transparent',
                            }}
                          >
                            <PixelText
                              variant={txt}
                              size={9}
                              color={priceMode === m ? tc.ink : tc.gold}
                            >
                              {m === 'single' ? '싱글' : 'PSA10'}
                            </PixelText>
                          </View>
                        ))}
                      </Pressable>
                    </View>
                  ) : null}
                  {!apparelId ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      <PixelText variant={txt} size={9} color="rgba(255,255,255,0.4)">
                        최고
                      </PixelText>
                      <PixelText variant={txt} size={11} color={tc.gold} style={{ marginTop: 4 }}>
                        {priceLabel(max, storedCurrency)}
                      </PixelText>
                    </View>
                  ) : null}
                </View>

                {/* Legacy trend chart only when no snkrdunk hook exists for
                    the card — keeps old seeded cards working. */}
                {!apparelId ? (
                  <>
                    <View style={{ flexDirection: 'row', height: 60, alignItems: 'flex-end', gap: 4 }}>
                      {card.trend.map((v, i) => {
                        const h = Math.round(((v - min) / (max - min || 1)) * 100 + 20);
                        const isLast = i === card.trend.length - 1;
                        return (
                          <View
                            key={i}
                            style={{
                              flex: 1,
                              minHeight: 4,
                              height: `${h}%`,
                              backgroundColor: isLast ? tc.gold : tc.ink3,
                            }}
                          />
                        );
                      })}
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      {['-6일', '-5일', '-4일', '-3일', '-2일', '어제', '오늘'].map((l) => (
                        <PixelText key={l} variant={txt} size={9} color={tc.pap3}>
                          {l}
                        </PixelText>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            </PixelFrame>

            {/* Price chart — derived from sales-history (snkrdunk's
                sales-chart endpoint is empty for many newer cards). Plots
                singles + PSA10 on the same axes when both are available
                so the user can compare graded vs un-graded at a glance. */}
            {apparelId ? (
              <View style={{ marginTop: 14 }}>
                <PixelText variant={txt} size={11} color={tc.ink} style={{ marginBottom: 8, letterSpacing: 0.5 }}>
                  시세 차트
                  {chartSeries.length > 0
                    ? ` · 거래 ${(snkrHistory?.history.length ?? 0)}건`
                    : ''}
                </PixelText>
                <PixelFrame bg={tc.white}>
                  <View style={{ padding: 12 }}>
                    {snkrLoading && !snkrHistory ? (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <PixelText variant={txt} size={9} color={tc.ink3}>
                          불러오는 중…
                        </PixelText>
                      </View>
                    ) : (
                      <SnkrdunkPriceChart
                        series={chartSeries}
                        unitLabel="거래 단위"
                        rawCount={snkrHistory?.history.length ?? 0}
                      />
                    )}
                  </View>
                </PixelFrame>
              </View>
            ) : null}

            {/* Snkrdunk shortcut button — opens the apparel page in browser. */}
            {apparelId ? (
              <View style={{ marginTop: 10 }}>
                <PixelPress onPress={() => Linking.openURL(snkrdunkApparelUrl(apparelId))}>
                  <View style={{ backgroundColor: tc.ink, paddingVertical: 12, alignItems: 'center' }}>
                    <PixelText variant={txt} size={10} color={tc.gold}>
                      🇯🇵 스니덩크에서 보기 ↗
                    </PixelText>
                  </View>
                </PixelPress>
              </View>
            ) : null}

            {/* Recent trades — pulled fresh from snkrdunk. Log-style row:
                [badge] [price] ........ [time]. Newest first (API order). */}
            {apparelId ? (
              <View style={{ marginTop: 14 }}>
                <PixelText variant={txt} size={11} color={tc.ink} style={{ marginBottom: 8, letterSpacing: 0.5 }}>
                  최근 체결내역
                  {snkrHistory ? ` (${snkrHistory.history.length}건)` : ''}
                </PixelText>
                <PixelFrame bg={tc.ink2}>
                  <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, overflow: 'hidden' }}>
                    {snkrLoading ? (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <PixelText variant={txt} size={9} color="rgba(255,255,255,0.55)">
                          불러오는 중…
                        </PixelText>
                      </View>
                    ) : snkrHistory && snkrHistory.history.length > 0 ? (
                      snkrHistory.history.slice(0, 20).map((h, i, arr) => {
                        const date = localizeSnkrdunkText(h.date);
                        const label = localizeSnkrdunkText(h.label);
                        const condition = h.condition;
                        const badge = condition || label || '일반';
                        const isPsa = /PSA\s*\d+/i.test(badge);
                        return (
                          <View
                            key={i}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 6,
                              borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                              borderBottomColor: 'rgba(255,255,255,0.08)',
                            }}
                          >
                            <View
                              style={{
                                minWidth: 56,
                                paddingHorizontal: 5,
                                paddingVertical: 2,
                                backgroundColor: isPsa ? tc.gold : 'rgba(255,255,255,0.12)',
                                borderColor: isPsa ? tc.ink : 'rgba(255,255,255,0.18)',
                                borderWidth: 1,
                                marginRight: 8,
                                alignItems: 'center',
                              }}
                            >
                              <PixelText variant={txt} size={8} color={isPsa ? tc.ink : tc.white}>
                                {badge}
                              </PixelText>
                            </View>
                            <PixelText
                              variant={txt}
                              size={10}
                              color={tc.gold}
                              numberOfLines={1}
                              style={{ flex: 1 }}
                            >
                              ¥{h.price.toLocaleString('ja-JP')}
                            </PixelText>
                            <PixelText variant={txt} size={8} color="rgba(255,255,255,0.55)">
                              {date}
                            </PixelText>
                          </View>
                        );
                      })
                    ) : (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <PixelText variant={txt} size={9} color="rgba(255,255,255,0.55)">
                          체결내역이 없습니다
                        </PixelText>
                      </View>
                    )}
                  </View>
                </PixelFrame>
              </View>
            ) : null}
          </View>
        )}

        {tab === 'sell' && (
          <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
            {/* Recent 5 trades pulled from snkrdunk — sellers reference
                them to pick a fair asking price. */}
            {apparelId ? (
              <View style={{ marginBottom: 14 }}>
                <PixelText variant={txt} size={11} style={{ marginBottom: 8, letterSpacing: 0.5 }}>
                  최근 체결내역 (최근 5건)
                </PixelText>
                <PixelFrame bg={tc.ink2}>
                  <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, overflow: 'hidden' }}>
                    {snkrLoading && !snkrHistory ? (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <PixelText variant={txt} size={9} color="rgba(255,255,255,0.55)">
                          불러오는 중…
                        </PixelText>
                      </View>
                    ) : snkrHistory && snkrHistory.history.length > 0 ? (
                      snkrHistory.history.slice(0, 5).map((h, i, arr) => {
                        const date = localizeSnkrdunkText(h.date);
                        const label = localizeSnkrdunkText(h.label);
                        const condition = h.condition;
                        const badge = condition || label || '일반';
                        const isPsa = /PSA\s*\d+/i.test(badge);
                        return (
                          <View
                            key={i}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 6,
                              borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                              borderBottomColor: 'rgba(255,255,255,0.08)',
                            }}
                          >
                            <View
                              style={{
                                minWidth: 56,
                                paddingHorizontal: 5,
                                paddingVertical: 2,
                                backgroundColor: isPsa ? tc.gold : 'rgba(255,255,255,0.12)',
                                borderColor: isPsa ? tc.ink : 'rgba(255,255,255,0.18)',
                                borderWidth: 1,
                                marginRight: 8,
                                alignItems: 'center',
                              }}
                            >
                              <PixelText variant={txt} size={8} color={isPsa ? tc.ink : tc.white}>
                                {badge}
                              </PixelText>
                            </View>
                            <PixelText
                              variant={txt}
                              size={10}
                              color={tc.gold}
                              numberOfLines={1}
                              style={{ flex: 1 }}
                            >
                              ¥{h.price.toLocaleString('ja-JP')}
                            </PixelText>
                            <PixelText variant={txt} size={8} color="rgba(255,255,255,0.55)">
                              {date}
                            </PixelText>
                          </View>
                        );
                      })
                    ) : (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <PixelText variant={txt} size={9} color="rgba(255,255,255,0.55)">
                          체결내역이 없습니다
                        </PixelText>
                      </View>
                    )}
                  </View>
                </PixelFrame>
              </View>
            ) : null}

            <PixelText variant={txt} size={11} style={{ marginBottom: 8, letterSpacing: 1 }}>
              판매 방식
            </PixelText>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {[
                ['즉시 판매', tc.red, tc.white],
                ['교환', tc.teal, tc.white],
                ['경매', tc.gold, tc.ink],
              ].map(([lb, bg, fg]) => (
                <View
                  key={lb}
                  style={{
                    flex: 1,
                    backgroundColor: bg as string,
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderColor: tc.ink,
                    borderWidth: 2,
                  }}
                >
                  <PixelText variant={txt} size={10} color={fg as string}>
                    {lb}
                  </PixelText>
                </View>
              ))}
            </View>
            <PixelText variant={txt} size={11} style={{ marginBottom: 8, letterSpacing: 1 }}>
              희망 가격
            </PixelText>
            <TextInput
              keyboardType="numeric"
              placeholder={`시세: ${displayPrice}`}
              placeholderTextColor={tc.ink4}
              style={{
                backgroundColor: tc.white,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 17,
                fontFamily: inputFont,
                color: tc.ink,
                borderColor: tc.ink,
                borderWidth: 3,
                marginBottom: 14,
              }}
            />
            <PixelPress
              bg={tc.gold}
              hi={tc.goldLt}
              lo={tc.goldDk}
            >
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <PixelText variant={txt} size={12}>
                  🏷 마켓에 등록하기
                </PixelText>
              </View>
            </PixelPress>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
