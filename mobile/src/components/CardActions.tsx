import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/apiClient';
import { deleteMyCard } from '@/lib/myApi';
import { loadCollection, removeCard } from '@/lib/collection';
import { useToast } from '@/components/ToastProvider';
import { PixelText } from '@/components/PixelText';
import { PixelPress } from '@/components/cv/PixelPress';
import { CardRegisterSheet, type GradePrices } from '@/components/CardRegisterSheet';
import { useThemeColors, useTheme, useThemeTextVariant } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { colors, fonts } from '@/theme/tokens';

interface Props {
  apparelId: number;
  /** 컬렉션 저장 시 별칭으로 들어갈 카드명 (한국어 우선). */
  cardName?: string;
  /** 등록 시트에 표시할 이미지. */
  imageUrl?: string | null;
  /** 현재시세 (JPY) — 등록 시트 자동 표시/직접뽑기 기준가. */
  currentPriceJpy?: number | null;
  /** 등급별 현재시세 (JPY) — 등록 팝업의 등록가 미리보기용. */
  gradePrices?: GradePrices | null;
}

type Status = 'idle' | 'loading' | 'error';

/**
 * 시세상세 페이지의 액션 줄 — 컬렉션/관심/SNKDUNK 외부 링크.
 * - 마운트 시 /api/me/cards · /api/me/favorites 조회해 ✓ 표시
 * - 성공/실패 시 토스트
 * - 미로그인 (401) 이면 login 라우트로 이동
 */
export function CardActions({ apparelId, cardName, imageUrl, currentPriceJpy, gradePrices }: Props) {
  const [favStatus, setFavStatus] = useState<Status>('idle');
  const [isCollected, setIsCollected] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [authed, setAuthed] = useState(true);
  const toast = useToast();
  const router = useRouter();
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { theme } = useTheme();
  const flat = isFlatTheme(theme);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [favRes, cardRes] = await Promise.all([
          api<{ data?: Array<{ snkrdunkApparelId: number }> }>('/api/me/favorites'),
          api<{ data?: Array<{ id: number; snkrdunkApparelId: number | null }> }>('/api/me/cards'),
        ]);
        if (!alive) return;
        setIsFav((favRes?.data ?? []).some((r) => r.snkrdunkApparelId === apparelId));
        setIsCollected((cardRes?.data ?? []).some((r) => r.snkrdunkApparelId === apparelId));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setAuthed(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [apparelId]);

  const goLogin = () => router.push('/login');

  // 바로 추가하지 않고 "카드 등록" 팝업을 띄운다 — 구매가/직접뽑기/등급 입력 (웹 패리티).
  // 이미 담긴 카드면 제거 확인 → 확인 시 컬렉션에서 제거 후 버튼 원복.
  const openRegisterSheet = () => {
    if (!authed) {
      goLogin();
      return;
    }
    if (isCollected) {
      Alert.alert('내 컬렉션', '내 컬렉션에서 제거하겠습니까?', [
        { text: '취소', style: 'cancel' },
        { text: '확인', style: 'destructive', onPress: removeFromCollection },
      ]);
      return;
    }
    setSheetOpen(true);
  };

  const removeFromCollection = async () => {
    try {
      // 이 카드(apparelId)로 등록된 서버 행을 찾아 전부 삭제.
      const res = await api<{ data?: Array<{ id: number; snkrdunkApparelId: number | null }> }>('/api/me/cards');
      const rows = (res?.data ?? []).filter((r) => r.snkrdunkApparelId === apparelId);
      for (const r of rows) await deleteMyCard(r.id);
      // 로컬 캐시(홈 등)에서도 제거.
      loadCollection()
        .filter((c) => c.snkrdunkApparelId === apparelId)
        .forEach((c) => removeCard(c.id));
      setIsCollected(false);
      toast.success('내 컬렉션에서 제거되었습니다');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        goLogin();
        return;
      }
      toast.error('컬렉션 제거 실패 — 잠시 후 다시 시도해 주세요');
    }
  };

  const toggleFavorite = async () => {
    if (favStatus === 'loading') return;
    setFavStatus('loading');
    const wantOn = !isFav;
    try {
      if (wantOn) {
        await api('/api/me/favorites', {
          method: 'POST',
          body: { snkrdunkApparelId: apparelId },
        });
      } else {
        await api(`/api/me/favorites/${apparelId}`, { method: 'DELETE' });
      }
      setIsFav(wantOn);
      setFavStatus('idle');
      toast.success(wantOn ? '관심카드에 추가되었습니다' : '관심카드에서 제거되었습니다');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        goLogin();
        return;
      }
      setFavStatus('error');
      toast.error(`관심카드 ${wantOn ? '추가' : '제거'} 실패`);
      setTimeout(() => setFavStatus('idle'), 1200);
    }
  };

  const openSnkrdunk = () => {
    Linking.openURL(`https://snkrdunk.com/apparels/${apparelId}`).catch(() => undefined);
  };

  // 웹 CardActions 와 동일 레이아웃: 넓은 [내 컬렉션] 버튼 + 정사각 SNKRDUNK·관심 버튼.
  const collectBg = isCollected ? tc.grn : tc.ink;
  const collectLabel = isCollected ? '내 컬렉션에 담김' : '내 컬렉션에 추가';

  // 등록 팝업 — 웹 cv-sheet-modal 패리티. 저장되면 ✓ 표시로 전환.
  const registerSheet = sheetOpen ? (
    <CardRegisterSheet
      visible={sheetOpen}
      card={{
        apparelId,
        name: cardName ?? '카드',
        imageUrl: imageUrl ?? null,
        currentPriceJpy: currentPriceJpy ?? null,
        gradePrices: gradePrices ?? null,
      }}
      onClose={() => setSheetOpen(false)}
      onSaved={() => setIsCollected(true)}
    />
  ) : null;

  if (flat) {
    // 클린·다크: 라운드 + 라인보더 (웹 그대로).
    return (
      <View style={styles.row}>
        {registerSheet}
        <Pressable onPress={openRegisterSheet} style={[styles.flatWide, { backgroundColor: collectBg }]}>
          <PixelText variant={txt} size={14} weight="bold" color={tc.white}>{isCollected ? '✓' : '＋'}</PixelText>
          <PixelText variant="ko" size={13} weight="bold" color={tc.white} numberOfLines={1}>{collectLabel}</PixelText>
        </Pressable>
        <Pressable onPress={openSnkrdunk} style={[styles.flatSquare, { backgroundColor: tc.white, borderColor: tc.pap3 }]}>
          <PixelText variant={txt} size={15} weight="bold" color={tc.ink}>↗</PixelText>
        </Pressable>
        <Pressable
          onPress={toggleFavorite}
          disabled={favStatus === 'loading'}
          style={[styles.flatSquare, { backgroundColor: isFav ? tc.ornLt ?? tc.white : tc.white, borderColor: isFav ? tc.orn : tc.pap3, opacity: favStatus === 'loading' ? 0.6 : 1 }]}
        >
          <PixelText variant={txt} size={17} color={tc.orn}>{isFav ? '★' : '☆'}</PixelText>
        </Pressable>
      </View>
    );
  }

  // 픽셀: 3D PixelPress 박스 — 동일 레이아웃(넓은 버튼 + 정사각 2개).
  return (
    <View style={styles.row}>
      {registerSheet}
      <View style={styles.flex}>
        <PixelPress onPress={openRegisterSheet} bg={collectBg} borderWidth={3} shadow={4} hi="rgba(255,255,255,0.25)" lo="rgba(0,0,0,0.3)" wrapStyle={styles.flex} innerStyle={styles.wideFace}>
          <Text style={[styles.icon, { color: colors.white }]}>{isCollected ? '✓' : '＋'}</Text>
          <Text style={[styles.label, { color: colors.white }]} numberOfLines={1}>{collectLabel}</Text>
        </PixelPress>
      </View>
      <PixelPress onPress={openSnkrdunk} bg={colors.ink} borderWidth={3} shadow={4} hi="rgba(255,255,255,0.2)" lo="rgba(0,0,0,0.35)" innerStyle={styles.squareFace}>
        <Text style={[styles.icon, styles.gold]}>↗</Text>
      </PixelPress>
      <PixelPress onPress={toggleFavorite} disabled={favStatus === 'loading'} bg={colors.white} borderWidth={3} shadow={4} hi="rgba(255,255,255,0.6)" lo="rgba(0,0,0,0.15)" innerStyle={styles.squareFace}>
        <Text style={[styles.icon, { color: colors.orn }]}>{isFav ? '★' : '☆'}</Text>
      </PixelPress>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 7,
    marginBottom: 12,
    alignItems: 'stretch',
  },
  flex: { flex: 1 },
  // 클린: 라운드 버튼.
  flatWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 14,
  },
  flatSquare: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  // 픽셀: 넓은 버튼 face / 정사각 face.
  wideFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 6 },
  squareFace: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  icon: { color: colors.white, fontSize: 15, lineHeight: 18, flexShrink: 0 },
  label: { fontFamily: fonts.ko, fontSize: 13, fontWeight: '700', letterSpacing: 0.2, includeFontPadding: false, flexShrink: 1 },
  gold: { color: colors.gold },
});
