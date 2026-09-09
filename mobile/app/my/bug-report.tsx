/**
 * 버그 제보 — 사용자는 작성만 하고, 접수된 제보 목록은 어드민만 본다.
 * 웹 src/app/my/bug-report + BugReportForm 과 같은 필드·같은 엔드포인트.
 */
import { useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { useToast } from '@/components/ToastProvider';
import { useThemeColors } from '@/components/ThemeProvider';
import { space } from '@/theme/tokens';
import { postBugReport } from '@/lib/myApi';
import { APP_VERSION } from '../../../shared/version';

export default function BugReportScreen() {
  const tc = useThemeColors();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (title.trim().length < 2) return toast.error('제목을 2자 이상 입력해 주세요');
    if (content.trim().length < 5) return toast.error('내용을 5자 이상 입력해 주세요');
    setBusy(true);
    try {
      await postBugReport({
        title: title.trim(),
        content: content.trim(),
        contact: contact.trim() || null,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: APP_VERSION,
      });
      setTitle('');
      setContent('');
      setContact('');
      toast.success('제보가 접수되었습니다. 감사합니다!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '전송에 실패했어요');
    } finally {
      setBusy(false);
    }
  };

  const input = {
    backgroundColor: tc.white,
    borderColor: tc.pap3,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 13.5,
    color: tc.ink,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="버그 제보" />
      <ScrollView contentContainerStyle={{ padding: space.gap, paddingBottom: 120, gap: 14 }} keyboardShouldPersistTaps="handled">
        <PixelText variant="ko" size={12} color={tc.ink3} style={{ lineHeight: 20 }}>
          앱에서 발견한 오류나 이상한 점을 알려주세요. 어떤 화면에서 무엇을 했을 때 생겼는지 적어주시면
          빠르게 고칠 수 있어요. 접수된 제보는 운영자만 확인합니다.
        </PixelText>

        <View style={{ gap: 6 }}>
          <PixelText variant="ko" size={12} weight="bold" color={tc.ink}>제목</PixelText>
          <TextInput
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, 100))}
            placeholder="예) 시세 상세에서 가격이 안 보여요"
            placeholderTextColor={tc.ink3}
            style={input}
          />
        </View>

        <View style={{ gap: 6 }}>
          <PixelText variant="ko" size={12} weight="bold" color={tc.ink}>내용</PixelText>
          <TextInput
            value={content}
            onChangeText={(v) => setContent(v.slice(0, 4000))}
            placeholder={'어떤 화면에서 / 무엇을 눌렀을 때 / 어떻게 됐는지\n(기기·OS 버전을 함께 적어주시면 더 좋아요)'}
            placeholderTextColor={tc.ink3}
            multiline
            numberOfLines={8}
            style={{ ...input, minHeight: 160, textAlignVertical: 'top' }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <PixelText variant="ko" size={12} weight="bold" color={tc.ink}>답장 받을 연락처 (선택)</PixelText>
          <TextInput
            value={contact}
            onChangeText={(v) => setContact(v.slice(0, 120))}
            placeholder="이메일 또는 카카오 ID"
            placeholderTextColor={tc.ink3}
            autoCapitalize="none"
            style={input}
          />
        </View>

        <Pressable
          onPress={submit}
          disabled={busy}
          style={{ marginTop: 4, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: busy ? tc.pap3 : tc.ink }}
        >
          <PixelText variant="ko" size={14} weight="bold" color={busy ? tc.ink3 : tc.white}>
            {busy ? '보내는 중…' : '제보 보내기'}
          </PixelText>
        </Pressable>
      </ScrollView>
    </View>
  );
}
