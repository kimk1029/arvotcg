/**
 * /trade — 중고장터 목록. 웹 TradeScreen 패리티:
 * GET /api/trades?limit=60 실데이터 + 필터(전체/삽니다/팝니다) + 완료글 보이기
 * 토글(+건수) + 검색(제목·장소·닉네임·가격) + 행 탭 시 /trade/[id] 상세.
 */
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { LoadingState } from '@/components/cv/ListState';
import { fonts, space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { api } from '@/lib/apiClient';
import { formatPrice } from '@/lib/numberFormat';
import { shotSource } from '@/lib/shotMode';

type TradeType = 'sell' | 'buy';
type TradeStatus = 'open' | 'reserved' | 'done' | 'cancelled';
type Filter = 'all' | TradeType;

interface Trade {
  id: number;
  type: TradeType;
  status?: TradeStatus;
  title: string;
  place: string;
  time: string;
  price: string;
  bumpCount?: number;
  chatCount?: number;
  authorName?: string;
  images?: string[];
}

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'buy', label: '삽니다' },
  { id: 'sell', label: '팝니다' },
];

const STATUS_LABEL: Record<string, string> = {
  reserved: '예약 중',
  done: '거래 완료',
  cancelled: '취소됨',
};

export default function TradeList() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showDone, setShowDone] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api<{ data: Trade[] }>('/api/trades?limit=60', { auth: false });
      setTrades(r.data ?? []);
    } catch {
      setTrades([]);
    }
  }, []);

  // 글 작성/상세 상태변경 후 복귀 시 새 데이터가 보이도록 포커스마다 갱신.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const doneCount = (trades ?? []).filter((t) => t.status === 'done').length;
  const q = query.trim().toLowerCase();

  const list = useMemo(
    () =>
      (trades ?? []).filter((t) => {
        if (filter !== 'all' && t.type !== filter) return false;
        if (!showDone && t.status === 'done') return false;
        if (q) {
          const hay = `${t.title} ${t.place ?? ''} ${t.authorName ?? ''} ${t.price ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [trades, filter, showDone, q],
  );

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar
        title="거래"
        right={
          <Pressable
            onPress={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setQuery('');
            }}
            hitSlop={8}
          >
            <PixelText variant={txt} size={14}>{searchOpen ? '✕' : '🔍'}</PixelText>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingTop: space.gap, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {searchOpen ? (
          <View style={{ paddingHorizontal: space.gap, marginBottom: 10 }}>
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="제목 · 장소 · 닉네임 · 가격"
              placeholderTextColor={tc.ink3}
              style={{ backgroundColor: tc.white, borderColor: tc.ink, borderWidth: 3, padding: 10, fontFamily: fonts.ko, fontSize: 13, color: tc.ink }}
            />
            {q ? (
              <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 6 }}>
                검색결과 {list.length}건
              </PixelText>
            ) : null}
          </View>
        ) : null}

        {/* 필터 세그먼트 */}
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: space.gap, marginBottom: 8 }}>
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={{ flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: on ? tc.ink : tc.white, borderColor: tc.ink, borderWidth: 2 }}
              >
                <PixelText variant={txt} size={10} color={on ? tc.gold : tc.ink}>{f.label}</PixelText>
              </Pressable>
            );
          })}
        </View>

        {/* 완료 보이기 토글 */}
        <Pressable
          onPress={() => setShowDone((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.gap, marginBottom: 10 }}
        >
          <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: tc.ink, backgroundColor: showDone ? tc.gold : tc.white, alignItems: 'center', justifyContent: 'center' }}>
            {showDone ? <PixelText variant={txt} size={8} color={tc.ink}>✓</PixelText> : null}
          </View>
          <PixelText variant={txt} size={9} color={tc.ink3}>
            완료된 글 보이기{doneCount > 0 ? ` (${doneCount})` : ''}
          </PixelText>
        </Pressable>

        {trades === null ? (
          <View style={{ paddingTop: 30 }}><LoadingState /></View>
        ) : list.length === 0 ? (
          <View style={{ marginHorizontal: space.gap, padding: 20, backgroundColor: tc.white, borderColor: tc.ink, borderWidth: 3 }}>
            <PixelText variant="ko" size={12} color={tc.ink}>
              {q ? `"${query}" 에 해당하는 거래글이 없어요` : '해당 카테고리에 거래글이 없어요'}
            </PixelText>
          </View>
        ) : (
          list.map((t) => <TradeRow key={t.id} t={t} tc={tc} txt={txt} />)
        )}
      </ScrollView>
    </View>
  );
}

function TradeRow({ t, tc, txt }: { t: Trade; tc: ReturnType<typeof useThemeColors>; txt: 'pixel' | 'ko' }) {
  const isSell = t.type === 'sell';
  const statusLabel = t.status && t.status !== 'open' ? STATUS_LABEL[t.status] : null;
  return (
    <Pressable onPress={() => router.push(`/trade/${t.id}` as never)} style={{ marginHorizontal: space.gap, marginBottom: space.cg }}>
      <PixelFrame bg={tc.white} shadow={5} inner={3}>
        <View style={{ flexDirection: 'row', padding: 12, gap: 12 }}>
          <View style={{ width: 62, height: 84, backgroundColor: tc.pap2, borderColor: tc.ink, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {t.images && t.images.length > 0 ? (
              <Image source={shotSource(t.images[0])} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <PixelText variant={txt} size={22}>{isSell ? '🏷' : '🛒'}</PixelText>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ backgroundColor: isSell ? tc.red : tc.blu, borderColor: tc.ink, borderWidth: 2, paddingHorizontal: 6, paddingVertical: 2 }}>
                <PixelText variant={txt} size={8} color={tc.white}>{isSell ? '팝니다' : '삽니다'}</PixelText>
              </View>
              {statusLabel ? (
                <PixelText variant={txt} size={8} color={tc.ink3}>{statusLabel}</PixelText>
              ) : null}
              <View style={{ flex: 1 }} />
              {typeof t.chatCount === 'number' && t.chatCount > 0 ? (
                <PixelText variant={txt} size={8} color={tc.ink3}>💬 {t.chatCount}</PixelText>
              ) : null}
            </View>
            <PixelText variant="ko" size={12} weight="bold" color={tc.ink} numberOfLines={2} style={{ marginTop: 7, lineHeight: 17 }}>
              {t.title}
            </PixelText>
            <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 6 }} numberOfLines={1}>
              {t.place ? `📍 ${t.place} · ` : ''}{t.time}
            </PixelText>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <PixelText variant={txt} size={11} weight="bold" color={tc.grnDk}>{formatPrice(t.price) || '협의'}</PixelText>
              <PixelText variant={txt} size={8} color={tc.ink3}>
                {typeof t.bumpCount === 'number' && t.bumpCount > 0 ? `↑ ${t.bumpCount} · ` : ''}{t.authorName ?? '익명'}
              </PixelText>
            </View>
          </View>
        </View>
      </PixelFrame>
    </Pressable>
  );
}
