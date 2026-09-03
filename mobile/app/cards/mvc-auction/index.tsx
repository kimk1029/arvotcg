import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { useTheme, useThemeColors } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { fonts } from '@/theme/tokens';
import {
  fetchAllTodayAuctions,
  fetchMvcLatestBids,
  mvcImgProxy,
  type MvcAuctionItem,
  type MvcLatestBid,
} from '@/services/marketplace';
import { useListingFavorites, type ListingFavorite } from '@/lib/useListingFavorites';
import { shotSource } from '@/lib/shotMode';

/**
 * 경매(MVC) — Claude Design 'ARVOTCG 경매' 프로토타입 레이아웃 (네이티브).
 * 모든 테마가 같은 레이아웃, 색/폰트만 테마별(클린=레드 포인트, 그 외=테마토큰).
 * 데이터/입찰갱신/관심 로직은 유지하고 표현만 새 디자인으로.
 */

const RED = '#F5333F';
const CAFE_URL = 'https://cafe.naver.com/cardmvk';
const FEATURE_COUNT = 8;
const AUTO_REFRESH_MS = 30_000;

type BidMap = Record<number, MvcLatestBid | null>;

interface Palette {
  pageBg: string;
  cardBg: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  line: string;
  chip: string;
  chipBd: string;
}
const CLEAN_P: Palette = {
  pageBg: '#ffffff',
  cardBg: '#ffffff',
  ink: '#16161a',
  ink2: '#6B6B70',
  ink3: '#9A9AA0',
  accent: RED,
  line: '#F0F0F2',
  chip: '#F2F2F4',
  chipBd: '#E5E5EA',
};

const FALLBACK_BG = ['#ff5a2b', '#f9a825', '#9d6bd6', '#3a6ea5', '#e0a500', '#a83a6e'];

function todayClose2300Kst(): number {
  // KST = UTC+9 (DST 없음). Intl 의존 없이 오늘 23:00 KST = 14:00 UTC.
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  return Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 14, 0, 0);
}
function fmtRemain(ms: number): string {
  if (ms <= 0) return '마감';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 1) return `${h}시간 ${m}분`;
  return `${m}분 ${String(s).padStart(2, '0')}초`;
}
function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '입찰 전';
  return `₩${n.toLocaleString('ko-KR')}`;
}
function stripDeadline(s: string): string {
  return s.replace(/^\s*\([^)]*마감[^)]*\)\s*/, '').trim() || s;
}
function parseRegion(s: string): string | null {
  if (/일판|일본/.test(s)) return '일본판';
  if (/한판|한국|국내/.test(s)) return '한국판';
  return null;
}
function parseGrade(s: string): string | null {
  if (/psa\s*10|10등급/i.test(s)) return 'PSA 10';
  if (/psa\s*9|9등급/i.test(s)) return 'PSA 9';
  if (/raw|미감정|무감정|로우/i.test(s)) return 'RAW';
  return null;
}

const FILTERS = ['전체', 'PSA10', 'PSA9', 'RAW', '일본판', '한국판'] as const;
type FilterId = (typeof FILTERS)[number];
function matchFilter(f: FilterId, subject: string): boolean {
  if (f === '전체') return true;
  const g = parseGrade(subject);
  const r = parseRegion(subject);
  if (f === 'PSA10') return g === 'PSA 10';
  if (f === 'PSA9') return g === 'PSA 9';
  if (f === 'RAW') return g === 'RAW';
  if (f === '일본판') return r === '일본판';
  if (f === '한국판') return r === '한국판';
  return true;
}

function favToItem(f: ListingFavorite): MvcAuctionItem {
  const articleId = Number(f.externalId);
  return { articleId, subject: f.title, writerNickname: '', commentCount: 0, readCount: 0, writtenAt: 0, writtenAgo: '', thumbnailUrl: f.imageUrl, costText: '', sourceUrl: '' };
}
function synthBid(articleId: number, price: number | null): MvcLatestBid | undefined {
  if (price == null) return undefined;
  return { articleId, amount: price, content: '', commentCount: 0, writtenAt: 0 };
}
function favFromItem(item: MvcAuctionItem, bid: MvcLatestBid | null | undefined): ListingFavorite {
  return { source: 'mvc', externalId: String(item.articleId), title: item.subject, imageUrl: item.thumbnailUrl, price: bid?.amount ?? null, url: `/cards/mvc-auction/${item.articleId}` };
}

/* ---------------- 아이콘 ---------------- */
function Search({ c, s = 23 }: { c: string; s?: number }) {
  return <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round"><Circle cx={11} cy={11} r={7} /><Path d="m20 20-3.5-3.5" /></Svg>;
}
function Bell({ c, s = 23 }: { c: string; s?: number }) {
  return <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.7 21a2 2 0 0 1-3.4 0" /></Svg>;
}
function Receipt({ c, s = 14 }: { c: string; s?: number }) {
  return <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Rect x={3} y={4} width={18} height={16} rx={2} /><Path d="M3 10h18M9 4v16" /></Svg>;
}
function Heart({ fill, stroke, s = 22 }: { fill: string; stroke: string; s?: number }) {
  return <Svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" /></Svg>;
}
function Clock({ c, s = 11 }: { c: string; s?: number }) {
  return <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></Svg>;
}
function Filter({ c, s = 14 }: { c: string; s?: number }) {
  return <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></Svg>;
}
function ChevR({ c, s = 13 }: { c: string; s?: number }) {
  return <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><Path d="m9 6 6 6-6 6" /></Svg>;
}
function Plus({ c, s = 18 }: { c: string; s?: number }) {
  return <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 5v14M5 12h14" /></Svg>;
}

export default function MvcAuctionScreen() {
  const { theme } = useTheme();
  const tc = useThemeColors();
  const flat = isFlatTheme(theme);
  const pixel = !flat;
  const isClean = theme === 'clean';

  const P: Palette = isClean
    ? CLEAN_P
    : { pageBg: tc.paper, cardBg: tc.paper, ink: tc.ink, ink2: tc.ink2, ink3: tc.ink3, accent: tc.red, line: tc.pap3, chip: tc.pap2, chipBd: tc.pap3 };

  const fontReg = flat ? undefined : fonts.ko;
  const fontBold = flat ? undefined : fonts.koBold;
  const ts = (size: number, weight: '400' | '500' | '600' | '700' | '800' | '900', color: string) => ({
    fontFamily: Number(weight) >= 700 ? fontBold : fontReg,
    fontSize: size,
    fontWeight: weight,
    color,
    lineHeight: Math.round(size * 1.3),
  });

  const [items, setItems] = useState<MvcAuctionItem[]>([]);
  const [bids, setBids] = useState<BidMap>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remain, setRemain] = useState(todayClose2300Kst() - Date.now());
  const [tab, setTab] = useState<'live' | 'soon' | 'ended' | 'fav'>('live');
  const [filter, setFilter] = useState<FilterId>('전체');
  const bidsRef = useRef<BidMap>({});

  const { isFav, toggle, favorites } = useListingFavorites('mvc');

  const loadBids = useCallback(async (targets: MvcAuctionItem[], fresh: boolean) => {
    const ids = targets.filter((it) => it.commentCount > 0).map((it) => it.articleId).filter((id) => fresh || !(id in bidsRef.current));
    if (ids.length === 0) return;
    const m = await fetchMvcLatestBids(ids);
    bidsRef.current = { ...bidsRef.current, ...m };
    setBids((prev) => ({ ...prev, ...m }));
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const list = await fetchAllTodayAuctions();
        setItems(list);
        void loadBids(list, refresh);
      } catch (e) {
        setError(e instanceof Error ? e.message : '불러오기 실패');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadBids],
  );

  useEffect(() => { load(); }, [load]);

  // 마감 카운트다운
  useEffect(() => {
    const t = setInterval(() => setRemain(todayClose2300Kst() - Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 관심 항목 최신 호가 직접 조회
  const favKey = favorites.map((f) => f.externalId).join(',');
  useEffect(() => {
    const ids = favorites.map((f) => Number(f.externalId)).filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) return;
    fetchMvcLatestBids(ids).then((m) => { bidsRef.current = { ...bidsRef.current, ...m }; setBids((prev) => ({ ...prev, ...m })); }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favKey]);

  const favIdSet = useMemo(() => new Set(favorites.map((f) => f.externalId)), [favorites]);
  const rest = useMemo(() => items.filter((it) => !favIdSet.has(String(it.articleId))), [items, favIdSet]);
  const featured = useMemo(() => [...rest].sort((a, b) => b.commentCount - a.commentCount).slice(0, FEATURE_COUNT), [rest]);
  const featuredIds = useMemo(() => new Set(featured.map((f) => f.articleId)), [featured]);
  const mainList = useMemo(() => rest.filter((it) => !featuredIds.has(it.articleId) && matchFilter(filter, it.subject)), [rest, featuredIds, filter]);
  const featuredFiltered = useMemo(() => featured.filter((it) => matchFilter(filter, it.subject)), [featured, filter]);
  const pinnedItems = useMemo(() => {
    const liveById = new Map(items.map((it) => [String(it.articleId), it]));
    return favorites.map((f) => liveById.get(f.externalId) ?? favToItem(f));
  }, [favorites, items]);

  // 마감 임박 호가 30초 자동 갱신
  const featuredKey = featured.map((f) => f.articleId).join(',');
  useEffect(() => {
    if (featured.length === 0) return;
    const run = () => loadBids(featured, true);
    const t = setInterval(run, AUTO_REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredKey, loadBids]);

  const bidFor = useCallback(
    (item: MvcAuctionItem): MvcLatestBid | null | undefined => {
      if (item.articleId in bids) return bids[item.articleId];
      const favMeta = favorites.find((f) => f.externalId === String(item.articleId));
      return favMeta ? synthBid(item.articleId, favMeta.price) : undefined;
    },
    [bids, favorites],
  );
  const onToggleFav = (it: MvcAuctionItem) => toggle(favFromItem(it, bids[it.articleId]));
  const open = (id: number) => router.push(`/cards/mvc-auction/${id}` as never);
  const remainText = fmtRemain(remain);

  // 카드 컨테이너(주목할 만한 리스트) — 픽셀: PixelFrame / 플랫: 둥근 소프트
  const Panel = ({ children }: { children: ReactNode }) =>
    pixel ? (
      <PixelFrame borderWidth={3} shadow={5} inner={3} bg={tc.white}>{children}</PixelFrame>
    ) : (
      <View style={{ backgroundColor: P.cardBg, borderRadius: 16, borderWidth: 1, borderColor: P.line, overflow: 'hidden', shadowColor: '#000', shadowOpacity: isClean ? 0.04 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }}>{children}</View>
    );

  const renderThumb = (item: MvcAuctionItem, idx: number, w: number | '100%', h: number, radius: number, emojiSize: number) => (
    <View style={{ width: w, height: h, borderRadius: radius, overflow: 'hidden', backgroundColor: item.thumbnailUrl ? '#1c1c1e' : FALLBACK_BG[idx % FALLBACK_BG.length], alignItems: 'center', justifyContent: 'center' }}>
      {item.thumbnailUrl ? (
        <Image source={shotSource(mvcImgProxy(item.thumbnailUrl))} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={{ fontSize: emojiSize }}>🔨</Text>
      )}
    </View>
  );

  const ChipRow = ({ subject, sm }: { subject: string; sm?: boolean }) => {
    const chips = [parseGrade(subject), parseRegion(subject)].filter(Boolean) as string[];
    if (chips.length === 0) return null;
    return (
      <View style={{ flexDirection: 'row', gap: 5, marginTop: sm ? 7 : 9, flexWrap: 'wrap' }}>
        {chips.map((c) => (
          <View key={c} style={{ borderWidth: 1, borderColor: P.chipBd, borderRadius: sm ? 5 : 6, paddingHorizontal: sm ? 6 : 7, paddingVertical: sm ? 2 : 3 }}>
            <Text style={ts(sm ? 10 : 10.5, '700', P.ink3)}>{c}</Text>
          </View>
        ))}
      </View>
    );
  };

  const SectionHead = ({ title }: { title: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 }}>
      <Text style={ts(18, '800', P.ink)}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        <Text style={ts(13, '600', P.ink3)}>더보기</Text>
        <ChevR c={P.ink3} />
      </View>
    </View>
  );

  const NotableRow = ({ item, idx, first }: { item: MvcAuctionItem; idx: number; first: boolean }) => {
    const bid = bidFor(item);
    const fav = isFav(String(item.articleId));
    return (
      <Pressable onPress={() => open(item.articleId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 15, paddingVertical: 15, borderTopWidth: first ? 0 : 1, borderTopColor: P.line }}>
        {renderThumb(item, idx, 50, 68, 8, 26)}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3C9CC', backgroundColor: '#FFF0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 }}>
            <Text style={ts(11, '800', P.accent)}>{remain > 0 ? `${remainText} 남음` : '마감'}</Text>
          </View>
          <Text numberOfLines={1} style={[ts(15, '800', P.ink), { marginTop: 8 }]}>{stripDeadline(item.subject)}</Text>
          <ChipRow subject={item.subject} sm />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={ts(11.5, '600', P.ink3)}>현재가</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[ts(17, '900', P.ink), { marginTop: 3 }]}>{fmtPrice(bid?.amount)}</Text>
          <Text style={[ts(11.5, '600', P.ink3), { marginTop: 4 }]}>입찰 {item.commentCount}회</Text>
        </View>
        <Pressable onPress={() => onToggleFav(item)} hitSlop={8} style={{ position: 'absolute', top: 10, right: 10, padding: 2 }}>
          <Heart fill={fav ? P.accent : 'none'} stroke={fav ? P.accent : P.ink3} s={17} />
        </Pressable>
      </Pressable>
    );
  };

  const showFavTab = tab === 'fav';
  const notableList = showFavTab ? pinnedItems : mainList;

  return (
    <View style={{ flex: 1, backgroundColor: P.pageBg }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: P.cardBg }}>
        <Text style={[ts(24, '900', P.ink), { flex: 1 }]}>경매</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable onPress={() => router.push('/cards/snkrdunk/search' as never)} hitSlop={8}><Search c={P.ink} /></Pressable>
          <Pressable onPress={() => router.push('/my/messages' as never)} hitSlop={8}><Bell c={P.ink} /></Pressable>
          <Pressable onPress={() => setTab('fav')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: P.chipBd, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 }}>
            <Receipt c={P.ink} />
            <Text style={ts(12.5, '700', P.ink)}>경매 내역</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {/* hero */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
          <Pressable onPress={() => Linking.openURL(CAFE_URL)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 88, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1d1830', paddingHorizontal: 18 }}>
            <Text style={{ fontSize: 44 }}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={ts(16, '900', '#fff')}>오늘 마감 카드 경매</Text>
              <Text style={[ts(12.5, '600', 'rgba(255,255,255,.65)'), { marginTop: 3 }]}>{remain > 0 ? `23:00 마감 · ${remainText} 남음` : '카드의 가치를 경매로 경험하세요'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,.14)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}>
              <Text style={ts(12.5, '700', '#fff')}>안내</Text>
              <ChevR c="#fff" s={12} />
            </View>
          </Pressable>
        </View>

        {/* status tabs */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: 20, paddingBottom: 2 }}>
          {([['live', '진행중', rest.length], ['soon', '예정', 0], ['ended', '종료', 0]] as Array<['live' | 'soon' | 'ended', string, number]>).map(([id, label, count]) => {
            const on = tab === id;
            return (
              <Pressable key={id} onPress={() => setTab(id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 2.5, borderBottomColor: on ? P.accent : 'transparent' }}>
                <Text style={ts(15.5, on ? '800' : '600', on ? P.ink : P.ink3)}>{label}</Text>
                <View style={{ backgroundColor: on ? P.accent : '#C7C7CC', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 9 }}>
                  <Text style={ts(11, '800', '#fff')}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
          <View style={{ width: 1, height: 18, backgroundColor: P.line }} />
          <Pressable onPress={() => setTab('fav')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 12 }}>
            <Heart fill={showFavTab ? P.accent : 'none'} stroke={showFavTab ? P.accent : P.ink3} s={16} />
            <Text style={ts(13.5, '700', showFavTab ? P.accent : P.ink3)}>관심 경매</Text>
          </Pressable>
        </View>
        <View style={{ height: 1, backgroundColor: P.line, marginHorizontal: 20, marginBottom: 14 }} />

        {/* filter chips */}
        {tab === 'live' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 20 }}>
            {FILTERS.map((f) => {
              const on = filter === f;
              return (
                <Pressable key={f} onPress={() => setFilter(f)} style={{ paddingHorizontal: 17, paddingVertical: 9, borderRadius: 11, backgroundColor: on ? P.ink : P.cardBg, borderWidth: 1, borderColor: on ? P.ink : P.chipBd }}>
                  <Text style={ts(13.5, '700', on ? P.cardBg : P.ink)}>{f}</Text>
                </Pressable>
              );
            })}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 11, backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.chipBd }}>
              <Filter c={P.ink} />
              <Text style={ts(13.5, '700', P.ink)}>필터</Text>
            </View>
          </ScrollView>
        )}

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={P.accent} /></View>
        ) : tab === 'soon' || tab === 'ended' ? (
          <View style={{ paddingVertical: 50, paddingHorizontal: 24, alignItems: 'center' }}>
            <Text style={ts(14, '600', P.ink3)}>{tab === 'soon' ? '예정된 경매는 곧 공개됩니다.' : '종료된 경매가 아직 없어요.'}</Text>
          </View>
        ) : (
          <>
            {/* 🔥 마감 임박 */}
            {tab === 'live' && featuredFiltered.length > 0 && (
              <>
                <SectionHead title="🔥 마감 임박" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 13, paddingHorizontal: 20, paddingBottom: 24 }}>
                  {featuredFiltered.map((it, i) => {
                    const bid = bidFor(it);
                    const fav = isFav(String(it.articleId));
                    return (
                      <Pressable key={it.articleId} onPress={() => open(it.articleId)} style={{ width: 172, backgroundColor: P.cardBg, borderWidth: 1, borderColor: P.line, borderRadius: 16, overflow: 'hidden' }}>
                        <View style={{ padding: 11 }}>
                          {renderThumb(it, i, '100%', 200, 10, 64)}
                          <View style={{ position: 'absolute', top: 22, left: 22, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,.72)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 }}>
                            <Clock c="#FF5247" />
                            <Text style={ts(11, '800', '#FF5247')}>{remain > 0 ? remainText : '마감'}</Text>
                          </View>
                          <Pressable onPress={() => onToggleFav(it)} hitSlop={8} style={{ position: 'absolute', top: 24, right: 24 }}>
                            <Heart fill={fav ? P.accent : 'rgba(0,0,0,.25)'} stroke="#fff" s={22} />
                          </Pressable>
                        </View>
                        <View style={{ paddingHorizontal: 14, paddingBottom: 15, paddingTop: 2 }}>
                          <Text numberOfLines={1} style={ts(16, '800', P.ink)}>{stripDeadline(it.subject)}</Text>
                          <ChipRow subject={it.subject} />
                          <Text style={[ts(12, '600', P.ink3), { marginTop: 13 }]}>현재가</Text>
                          <Text numberOfLines={1} adjustsFontSizeToFit style={[ts(21, '900', P.ink), { marginTop: 2 }]}>{fmtPrice(bid?.amount)}</Text>
                          <Text style={[ts(12, '600', P.ink3), { marginTop: 7 }]}>입찰 {it.commentCount}회</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* 🔨 주목할 만한 경매 / 관심 경매 */}
            <SectionHead title={showFavTab ? '🤍 관심 경매' : '🔨 주목할 만한 경매'} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 28 }}>
              {notableList.length > 0 ? (
                <Panel>
                  <View style={{ backgroundColor: pixel ? tc.white : P.cardBg }}>
                    {notableList.map((it, i) => (
                      <NotableRow key={it.articleId} item={it} idx={i} first={i === 0} />
                    ))}
                  </View>
                </Panel>
              ) : (
                <View style={{ paddingVertical: 36, alignItems: 'center' }}>
                  <Text style={ts(14, '600', P.ink3)}>{showFavTab ? '아직 관심 경매가 없어요. ♡ 를 눌러 추가해 보세요.' : error ? `불러오기 오류: ${error}` : '오늘 마감인 경매가 없습니다.'}</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* floating 출품 */}
      <Pressable onPress={() => Linking.openURL(CAFE_URL)} style={{ position: 'absolute', right: 18, bottom: 96, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.accent, borderRadius: 26, paddingLeft: 15, paddingRight: 18, paddingVertical: 13, shadowColor: RED, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
        <Plus c="#fff" />
        <Text style={ts(14, '800', '#fff')}>경매 출품</Text>
      </Pressable>
    </View>
  );
}
