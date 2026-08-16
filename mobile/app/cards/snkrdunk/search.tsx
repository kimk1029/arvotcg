import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { TranslationTicker } from '@/components/TranslationTicker';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { EmptyState } from '@/components/cv/ListState';
import { MarketListRow } from '@/components/cv/MarketListRow';
import { colors } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import {
  fetchSnkrdunkApparel,
  searchSnkrdunkByQuery,
  type SnkrdunkApparel,
  type SnkrdunkSearchResult,
} from '@/services/snkrdunk';
import {
  bunjangSearchUrl,
  fetchBunjangItems,
  fetchKreamItems,
  type BunjangItem,
  type KreamItem,
} from '@/services/marketplace';
import { jaToKoBatch, koToJaServer } from '@/lib/cardLang';
import { api } from '@/lib/apiClient';
import { fetchEbaySnapshot, type EbaySearchResp } from '@/services/ebay';
import { searchByIllustrator, type IllustratorSearchResp } from '@/services/illustrator';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { translate } from '../../../../shared/cardTranslate';

type Category = 'snkrdunk' | 'bunjang' | 'kream' | 'ebay';
type SearchMode = 'card' | 'illustrator';

function kreamSearchUrl(q: string): string {
  return `https://kream.co.kr/search?keyword=${encodeURIComponent(q)}`;
}

interface Hit {
  apparelId: number;
  koName: string;
  jpName: string;
  imageUrl: string | null;
  minPrice: number;
  listingCountText: string;
}

async function hydrate(results: SnkrdunkSearchResult[]): Promise<Hit[]> {
  const rows = await Promise.all(
    results.map(async (r) => {
      const apparel: SnkrdunkApparel | null = await fetchSnkrdunkApparel(r.apparelId);
      const jpName = apparel?.localizedName || apparel?.name || r.name;
      return {
        apparelId: r.apparelId,
        koName: jpName, // 아래에서 서버 배치 번역으로 치환
        jpName,
        imageUrl: apparel?.imageUrl ?? r.imageUrl,
        minPrice: apparel?.minPrice ?? 0,
        listingCountText: apparel?.listingCountText ?? '',
      };
    }),
  );
  // 일→한 표시명 — 서버 공통 엔진(/api/card-lang/ja-ko) 배치, 실패 시 로컬 폴백.
  const koMap = await jaToKoBatch(rows.map((r) => r.jpName));
  return rows.map((r) => ({ ...r, koName: koMap.get(r.jpName) || r.jpName }));
}

function fmtYen(n: number): string {
  if (!n) return '—';
  return `¥${n.toLocaleString('ja-JP')}`;
}

export default function SnkrdunkSearchScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = useMemo(() => (params.q ?? '').trim(), [params.q]);
  const [query, setQuery] = useState(initialQuery);
  const [cat, setCat] = useState<Category>('snkrdunk');
  const [mode, setMode] = useState<SearchMode>('card');

  // SNKRDUNK (일본어 변환 검색 + 무한스크롤)
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 번개장터 (한국어 원본 검색)
  const [bunjang, setBunjang] = useState<BunjangItem[]>([]);
  const [bunjangLoading, setBunjangLoading] = useState(false);
  const [bunjangLoaded, setBunjangLoaded] = useState(false);
  const [bunjangError, setBunjangError] = useState<string | null>(null);

  // KREAM (한국어 원본 검색, SSR 스크래핑)
  const [kream, setKream] = useState<KreamItem[]>([]);
  const [kreamLoading, setKreamLoading] = useState(false);
  const [kreamLoaded, setKreamLoaded] = useState(false);

  // eBay (영문 변환 검색 — 웹 /cards/search 카드 모드 패리티)
  const [ebay, setEbay] = useState<EbaySearchResp | null>(null);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayLoaded, setEbayLoaded] = useState(false);

  // 일러스트레이터 모드 (웹 mode=illustrator 패리티)
  const [illu, setIllu] = useState<IllustratorSearchResp | null>(null);
  const [illuLoading, setIlluLoading] = useState(false);
  const [illuError, setIlluError] = useState<string | null>(null);

  // 웹과 동일하게 로컬 공통 엔진으로 영문 쿼리 파생 (eBay 검색용).
  const enQuery = useMemo(() => (initialQuery ? translate(initialQuery, 'en') : ''), [initialQuery]);

  // 한→일 검색어 — 서버 공통 엔진(/api/card-lang/ko-ja). 도착 전엔 null 로 검색 보류.
  const [jaQuery, setJaQuery] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!initialQuery) {
      setJaQuery('');
      return;
    }
    setJaQuery(null);
    koToJaServer(initialQuery).then((ja) => alive && setJaQuery(ja));
    return () => {
      alive = false;
    };
  }, [initialQuery]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);


  // SNKRDUNK 첫 페이지
  useEffect(() => {
    let alive = true;
    setPage(1);
    setHasMore(false);
    if (!initialQuery) {
      setHits([]);
      return;
    }
    if (jaQuery == null) return; // 서버 번역 대기
    setLoading(true);
    setError(null);
    searchSnkrdunkByQuery(jaQuery, 1)
      .then(async (raw) => ({ rows: await hydrate(raw), more: raw.length > 0 }))
      .then(({ rows, more }) => {
        if (!alive) return;
        setHits(rows);
        setHasMore(more);
        // 검색 로그(한국어 키워드 + snkrdunk 결과 수). 실패는 무시 — 검색 UX 영향 없음.
        api('/api/search-log', {
          method: 'POST',
          body: { query: initialQuery, resultCount: rows.length, source: 'mobile' },
        }).catch(() => undefined);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : '검색 실패');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initialQuery, jaQuery]);

  // 번개장터 — 검색 시 즉시 로딩(다른 탭에 있어도 탭에 건수 표시). 한국어 원본 쿼리.
  // 주의: loading 을 deps 에 넣지 말 것 — setLoading 으로 effect 가 재실행되며 cleanup 이
  // 진행 중 fetch 를 취소해 무한 로딩이 됐던 버그.
  useEffect(() => {
    if (!initialQuery) {
      setBunjang([]);
      setBunjangLoaded(false);
      setBunjangError(null);
      return;
    }
    let alive = true;
    setBunjang([]);
    setBunjangLoaded(false);
    setBunjangError(null);
    setBunjangLoading(true);
    fetchBunjangItems(initialQuery, 0)
      .then((items) => {
        if (!alive) return;
        setBunjang(items);
        setBunjangLoaded(true);
      })
      .catch((e) => {
        if (alive) setBunjangError(e instanceof Error ? e.message : '불러오기 실패');
      })
      .finally(() => {
        if (alive) setBunjangLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initialQuery]);

  // 쿼리 변경 시 KREAM 캐시 리셋 (탭 다시 열면 새 쿼리로 로딩).
  useEffect(() => {
    setKream([]);
    setKreamLoaded(false);
  }, [initialQuery]);

  // KREAM — 탭을 열 때만 1회 로딩 (안티봇이 IP를 막아, 매 검색마다 호출하면 대부분 차단됨).
  // 차단/실패 시 빈 배열 → 이동 버튼 폴백. (loading 은 deps 에 넣지 않음 — orphan 방지)
  useEffect(() => {
    if (cat !== 'kream' || !initialQuery || kreamLoaded || kreamLoading) return;
    let alive = true;
    setKreamLoading(true);
    fetchKreamItems(initialQuery)
      .then((items) => {
        if (!alive) return;
        setKream(items);
        setKreamLoaded(true);
      })
      .catch(() => {
        if (alive) setKreamLoaded(true);
      })
      .finally(() => {
        if (alive) setKreamLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, initialQuery, kreamLoaded]);

  // 쿼리 변경 시 eBay 캐시 리셋.
  useEffect(() => {
    setEbay(null);
    setEbayLoaded(false);
  }, [initialQuery]);

  // eBay — 탭을 열 때만 1회 로딩 (API 쿼터 절약). 실패 시 미설정과 동일한 안내.
  useEffect(() => {
    if (cat !== 'ebay' || mode !== 'card' || !enQuery || ebayLoaded || ebayLoading) return;
    let alive = true;
    setEbayLoading(true);
    fetchEbaySnapshot(enQuery)
      .then((r) => {
        if (!alive) return;
        setEbay(r);
        setEbayLoaded(true);
      })
      .catch(() => {
        if (alive) setEbayLoaded(true);
      })
      .finally(() => {
        if (alive) setEbayLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, mode, enQuery, ebayLoaded]);

  // 일러스트레이터 — 모드 진입 + 쿼리 변경 시 조회.
  useEffect(() => {
    if (mode !== 'illustrator' || !initialQuery) {
      setIllu(null);
      setIlluError(null);
      return;
    }
    let alive = true;
    setIllu(null);
    setIlluError(null);
    setIlluLoading(true);
    searchByIllustrator(initialQuery)
      .then((r) => {
        if (alive) setIllu(r);
      })
      .catch((e) => {
        if (alive) setIlluError(e instanceof Error ? e.message : '검색 실패');
      })
      .finally(() => {
        if (alive) setIlluLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, initialQuery]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore || !jaQuery) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const raw = await searchSnkrdunkByQuery(jaQuery, next);
      const rows = await hydrate(raw);
      const seen = new Set(hits.map((h) => h.apparelId));
      const fresh = rows.filter((r) => !seen.has(r.apparelId));
      if (fresh.length > 0) setHits((prev) => [...prev, ...fresh]);
      setPage(next);
      setHasMore(fresh.length > 0);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, hasMore, jaQuery, page, hits]);

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    router.setParams({ q });
  };

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar onBack={() => router.back()} title="카드 검색" />
      <TranslationTicker />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 110 }}
        scrollEventThrottle={200}
        onScroll={({ nativeEvent }) => {
          if (mode !== 'card' || cat !== 'snkrdunk') return; // 무한스크롤은 SNKRDUNK 탭만
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) loadMore();
        }}
      >
        <PixelFrame bg={tc.white} borderWidth={3} shadow={5}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
            <PixelText variant={txt} size={12} color={tc.ink3}>🔍</PixelText>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submit}
              returnKeyType="search"
              inputMode="search"
              placeholder="카드 검색 (예: 리자몽)"
              placeholderTextColor={tc.ink4}
              numberOfLines={1}
              style={{
                flex: 1,
                height: 44,
                paddingHorizontal: 8,
                color: tc.ink,
                fontFamily: 'Galmuri11',
                fontSize: 12,
              }}
            />
            <Pressable onPress={submit} style={{ backgroundColor: tc.ink, paddingHorizontal: 10, paddingVertical: 8 }}>
              <PixelText variant={txt} size={8} color={tc.gold}>검색</PixelText>
            </Pressable>
          </View>
        </PixelFrame>

        <View style={{ height: 12 }} />

        {/* 검색 모드 토글 — 웹 /cards/search 의 card/illustrator 모드 패리티 */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ModeTab label="🃏 카드명·코드" active={mode === 'card'} onPress={() => setMode('card')} />
          <ModeTab label="🎨 일러스트레이터" active={mode === 'illustrator'} onPress={() => setMode('illustrator')} />
        </View>

        <View style={{ height: 12 }} />

        {!initialQuery ? (
          mode === 'illustrator' ? (
            <EmptyState icon="🎨" title="일러스트레이터를 검색하세요" desc="예: 아리타 미츠히로, Mitsuhiro Arita" />
          ) : (
            <EmptyState icon="🔍" title="카드를 검색하세요" desc="SNKRDUNK·번개장터·KREAM·eBay 시세를 함께 찾습니다." />
          )
        ) : mode === 'illustrator' ? (
          <IllustratorPanel query={initialQuery} resp={illu} loading={illuLoading} error={illuError} />
        ) : (
          <>
            {/* 카테고리 탭 */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <CatTab
                label="SNKRDUNK"
                sub={hits.length > 0 ? `${hits.length}건${hasMore ? '+' : ''}` : '시세'}
                loading={loading}
                active={cat === 'snkrdunk'}
                onPress={() => setCat('snkrdunk')}
              />
              <CatTab
                label="번개장터"
                sub={bunjangLoaded ? `${bunjang.length}건` : '국내매물'}
                loading={bunjangLoading}
                active={cat === 'bunjang'}
                onPress={() => setCat('bunjang')}
              />
              <CatTab
                label="KREAM"
                sub={kreamLoaded ? `${kream.length}건` : 'KREAM'}
                loading={kreamLoading}
                active={cat === 'kream'}
                onPress={() => setCat('kream')}
              />
              <CatTab
                label="eBay"
                sub={ebayLoaded ? `${ebay?.data?.items?.length ?? 0}건` : '해외'}
                loading={ebayLoading}
                active={cat === 'ebay'}
                onPress={() => setCat('ebay')}
              />
            </View>

            <View style={{ height: 12 }} />

            {/* 유의사항 배너 — 컴팩트 (얇은 소형 텍스트·좁은 행간·요약 문구) */}
            <PixelFrame bg={tc.red} borderWidth={2} shadow={3} hi="rgba(255,255,255,0.18)" lo="rgba(0,0,0,0.36)">
              <View style={{ paddingVertical: 7, paddingHorizontal: 10, flexDirection: 'row', gap: 8 }}>
                <Text style={{ fontSize: 12, lineHeight: 14 }}>📢</Text>
                <PixelText variant="ko" size={9} color="rgba(255,255,255,0.92)" style={{ flex: 1, lineHeight: 13, fontWeight: '400' }}>
                  SNKRDUNK는 한글→일본어 번역 검색이라 일본명이 다른 카드(예: 이슬이→카스미)는 안 나올 수 있어요 — 번개장터 탭에서 국내매물을 확인하세요. 0건 카드는 2~3일 내 검색되도록 업데이트 중이에요.
                </PixelText>
              </View>
            </PixelFrame>

            <View style={{ height: 12 }} />

            {cat === 'snkrdunk' ? (
              loading ? (
                <Spinner />
              ) : error ? (
                <EmptyState icon="!" title="검색 실패" desc={error} />
              ) : hits.length === 0 ? (
                <EmptyState icon="🔍" title="SNKRDUNK 결과가 없습니다" desc={initialQuery} />
              ) : (
                <View style={{ gap: 6 }}>
                  {hits.map((hit) => (
                    <SnkrdunkRow key={hit.apparelId} hit={hit} />
                  ))}
                  {loadingMore ? (
                    <Spinner pad={18} />
                  ) : !hasMore ? (
                    <FooterNote text={`SNKRDUNK ${hits.length}건 · 끝`} />
                  ) : null}
                </View>
              )
            ) : cat === 'bunjang' ? (
              bunjangLoading ? (
                <Spinner />
              ) : bunjangError ? (
                <EmptyState icon="!" title="불러오기 실패" desc={bunjangError} />
              ) : bunjang.length === 0 ? (
                <EmptyState icon="📦" title="번개장터 결과가 없습니다" desc={initialQuery} />
              ) : (
                <View style={{ gap: 6 }}>
                  {bunjang.map((item) => (
                    <BunjangRow key={item.pid} item={item} />
                  ))}
                  <PixelPress
                    onPress={() => Linking.openURL(bunjangSearchUrl(initialQuery))}
                    bg={tc.ink}
                    borderWidth={3}
                    shadow={5}
                    hi={null}
                    lo={null}
                    wrapStyle={{ marginTop: 2 }}
                  >
                    <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                      <PixelText variant={txt} size={9} color={tc.gold}>번개장터에서 더 보기</PixelText>
                    </View>
                  </PixelPress>
                </View>
              )
            ) : cat === 'kream' ? (
              <KreamPanel query={initialQuery} items={kream} loading={kreamLoading} />
            ) : (
              <EbayPanel enQuery={enQuery} resp={ebay} loading={ebayLoading} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CatTab({
  label,
  sub,
  loading,
  active,
  onPress,
}: {
  label: string;
  sub: string;
  loading?: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const fg = active ? tc.gold : tc.ink3;
  return (
    <View style={{ flex: 1 }}>
      <PixelPress
        onPress={onPress}
        bg={active ? tc.ink : tc.white}
        borderWidth={3}
        shadow={active ? 5 : 3}
        hi={null}
        lo={null}
        wrapStyle={{ flex: 1 }}
      >
        <View style={{ paddingVertical: 8, alignItems: 'center', gap: 3 }}>
          <PixelText variant={txt} size={9} color={active ? tc.gold : tc.ink}>
            {label}
          </PixelText>
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 12 }}>
              <ActivityIndicator size="small" color={fg} style={{ transform: [{ scale: 0.55 }] }} />
              <PixelText variant={txt} size={7} color={fg}>
                검색중
              </PixelText>
            </View>
          ) : (
            <PixelText variant={txt} size={7} color={fg}>
              {sub}
            </PixelText>
          )}
        </View>
      </PixelPress>
    </View>
  );
}

function Spinner({ pad = 40 }: { pad?: number }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={{ paddingVertical: pad, alignItems: 'center' }}>
      <ActivityIndicator color={tc.ink} />
    </View>
  );
}

function FooterNote({ text }: { text: string }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
      <PixelText variant={txt} size={8} color={tc.ink3}>
        {text}
      </PixelText>
    </View>
  );
}

function SnkrdunkRow({ hit }: { hit: Hit }) {
  return (
    <MarketListRow
      onPress={() => router.push(`/cards/snkrdunk/${hit.apparelId}` as never)}
      imageUrl={hit.imageUrl}
      title={hit.koName}
      priceText={fmtYen(hit.minPrice)}
      metaText={`${hit.jpName}${hit.listingCountText ? `   매물 ${hit.listingCountText}건` : ''}`}
    />
  );
}

function KreamPanel({ query, items, loading }: { query: string; items: KreamItem[]; loading: boolean }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={{ gap: 6 }}>
      {loading ? (
        <Spinner />
      ) : items.length > 0 ? (
        items.map((item) => <KreamRow key={item.id} item={item} />)
      ) : (
        <PixelFrame bg={tc.white} borderWidth={3} shadow={5}>
          <View style={{ padding: 14 }}>
            <PixelText variant="ko" size={10} color={tc.ink3} style={{ lineHeight: 16 }}>
              KREAM 결과를 불러오지 못했습니다. 아래에서 KREAM 검색을 직접 열 수 있어요.
            </PixelText>
          </View>
        </PixelFrame>
      )}
      {/* KREAM은 차단에 취약해 결과가 비어도 항상 이동 버튼 제공 */}
      <PixelPress
        onPress={() => Linking.openURL(kreamSearchUrl(query))}
        bg={tc.ink}
        borderWidth={3}
        shadow={5}
        hi={null}
        lo={null}
        wrapStyle={{ marginTop: 2 }}
      >
        <View style={{ paddingVertical: 13, alignItems: 'center' }}>
          <PixelText variant="ko" size={10} color={tc.gold}>
            KREAM에서 “{query}” 검색 →
          </PixelText>
        </View>
      </PixelPress>
    </View>
  );
}

function KreamRow({ item }: { item: KreamItem }) {
  return (
    <MarketListRow
      onPress={() => Linking.openURL(item.productUrl)}
      imageUrl={item.imageUrl}
      title={item.name}
      priceText={item.price > 0 ? `${item.price.toLocaleString('ko-KR')}원` : '가격문의'}
      metaText="KREAM"
    />
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  return (
    <View style={{ flex: 1 }}>
      <PixelPress
        onPress={onPress}
        bg={active ? tc.ink : tc.white}
        borderWidth={3}
        shadow={active ? 5 : 3}
        hi={null}
        lo={null}
        wrapStyle={{ flex: 1 }}
      >
        <View style={{ paddingVertical: 9, alignItems: 'center' }}>
          <PixelText variant={txt} size={9} color={active ? tc.gold : tc.ink}>
            {label}
          </PixelText>
        </View>
      </PixelPress>
    </View>
  );
}

/** 웹 fmtMoney 패리티 — USD/JPY/KRW 기호 포맷. */
function fmtMoney(n: number, currency: string): string {
  const rounded = n >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
  const num = rounded.toLocaleString('en-US');
  if (currency === 'USD') return `$${num}`;
  if (currency === 'JPY') return `¥${num}`;
  if (currency === 'KRW') return `${num}₩`;
  return `${num} ${currency}`;
}

function EbayPanel({ enQuery, resp, loading }: { enQuery: string; resp: EbaySearchResp | null; loading: boolean }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  if (loading) return <Spinner />;
  if (!resp || !resp.configured) {
    return <EmptyState icon="🌎" title="eBay 시세 미설정" desc="서버에 eBay API 키가 설정되지 않았습니다." />;
  }
  const snap = resp.data;
  if (!snap || snap.sampleN === 0) {
    return <EmptyState icon="🌎" title="eBay 결과가 없습니다" desc={enQuery} />;
  }
  const stats: Array<[string, number]> = [
    ['최저', snap.low],
    ['평균', snap.avg],
    ['중앙', snap.median],
    ['최고', snap.high],
  ];
  return (
    <View style={{ gap: 6 }}>
      {/* 시세 스냅샷 배지 4종 — 웹 eBay 섹션 패리티 */}
      <PixelFrame bg={tc.white} borderWidth={3} shadow={5}>
        <View style={{ padding: 12 }}>
          <PixelText variant={txt} size={8} color={tc.ink3}>
            eBay 시세 · “{enQuery}” · {snap.sampleN}건 기준
          </PixelText>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            {stats.map(([label, v]) => (
              <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, backgroundColor: tc.pap2, borderWidth: 2, borderColor: tc.ink }}>
                <PixelText variant={txt} size={7} color={tc.ink3}>{label}</PixelText>
                <PixelText variant={txt} size={9} color={tc.ink}>{fmtMoney(v, snap.currency)}</PixelText>
              </View>
            ))}
          </View>
        </View>
      </PixelFrame>
      {snap.items.map((item) => (
        <MarketListRow
          key={item.itemId}
          onPress={() => Linking.openURL(item.webUrl)}
          imageUrl={item.thumb ?? null}
          title={item.title}
          priceText={fmtMoney(item.price, item.currency)}
          metaText={`eBay · ${snap.marketplace}`}
        />
      ))}
    </View>
  );
}

function IllustratorPanel({
  query,
  resp,
  loading,
  error,
}: {
  query: string;
  resp: IllustratorSearchResp | null;
  loading: boolean;
  error: string | null;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  if (loading) return <Spinner />;
  if (error) return <EmptyState icon="!" title="검색 실패" desc={error} />;
  if (!resp) return null;
  const cards = resp.cards ?? [];
  return (
    <View style={{ gap: 12 }}>
      {/* 매칭 배너 — 웹 illustrator 모드 패리티 */}
      <PixelFrame bg={tc.white} borderWidth={3} shadow={5}>
        <View style={{ padding: 12, gap: 4 }}>
          <PixelText variant={txt} size={8} color={tc.ink3}>입력: {query}</PixelText>
          {resp.resolvedName ? (
            <PixelText variant="ko" size={11} color={tc.ink}>
              🎨 {resp.resolvedName}
            </PixelText>
          ) : null}
          <PixelText variant="ko" size={10} color={tc.ink3}>
            {resp.matched
              ? `${resp.matched.en}${resp.matched.ja ? ` · ${resp.matched.ja}` : ''}`
              : '사전 미등록 — 입력한 이름 그대로 검색했어요.'}
          </PixelText>
        </View>
      </PixelFrame>
      {cards.length === 0 ? (
        <EmptyState icon="🎨" title="일러스트 카드가 없습니다" desc={resp.message || query} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cards.map((c) => (
            <View key={c.id} style={{ width: '31.5%' }}>
              <PixelFrame bg={tc.white} borderWidth={2} shadow={3}>
                <View style={{ padding: 6, gap: 5 }}>
                  <ThumbImage
                    uri={c.imageSmall || c.imageLarge || null}
                    style={{ width: '100%', aspectRatio: 63 / 88 }}
                    bg={tc.pap2}
                    resizeMode="contain"
                    resizeMethod="resize"
                  />
                  <PixelText variant="ko" size={9} numberOfLines={1} color={tc.ink}>
                    {c.name}
                  </PixelText>
                  <PixelText variant={txt} size={7} numberOfLines={1} color={tc.ink3}>
                    {[c.setCode, c.number ? `${c.number}${c.totalNumber ? `/${c.totalNumber}` : ''}` : '', c.rarity]
                      .filter(Boolean)
                      .join(' · ')}
                  </PixelText>
                </View>
              </PixelFrame>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function BunjangRow({ item }: { item: BunjangItem }) {
  return (
    <MarketListRow
      onPress={() => Linking.openURL(item.productUrl)}
      imageUrl={item.imageUrl}
      fallbackEmoji="📦"
      title={item.name}
      priceText={item.price > 0 ? `${item.price.toLocaleString('ko-KR')}원` : '가격문의'}
      metaText={`📍 ${item.location || '지역 미표기'}   ❤ ${item.favCount}`}
    />
  );
}
