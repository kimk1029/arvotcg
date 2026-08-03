/**
 * /cards/packs — 시세확인 박스 리스트.
 *
 * 웹 src/app/cards/packs/page.tsx 와 동등.
 * CARD_PACKS 를 순회하며 각 팩의 apparel-group 박스 1건을 fetch (apparelCategoryId=14).
 * 박스 이미지 + 한·일 이름 + 박스 가격을 카드 형태로 표시.
 * 항목 클릭 시 /cards/packs/[code] 로 이동.
 *
 * 캐싱: 첫 진입 시 38팩 fetch 가 길어 매번 "불러오는 중" 으로 보임.
 * 모듈 레벨 캐시에 결과를 보관, 화면 재진입 시 즉시 표시하고 TTL 지났을 때만
 * 백그라운드에서 갱신.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Image, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelPress } from '@/components/cv/PixelPress';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { LoadingState, ErrorView } from '@/components/cv/ListState';
import { useThemeColors, useTheme } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { CARD_PACKS, packSetCode, type CardPackMeta, type CardPackGame } from '@/data/cardPacks';
import { useCurrency } from '@/components/CurrencyProvider';
import { api } from '@/lib/apiClient';
import type { SnkrdunkApparelGroupPage, SnkrdunkSearchResult } from '@/services/snkrdunk';
import { localizeCardName } from '@/lib/cardNameKo';
import { useGamePrefs } from '@/components/GamePrefsProvider';

const GAME_TABS: Array<{ key: CardPackGame; label: string }> = [
  { key: 'pokemon', label: '포켓몬' },
  { key: 'onepiece', label: '원피스' },
  { key: 'yugioh', label: '유희왕' },
  { key: 'sports', label: '스포츠' },
];

interface PackWithBox extends CardPackMeta {
  boxName: string;
  boxKoName: string;
  boxImageUrl: string | null;
  boxPrice: number;
}

// 10분 동안 캐시 신선함으로 간주 — 웹 packs/page.tsx 의 ISR revalidate=600 과 동일 주기.
const PACKS_TTL_MS = 10 * 60 * 1000;
let packsCache: { data: PackWithBox[]; at: number } | null = null;
let packsInFlight: Promise<PackWithBox[]> | null = null;

async function loadAllPacksWithBox(): Promise<PackWithBox[]> {
  // 부분 실패 허용 — 38개 팩 fetch 중 일부 실패해도 나머지는 표시.
  // 8초 타임아웃으로 무한 대기 방지.
  return Promise.all(
    CARD_PACKS.map(async (pack) => {
      const fallback: PackWithBox = {
        ...pack,
        boxName: pack.searchQuery,
        boxKoName: pack.name,
        boxImageUrl: null,
        boxPrice: 0,
      };
      try {
        // 웹 packs/page.tsx 와 동일한 NAS 엔드포인트 호출 — 그룹 있으면 apparel-groups
        // 박스 1건, 그룹 미확인(0)이면 '검색어 + ボックス' 검색 첫 매물.
        const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
        if (!pack.apparelGroupId) {
          const r = await Promise.race([
            api<{ results?: SnkrdunkSearchResult[] }>(
              `/api/snkrdunk/search?q=${encodeURIComponent(`${pack.searchQuery} ボックス`)}`,
              { auth: false },
            ),
            timer,
          ]);
          const hit = r?.results?.[0] ?? null;
          if (!hit) return fallback;
          return {
            ...pack,
            boxName: hit.name,
            boxKoName: localizeCardName(hit.name),
            boxImageUrl: hit.imageUrl,
            boxPrice: Number((hit.priceText ?? '').replace(/[^\d]/g, '')) || 0,
          };
        }
        const r = await Promise.race([
          api<{ data: SnkrdunkApparelGroupPage | null }>(
            `/api/snkrdunk/apparel-groups/${pack.apparelGroupId}?apparelCategoryId=14&page=1&perPage=1`,
            { auth: false },
          ),
          timer,
        ]);
        const box = r?.data?.apparels?.[0] ?? null;
        const localized = box?.localizedName ?? null;
        return {
          ...pack,
          boxName: localized ?? pack.searchQuery,
          boxKoName: localized ? localizeCardName(localized) : pack.name,
          boxImageUrl: box?.imageUrl ?? null,
          boxPrice: box?.minPrice ?? 0,
        };
      } catch {
        return fallback;
      }
    }),
  );
}

function fetchPacksOnce(): Promise<PackWithBox[]> {
  if (packsInFlight) return packsInFlight;
  packsInFlight = loadAllPacksWithBox()
    .then((rows) => {
      packsCache = { data: rows, at: Date.now() };
      return rows;
    })
    .finally(() => {
      packsInFlight = null;
    });
  return packsInFlight;
}

export default function PackExplorerScreen() {
  const { format: formatCurrency } = useCurrency();
  // 클린·다크(플랫) — 웹 clean 디자인셋과 동일하게 픽셀 보더/직각을 라운드+소프트로.
  const tc = useThemeColors();
  const { theme } = useTheme();
  const flat = isFlatTheme(theme);
  // 캐시가 있으면 즉시 보여주고 (loading=false), 없으면 로딩 표시.
  const [data, setData] = useState<PackWithBox[] | null>(packsCache?.data ?? null);
  const [loading, setLoading] = useState<boolean>(!packsCache);
  const [error, setError] = useState<Error | null>(null);
  // 설정의 "카드 게임 표시" 토글이 노출 게임을 정한다 (웹 PacksExplorer 동일).
  const { enabledGames } = useGamePrefs();
  const tabs = GAME_TABS.filter((t) => enabledGames.includes(t.key));
  const multi = tabs.length > 1;
  // null = 사용자가 아직 탭을 안 만짐 → 여러 게임이 켜져 있으면 전체, 1개면 그 게임.
  const [picked, setPicked] = useState<CardPackGame | 'all' | null>(null);
  const pickedValid =
    picked === 'all' ? multi : picked != null && enabledGames.includes(picked);
  const game: CardPackGame | 'all' =
    (pickedValid ? picked : null) ?? (multi ? 'all' : tabs[0]?.key ?? 'pokemon');
  const gameLabel = game === 'all' ? '전체' : GAME_TABS.find((t) => t.key === game)?.label ?? '카드';
  const list = (data ?? []).filter((pack) => {
    const g = pack.game ?? 'pokemon';
    return game === 'all' ? enabledGames.includes(g) : g === game;
  });
  const tick = useRef(0);

  const refresh = useCallback(() => {
    const myTick = ++tick.current;
    if (!packsCache) setLoading(true);
    setError(null);
    fetchPacksOnce()
      .then((rows) => {
        if (myTick !== tick.current) return;
        setData(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (myTick !== tick.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (myTick !== tick.current) return;
        setLoading(false);
      });
  }, []);

  // 마운트: 캐시 없으면 fetch. 캐시 있으면 TTL 만료 시에만 백그라운드 갱신.
  useEffect(() => {
    if (!packsCache) {
      refresh();
    } else if (Date.now() - packsCache.at > PACKS_TTL_MS) {
      refresh();
    }
    return () => {
      tick.current++;
    };
  }, [refresh]);

  // 포커스 재진입 시에는 캐시가 stale 할 때만 백그라운드 갱신 (로딩 화면 X).
  useFocusEffect(
    useCallback(() => {
      if (packsCache && Date.now() - packsCache.at > PACKS_TTL_MS) {
        refresh();
      }
    }, [refresh]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: tc.bg }}>
      <AppBar onBack={() => router.back()} title="시세확인" />
      {/* 게임 필터 탭 — 웹 PacksExplorer 동일 (설정에서 켠 게임만, 여러 개면 '전체' 탭 추가).
          클린은 웹 [data-theme=clean] .chip.on(잉크 배경+흰 글씨)과 동일. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingTop: 10 }}>
        {multi && (
          <PixelPress onPress={() => setPicked('all')} bg={game === 'all' ? (flat ? tc.ink : tc.gold) : tc.white} borderWidth={3} shadow={game === 'all' ? 2 : 4} inner={2}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 7 }}>
              <PixelText variant="ko" size={10} weight="bold" color={flat && game === 'all' ? tc.paper : tc.ink}>전체</PixelText>
            </View>
          </PixelPress>
        )}
        {tabs.map((t) => {
          const on = game === t.key;
          return (
            <PixelPress key={t.key} onPress={() => setPicked(t.key)} bg={on ? (flat ? tc.ink : tc.gold) : tc.white} borderWidth={3} shadow={on ? 2 : 4} inner={2}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 7 }}>
                <PixelText variant="ko" size={10} weight="bold" color={flat && on ? tc.paper : tc.ink}>{t.label}</PixelText>
              </View>
            </PixelPress>
          );
        })}
      </View>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <View style={{ margin: 14 }}>
          <ErrorView error={error} onRetry={refresh} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
          {/* 헤더 안내 — 픽셀 테마는 입체 프레임, 플랫 테마는 PixelFrame 이 자동 플랫 처리 */}
          <View style={{ marginHorizontal: 14, marginTop: 14, marginBottom: 12 }}>
            <PixelFrame bg={tc.white}>
              <View style={{ padding: 14 }}>
                <PixelText variant="ko" size={14} weight="bold" color={tc.ink}>
                  {gameLabel} 카드 박스
                </PixelText>
                <PixelText
                  variant="ko"
                  size={11}
                  color={tc.ink3}
                  style={{ marginTop: 6, lineHeight: 16 }}
                >
                  박스를 선택하면 해당 박스의 싱글카드 시세가 표시됩니다.
                </PixelText>
              </View>
            </PixelFrame>
          </View>

          {/* 박스 리스트 — 픽셀 테마는 입체 버튼, 플랫은 웹 .pack-list-item(라운드+소프트) 동일.
              플랫 간격은 웹 gap 10 에 맞춰 넓힘. */}
          <View style={{ marginHorizontal: 14, gap: flat ? 10 : 3 }}>
            {list.map((pack) => (
              <PixelPress
                key={pack.code}
                onPress={() => router.push(`/cards/packs/${pack.code}` as never)}
                bg={tc.white}
                borderWidth={4}
                shadow={6}
                hi="rgba(255,255,255,0.95)"
                lo="rgba(0,0,0,0.25)"
                inner={3}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 10,
                  }}
                >
                  <View
                    style={{
                      width: 84,
                      height: 84,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: pack.bg,
                      // 웹 클린: 썸네일은 ink 보더 없이 라운드(--r-sm=14).
                      borderColor: tc.ink,
                      borderWidth: flat ? 0 : 2,
                      borderRadius: flat ? 14 : 0,
                      overflow: 'hidden',
                    }}
                  >
                    {pack.boxImageUrl ? (
                      <Image
                        source={{ uri: pack.boxImageUrl }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                        resizeMethod="resize"
                      />
                    ) : (
                      <Text style={{ fontSize: 34 }}>{pack.emoji}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <PixelText
                        variant="ko"
                        size={13}
                        weight="bold"
                        color={tc.ink}
                        numberOfLines={2}
                        style={{ flexShrink: 1 }}
                      >
                        {pack.name}
                      </PixelText>
                      {/* 세트코드 라벨 — 포켓몬 SV11B/M2A, 원피스 OP16 등. 웹 PacksExplorer 와 동일. */}
                      {packSetCode(pack) ? (
                        <View style={{ borderWidth: 1, borderColor: tc.ink3, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
                          <PixelText variant="ko" size={9} color={tc.ink3} style={{ letterSpacing: 0.5 }}>
                            {packSetCode(pack)!}
                          </PixelText>
                        </View>
                      ) : null}
                    </View>
                    <PixelText
                      variant="ko"
                      size={10}
                      color={tc.ink3}
                      style={{ marginTop: 5, lineHeight: 15 }}
                      numberOfLines={1}
                    >
                      {pack.boxKoName}
                    </PixelText>
                    <PixelText
                      variant="ko"
                      size={10}
                      color={tc.ink3}
                      style={{ lineHeight: 15 }}
                      numberOfLines={1}
                    >
                      {pack.boxName}
                    </PixelText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                      {pack.boxPrice > 0 ? (
                        // 웹 클린: 박스가 필 = gold-soft 배경 + gold-dk 1px 보더 + 알약 라운드.
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: 7,
                            paddingVertical: 4,
                            backgroundColor: flat ? tc.goldSoft : tc.gold,
                            borderColor: flat ? tc.goldDk : tc.ink,
                            borderWidth: 1,
                            borderRadius: flat ? 999 : 0,
                          }}
                        >
                          <PixelText variant="pixel" size={7} color={tc.ink} style={{ opacity: 0.7 }}>
                            박스
                          </PixelText>
                          <PixelText variant="pixel" size={9} weight="bold" color={tc.ink} numberOfLines={1}>
                            {formatCurrency(pack.boxPrice)}
                          </PixelText>
                        </View>
                      ) : null}
                      {/* 웹 클린: 출시일 필 = pap2 배경, 보더 없음, 알약 라운드. */}
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 3,
                          backgroundColor: tc.pap2,
                          borderColor: tc.ink,
                          borderWidth: flat ? 0 : 1,
                          borderRadius: flat ? 999 : 0,
                        }}
                      >
                        <PixelText variant="pixel" size={8} color={tc.ink2} numberOfLines={1}>
                          {pack.releasedAt ? `${pack.releasedAt} 출시` : '출시일 확인 중'}
                        </PixelText>
                      </View>
                    </View>
                  </View>
                  <PixelText variant="pixel" size={14} color={tc.ink3} style={{ paddingRight: 6 }}>
                    ›
                  </PixelText>
                </View>
              </PixelPress>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
