/**
 * /events/write — 이벤트(회원 글) 작성. 웹 EventWriteForm 패리티:
 * 말머리(구매/시세파악/오리파구매) + 제목(필수) + 내용 → POST /api/events.
 * 로그인 게이트, 401 시 로그인 이동.
 */
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelButton } from '@/components/PixelButton';
import { InlineLoginGate } from '@/components/InlineLoginGate';
import { useToast } from '@/components/ToastProvider';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { api, ApiError } from '@/lib/apiClient';
import { isAuthenticated } from '@/lib/session';
import { EVENT_CATEGORIES, EVENT_CATEGORY_STYLE, type EventCategory } from '@/lib/events';

export default function EventWrite() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const toast = useToast();
  const [category, setCategory] = useState<EventCategory>('구매');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isAuthenticated()) {
    return (
      <InlineLoginGate
        title="이벤트 글 작성"
        feature="이벤트 글 작성"
        description="이벤트 글 작성은 로그인 후 가능합니다."
        icon="🎉"
      />
    );
  }

  const submit = async () => {
    if (saving) return;
    if (!title.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      await api('/api/events', { method: 'POST', body: { category, title: title.trim(), body: body.trim() } });
      toast.success('이벤트 글이 등록되었습니다');
      router.replace('/events');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push('/login');
        return;
      }
      toast.error(e instanceof Error ? e.message : '등록 실패');
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="이벤트 글 작성" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.gap, gap: 10, paddingBottom: 110 }}>
        <PixelText variant="ko" size={10} color={tc.ink3} style={{ lineHeight: 17 }}>
          🔒 익명 게시가 아닙니다. 게시물에 계정 닉네임이 공개됩니다.
        </PixelText>
        <PixelText variant="ko" size={11} weight="bold">🏷 말머리</PixelText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {EVENT_CATEGORIES.map((c) => {
            const on = category === c;
            const st = EVENT_CATEGORY_STYLE[c];
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: on ? st.background : tc.white, borderColor: tc.ink, borderWidth: 2 }}
              >
                <PixelText variant={txt} size={10} color={on ? st.color : tc.ink3}>{c}</PixelText>
              </Pressable>
            );
          })}
        </View>

        <PixelText variant="ko" size={11} weight="bold">📝 제목</PixelText>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="제목을 입력하세요"
          placeholderTextColor={tc.ink3}
          style={{ backgroundColor: tc.white, borderColor: tc.ink, borderWidth: 3, padding: 12, fontSize: 14, color: tc.ink }}
        />

        <PixelText variant="ko" size={11} weight="bold">📄 내용</PixelText>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="이벤트 내용을 입력하세요"
          placeholderTextColor={tc.ink3}
          style={{ backgroundColor: tc.white, borderColor: tc.ink, borderWidth: 3, padding: 12, fontSize: 14, color: tc.ink, minHeight: 140, textAlignVertical: 'top' }}
        />

        <View style={{ marginTop: 4 }}>
          <PixelButton bg={tc.blu} padding={14} onPress={submit} disabled={saving}>
            <PixelText variant="ko" size={11} color={tc.white} style={{ textAlign: 'center' }}>
              {saving ? '등록 중…' : '이벤트 글 등록'}
            </PixelText>
          </PixelButton>
        </View>
      </ScrollView>
    </View>
  );
}
