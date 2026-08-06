/**
 * 커뮤니티 글 작성 — 웹 WriteScreen(mode='feed') 패리티.
 * 본문 필수 → POST /api/feeds { text, avatarId, images? }. 사진 최대 3장
 * (/api/upload/feed-images). userCardId 프리필(내 카드 자랑), 로그인 게이트,
 * 작성 리워드 안내(+REWARDS.feed_general P).
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelButton } from '@/components/PixelButton';
import { InlineLoginGate } from '@/components/InlineLoginGate';
import { colors, space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { api, ApiError } from '@/lib/apiClient';
import { useToast } from '@/components/ToastProvider';
import { uploadFeedImages } from '@/lib/uploads';
import { fetchInventory } from '@/lib/myApi';
import { REWARDS } from '@/lib/rewards';
import { DEFAULT_FEED_CATEGORY, FEED_CATEGORIES, type FeedCategory } from '@/lib/feedCategories';
import { isAuthenticated, subscribeSession } from '@/lib/session';

const MAX_IMAGES = 3;

interface UserCardRow {
  id: number;
  cardId: string | null;
  nickname: string | null;
  snkrdunkName?: string | null;
  gradeEstimate: string | null;
}

function useAuthed(): boolean {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  useEffect(() => subscribeSession(() => setAuthed(isAuthenticated())), []);
  return authed;
}

export default function WriteFeed() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const toast = useToast();
  const authed = useAuthed();
  const { userCardId } = useLocalSearchParams<{ userCardId?: string }>();

  const [note, setNote] = useState('');
  const [category, setCategory] = useState<FeedCategory>(DEFAULT_FEED_CATEGORY);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [avatarId, setAvatarId] = useState('');

  // 웹은 useInventory 로 avatarId 를 body 에 포함 — 동일하게 전송.
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    fetchInventory()
      .then((r) => alive && setAvatarId(r.inventory.avatar))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [authed]);

  // userCardId 프리필 — 웹 resolvePrefill 동일: "{이름}{(등급)} 자랑하러 왔어요 🃏"
  useEffect(() => {
    const id = Number(typeof userCardId === 'string' ? userCardId : '');
    if (!authed || !Number.isFinite(id) || id <= 0) return;
    let alive = true;
    api<{ data: UserCardRow }>(`/api/me/cards/${id}`)
      .then((r) => {
        if (!alive || !r.data) return;
        const name = r.data.nickname || r.data.snkrdunkName || '내 카드';
        const grade = r.data.gradeEstimate ? ` (${r.data.gradeEstimate})` : '';
        setNote((prev) => prev || `${name}${grade} 자랑하러 왔어요 🃏\n`);
        setCategory('자랑');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [authed, userCardId]);

  const pickImages = useCallback(async () => {
    if (uploading || images.length >= MAX_IMAGES) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.7,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const urls = await uploadFeedImages(result.assets.map((a) => a.uri));
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
    if (!note.trim()) {
      toast.error('내용을 입력해주세요');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/feeds', {
        method: 'POST',
        body: {
          text: note.trim(),
          avatarId: avatarId || undefined,
          category,
          images: images.length > 0 ? images : undefined,
        },
      });
      toast.success('글이 등록되었습니다');
      router.replace('/feed');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push('/login');
        return;
      }
      toast.error(e instanceof Error ? e.message : '등록 실패');
      setSubmitting(false);
    }
  }, [submitting, uploading, note, avatarId, category, images, toast]);

  if (!authed) {
    return (
      <InlineLoginGate
        title="커뮤니티 글 작성"
        feature="글 작성"
        description="글 작성은 로그인 후 가능합니다."
        icon="✍️"
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="커뮤니티 글 작성" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.gap, gap: 10, paddingBottom: 110 }}>
        {/* 카테고리 — 웹 WriteScreen 동일 */}
        <PixelText variant="ko" size={11} weight="bold">
          🏷 카테고리
        </PixelText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FEED_CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: on ? tc.ink : tc.white,
                  borderWidth: 2,
                  borderColor: tc.ink,
                }}
              >
                <PixelText variant="ko" size={11} weight="bold" color={on ? tc.white : tc.ink2}>
                  {c}
                </PixelText>
              </Pressable>
            );
          })}
        </View>

        {/* 내용 */}
        <PixelText variant="ko" size={11} weight="bold">
          🗣 하고 싶은 말
        </PixelText>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="자유롭게 입력하세요"
          placeholderTextColor={tc.ink3}
          style={[styles.input, { minHeight: 160, textAlignVertical: 'top' }]}
        />

        {/* 사진 */}
        <PixelText variant="ko" size={11} weight="bold">
          📷 사진 첨부 (선택, 최대 {MAX_IMAGES}장 · 펼쳐야 보임)
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

        {/* 리워드 안내 — 웹 동일 */}
        <View style={{ backgroundColor: tc.pap2, borderColor: tc.ink, borderWidth: 2, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' }}>
          <PixelText variant={txt} size={9} color={tc.ink2} style={{ letterSpacing: 0.3 }}>
            🪙 작성 시 +{REWARDS.feed_general}P 지급
          </PixelText>
        </View>

        {/* 등록 */}
        <View style={{ marginTop: 4 }}>
          <PixelButton bg={tc.yel} padding={14} onPress={submit} disabled={submitting}>
            <PixelText variant="ko" size={11} color={tc.ink} style={{ textAlign: 'center' }}>
              {submitting ? '등록 중…' : '글 올리기'}
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
