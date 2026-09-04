/**
 * 관심카드 — 내 자산(my/cards) '관심카드' 탭과 /my/favorites 가 함께 쓰는 단일 화면.
 *
 * 두 진입점이 서로 다른 화면을 보여주던 것을 하나로 합쳤다. 기본은 리스트형
 * (내 자산 탭에서 쓰던 행 — 이름·시세·전일 등락), 우측 상단 아이콘으로 바둑판(그리드)
 * 전환. 웹 src/components/screens/FavoritesView 와 페어.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { PixelText } from '@/components/PixelText';
import { EmptyState, LoadingState } from '@/components/cv/ListState';
import { SnkrdunkCardTile } from '@/components/cv/SnkrdunkCardTile';
import { ThumbImage } from '@/components/cv/ThumbImage';
import { useCurrency } from '@/components/CurrencyProvider';
import { useToast } from '@/components/ToastProvider';
import { space } from '@/theme/tokens';
import { useTheme, useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { fetchMyFavorites, removeFavorite, type MyFavoriteRow } from '@/lib/myApi';
import { getString, setString } from '@/lib/kvStore';

type ViewMode = 'list' | 'grid';

/** 보기 모드는 화면을 옮겨다녀도 유지 — 두 진입점이 같은 값을 쓴다 (웹 localStorage 페어). */
const VIEW_KEY = 'pf30:favView';

export function FavoritesView() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const flat = isFlatTheme(useTheme().theme);
  const { format } = useCurrency();
  const toast = useToast();

  const [rows, setRows] = useState<MyFavoriteRow[] | null>(null);
  const [view, setView] = useState<ViewMode>(() => (getString(VIEW_KEY) === 'grid' ? 'grid' : 'list'));

  useEffect(() => {
    let alive = true;
    fetchMyFavorites().then((r) => alive && setRows(r)).catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  const changeView = (v: ViewMode) => {
    setView(v);
    setString(VIEW_KEY, v);
  };

  const onRemove = (apparelId: number) => {
    Alert.alert('관심카드 제거', '이 카드를 관심카드에서 제거할까요?', [
      { text: '취소' },
      {
        text: '제거',
        style: 'destructive',
        onPress: async () => {
          const prev = rows ?? [];
          setRows(prev.filter((r) => r.snkrdunkApparelId !== apparelId));
          try {
            await removeFavorite(apparelId);
            toast.success('관심카드에서 제거되었습니다');
          } catch {
            setRows(prev);
            toast.error('제거 실패');
          }
        },
      },
    ]);
  };

  if (rows === null) {
    return <View style={{ paddingTop: 30 }}><LoadingState /></View>;
  }
  if (rows.length === 0) {
    return (
      <View style={{ marginHorizontal: 14, marginTop: 30 }}>
        <EmptyState
          icon="⭐"
          title="관심카드가 없어요"
          desc="시세 상세 페이지의 [관심카드] 버튼으로 추가하세요."
          ctaLabel="가격 탐색"
          onCtaPress={() => router.push('/cards/packs' as never)}
        />
      </View>
    );
  }

  const total = rows.reduce((s, r) => s + r.minPriceJpy, 0);
  const open = (apparelId: number) => router.push(`/cards/snkrdunk/${apparelId}` as never);

  return (
    <View style={{ paddingHorizontal: space.gap }}>
      {/* 요약 + 보기 전환 (우측 상단) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <PixelText variant="ko" size={9} color={tc.ink3} style={{ flex: 1, lineHeight: 15 }}>
          {`${rows.length}개 · 합산 시세 ${format(total)} · 자산 합계엔 포함되지 않아요`}
        </PixelText>
        <View style={{ flexDirection: 'row', gap: 4, backgroundColor: tc.pap2, borderRadius: 8, padding: 3 }}>
          {(['list', 'grid'] as ViewMode[]).map((v) => {
            const on = view === v;
            const stroke = on ? tc.ink : tc.ink3;
            return (
              <Pressable
                key={v}
                onPress={() => changeView(v)}
                style={{ width: 30, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? tc.white : 'transparent' }}
              >
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

      {view === 'grid' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {rows.map((r) => (
            <View
              key={r.id}
              style={{ width: '31%', backgroundColor: tc.white, borderWidth: flat ? 1 : 3, borderColor: flat ? tc.pap3 : tc.ink, borderRadius: flat ? 12 : 0, overflow: 'hidden', marginBottom: 8 }}
            >
              <SnkrdunkCardTile
                plainPress
                onPress={() => open(r.snkrdunkApparelId)}
                imageUrl={r.imageUrl}
                koName={r.name ?? '(이름 없음)'}
                priceText={r.minPriceJpy > 0 ? format(r.minPriceJpy) : null}
                priceChip
                thumbAspect={63 / 88}
                nameSize={10}
                nameBold={false}
                infoPadding={7}
                emojiSize={29}
              />
              <Pressable onPress={() => onRemove(r.snkrdunkApparelId)} style={{ paddingVertical: 5, alignItems: 'center', borderTopWidth: flat ? 1 : 2, borderTopColor: flat ? tc.pap3 : tc.ink }}>
                <PixelText variant={txt} size={9} color={tc.red}>✕ 제거</PixelText>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map((r) => {
            const pct = r.changePct ?? null;
            const up = (pct ?? 0) >= 0;
            return (
              <Pressable
                key={r.id}
                onPress={() => open(r.snkrdunkApparelId)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: tc.white, borderRadius: 14,
                  paddingVertical: 10, paddingLeft: 12, paddingRight: 4,
                }}
              >
                <ThumbImage uri={r.imageUrl} style={{ width: 44, height: 60, borderRadius: 7 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <PixelText variant={txt} size={11} color={tc.ink} numberOfLines={1}>
                    {r.name ?? '(이름 없음)'}
                  </PixelText>
                  <PixelText variant="ko" size={9} color={tc.ink3} style={{ marginTop: 3 }}>
                    {new Date(r.createdAt).toLocaleDateString('ko-KR')} 추가
                  </PixelText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <PixelText variant={txt} size={11} color={tc.ink}>
                    {r.minPriceJpy > 0 ? format(r.minPriceJpy) : '시세 없음'}
                  </PixelText>
                  <PixelText variant={txt} size={10} color={pct == null ? tc.ink3 : up ? tc.red : tc.blu} style={{ marginTop: 3 }}>
                    {pct == null ? '등락 —' : `${up ? '+' : ''}${pct.toFixed(1)}% ${up ? '▲' : '▼'}`}
                  </PixelText>
                </View>
                <Pressable onPress={() => onRemove(r.snkrdunkApparelId)} hitSlop={8} style={{ width: 26, alignItems: 'center' }}>
                  <PixelText variant={txt} size={12} color={tc.ink3}>✕</PixelText>
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
