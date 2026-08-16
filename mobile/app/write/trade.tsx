import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelButton } from '@/components/PixelButton';
import { colors, space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { api, ApiError } from '@/lib/apiClient';
import { useToast } from '@/components/ToastProvider';
import { uploadTradeImages } from '@/lib/uploads';
import { fetchInventory } from '@/lib/myApi';
import { REWARDS } from '@/lib/rewards';

const MAX_IMAGES = 5;
type TradeType = 'sell' | 'buy';

/**
 * 거래글 작성 — 웹 WriteScreen(trade) 과 동일 구성(유형/제목/가격/카카오/사진/내용).
 * 만남장소는 제거(웹과 동일). 백엔드가 placeId 필수라 첫 장소를 기본값으로 전송.
 * userCardId 프리필·avatarId 전송·리워드 안내도 웹 동일.
 */
export default function WriteTrade() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const toast = useToast();
  // 내 컬렉션에서 카드 [거래] 로 들어오면 카드명이 title 로 넘어온다 → 제목 기본값.
  const { title: titleParam, userCardId } = useLocalSearchParams<{ title?: string; userCardId?: string }>();
  const [ttype, setTtype] = useState<TradeType>('sell');
  const [title, setTitle] = useState(typeof titleParam === 'string' ? titleParam : '');
  const [price, setPrice] = useState('');
  const [kakaoId, setKakaoId] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [placeId, setPlaceId] = useState('');
  const [avatarId, setAvatarId] = useState('');

  // 만남장소 UI 없음 — 백엔드 placeId 필수라 첫 장소를 기본값으로.
  useEffect(() => {
    let alive = true;
    api<{ data?: { id: string }[] }>('/api/places')
      .then((r) => {
        if (alive) setPlaceId(r?.data?.[0]?.id ?? '');
      })
      .catch(() => undefined);
    fetchInventory()
      .then((r) => alive && setAvatarId(r.inventory.avatar))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // userCardId 프리필 — 웹 resolvePrefill 동일: 제목 "[판매] {이름} · {등급}" + 본문 memo.
  useEffect(() => {
    const id = Number(typeof userCardId === 'string' ? userCardId : '');
    if (!Number.isFinite(id) || id <= 0) return;
    let alive = true;
    api<{ data: { nickname: string | null; snkrdunkName?: string | null; gradeEstimate: string | null; memo: string | null } }>(`/api/me/cards/${id}`)
      .then((r) => {
        if (!alive || !r.data) return;
        const name = r.data.nickname || r.data.snkrdunkName || '내 카드';
        const grade = r.data.gradeEstimate ? ` · ${r.data.gradeEstimate}` : '';
        setTitle((prev) => prev || `[판매] ${name}${grade}`);
        if (r.data.memo) setNote((prev) => prev || r.data.memo || '');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [userCardId]);

  const pickImages = useCallback(async () => {
    if (uploading || images.length >= MAX_IMAGES) return;
    // 시스템 사진 접근 권한 팝업이 뜨도록 명시 요청 (write/feed 동일 — 심사 데모 노출용).
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.7,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const urls = await uploadTradeImages(result.assets.map((a) => a.uri));
      setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '사진 업로드 실패');
    } finally {
      setUploading(false);
    }
  }, [uploading, images.length, toast]);

  const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url));

  const submit = useCallback(async () => {
    if (submitting || uploading) return;
    if (!title.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/trades', {
        method: 'POST',
        body: {
          placeId: placeId || undefined,
          type: ttype,
          title: title.trim(),
          body: note.trim(),
          price: price.trim(),
          kakaoId: kakaoId.trim() || undefined,
          avatarId: avatarId || undefined,
          images: images.length > 0 ? images : undefined,
        },
      });
      toast.success('거래글이 등록되었습니다');
      router.replace('/trade');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push('/login');
        return;
      }
      toast.error(e instanceof Error ? e.message : '거래글 등록 실패');
      setSubmitting(false);
    }
  }, [submitting, uploading, title, note, price, kakaoId, ttype, placeId, images, toast]);

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="거래 쓰기" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.gap, gap: 10, paddingBottom: 110 }}>
        {/* 유형 */}
        <PixelText variant="ko" size={11} weight="bold">
          📦 유형
        </PixelText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PixelButton bg={ttype === 'sell' ? tc.red : tc.white} padding={12} onPress={() => setTtype('sell')}>
              <PixelText variant="ko" size={11} color={ttype === 'sell' ? tc.white : tc.ink} style={{ textAlign: 'center' }}>
                ❤️ 팝니다
              </PixelText>
            </PixelButton>
          </View>
          <View style={{ flex: 1 }}>
            <PixelButton bg={ttype === 'buy' ? tc.blu : tc.white} padding={12} onPress={() => setTtype('buy')}>
              <PixelText variant="ko" size={11} color={ttype === 'buy' ? tc.white : tc.ink} style={{ textAlign: 'center' }}>
                💙 삽니다
              </PixelText>
            </PixelButton>
          </View>
        </View>

        {/* 제목 */}
        <PixelText variant="ko" size={11} weight="bold">
          📝 제목
        </PixelText>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="거래 제목을 입력하세요"
          placeholderTextColor={tc.ink3}
          style={styles.input}
        />

        {/* 가격 */}
        <PixelText variant="ko" size={11} weight="bold">
          💰 가격
        </PixelText>
        <TextInput
          value={price}
          onChangeText={(raw) => {
            const d = raw.replace(/,/g, '');
            if (/^\d+$/.test(d)) setPrice(Number(d).toLocaleString('ko-KR'));
            else setPrice(raw);
          }}
          placeholder="예) 15,000 / 정가 / 협의"
          placeholderTextColor={tc.ink3}
          inputMode="numeric"
          style={styles.input}
        />

        {/* 카카오 */}
        <PixelText variant="ko" size={11} weight="bold">
          💬 카카오톡 ID / 오픈채팅 (선택)
        </PixelText>
        <TextInput
          value={kakaoId}
          onChangeText={setKakaoId}
          placeholder="예) kakao_id 또는 오픈채팅 링크"
          placeholderTextColor={tc.ink3}
          autoCapitalize="none"
          style={styles.input}
        />

        {/* 사진 */}
        <PixelText variant="ko" size={11} weight="bold">
          📷 상품 사진 (선택, 최대 {MAX_IMAGES}장)
        </PixelText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {images.map((url) => (
            <View key={url} style={{ position: 'relative' }}>
              <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" />
              <Pressable onPress={() => removeImage(url)} hitSlop={8} style={styles.removeBtn}>
                <Text style={{ color: tc.white, fontSize: 13, lineHeight: 14 }}>×</Text>
              </Pressable>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <Pressable onPress={pickImages} disabled={uploading} style={styles.addPhoto}>
              {uploading ? (
                <ActivityIndicator color={tc.ink} />
              ) : (
                <PixelText variant={txt} size={9} color={tc.ink3}>
                  ＋ 사진
                </PixelText>
              )}
            </Pressable>
          )}
        </View>

        {/* 내용 */}
        <PixelText variant="ko" size={11} weight="bold">
          📄 내용
        </PixelText>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="거래 관련 상세 내용"
          placeholderTextColor={tc.ink3}
          style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
        />

        {/* 리워드 안내 — 웹 동일 */}
        <View style={{ backgroundColor: tc.pap2, borderColor: tc.ink, borderWidth: 2, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' }}>
          <PixelText variant={txt} size={9} color={tc.ink2} style={{ letterSpacing: 0.3 }}>
            🪙 작성 시 +{REWARDS.trade_post}P 지급 · 거래 완료 시 +{REWARDS.trade_done}P
          </PixelText>
        </View>

        {/* 등록 */}
        <View style={{ marginTop: 4 }}>
          <PixelButton bg={tc.blu} padding={14} onPress={submit} disabled={submitting}>
            <PixelText variant="ko" size={11} color={tc.white} style={{ textAlign: 'center' }}>
              {submitting ? '등록 중…' : '거래글 등록'}
            </PixelText>
          </PixelButton>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.white,
    padding: 12,
    borderWidth: 3,
    borderColor: colors.ink,
    fontSize: 14,
    fontFamily: 'Galmuri11',
    color: colors.ink,
  },
  thumb: {
    width: 76,
    height: 76,
    borderColor: colors.ink,
    borderWidth: 2,
    backgroundColor: colors.pap2,
  },
  addPhoto: {
    width: 76,
    height: 76,
    borderColor: colors.ink,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
