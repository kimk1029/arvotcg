/**
 * /events/[id] — 이벤트 상세. 웹 src/app/events/[id]/page.tsx 패리티:
 * GET /api/events/{id}, 상태/말머리 배지 + 기간, 이미지, 본문,
 * 댓글(GET/POST /api/events/{id}/comments — 401 시 로그인 안내).
 */
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { LoadingState, ErrorView } from '@/components/cv/ListState';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { api } from '@/lib/apiClient';
import { ReportMenu } from '@/components/ReportMenu';
import { ensureUgcTerms } from '@/components/UgcTermsGate';
import { shotSource } from '@/lib/shotMode';
import {
  EVENT_CATEGORY_STYLE,
  EVENT_STATUS_LABEL,
  eventPeriodLabel,
  eventStatus,
  type EventPost,
} from '@/lib/events';

interface EventComment {
  id: number;
  text: string;
  authorId?: string | null;
  authorName: string;
  createdAt: string;
}

export default function EventDetail() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);

  const [post, setPost] = useState<EventPost | null>(null);
  const [err, setErr] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(postId) || postId <= 0) return;
    setErr(null);
    try {
      const r = await api<{ data: EventPost }>(`/api/events/${postId}`, { auth: false });
      setPost(r.data);
    } catch (e) {
      setErr(e instanceof Error ? e : new Error('불러오기 실패'));
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) {
    return (
      <View style={{ flex: 1, backgroundColor: tc.paper }}>
        <AppBar title="이벤트" onBack={() => router.back()} />
        <View style={{ margin: space.gap }}><ErrorView error={err} onRetry={load} /></View>
      </View>
    );
  }
  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: tc.paper }}>
        <AppBar title="이벤트" onBack={() => router.back()} />
        <View style={{ paddingTop: 40 }}><LoadingState /></View>
      </View>
    );
  }

  const status = eventStatus(post);
  const cat = post.category ? EVENT_CATEGORY_STYLE[post.category] : null;

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="이벤트" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.gap, gap: 12, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {status !== 'always' ? (
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: status === 'ongoing' ? tc.red : tc.pap2 }}>
              <PixelText variant={txt} size={8} weight="bold" color={status === 'ongoing' ? tc.white : status === 'ended' ? tc.ink3 : tc.ink}>
                {EVENT_STATUS_LABEL[status]}
              </PixelText>
            </View>
          ) : null}
          {post.category ? (
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: cat?.background ?? tc.pap2 }}>
              <PixelText variant={txt} size={8} weight="bold" color={cat?.color ?? tc.ink}>{post.category}</PixelText>
            </View>
          ) : null}
          {eventPeriodLabel(post) ? (
            <PixelText variant={txt} size={9} color={tc.ink3}>{eventPeriodLabel(post)}</PixelText>
          ) : null}
          <View style={{ flex: 1 }} />
          <PixelText variant={txt} size={9} color={tc.ink3}>{post.authorName ? `✍ ${post.authorName}` : '공지'}</PixelText>
          {post.authorId ? (
            <ReportMenu
              targetType="eventPost"
              targetId={post.id}
              authorId={post.authorId}
              authorName={post.authorName}
              onBlocked={() => router.back()}
            />
          ) : null}
        </View>

        <PixelText variant="ko" size={16} weight="bold" color={tc.ink} style={{ lineHeight: 23 }}>
          {post.title}
        </PixelText>

        {post.imageUrl ? (
          <Image
            source={shotSource(post.imageUrl)}
            style={{ width: '100%', aspectRatio: 2, backgroundColor: tc.pap2, borderColor: tc.ink, borderWidth: 2 }}
            resizeMode="cover"
          />
        ) : null}

        {post.body ? (
          <View style={{ borderTopWidth: 1, borderTopColor: tc.pap3, paddingTop: 10 }}>
            <PixelText variant="ko" size={13} color={tc.ink} style={{ lineHeight: 22 }}>
              {post.body}
            </PixelText>
          </View>
        ) : null}

        <EventComments postId={post.id} tc={tc} txt={txt} />
      </ScrollView>
    </View>
  );
}

/* ── 댓글 — 웹 EventComments 동일 ── */
function EventComments({ postId, tc, txt }: { postId: number; tc: ReturnType<typeof useThemeColors>; txt: 'pixel' | 'ko' }) {
  const [comments, setComments] = useState<EventComment[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const hideBlockedAuthor = (blockedUserId: string) => {
    setComments((current) => (current ?? []).filter((comment) => comment.authorId !== blockedUserId));
  };

  useEffect(() => {
    let alive = true;
    api<{ data?: EventComment[] }>(`/api/events/${postId}/comments`)
      .then((j) => alive && setComments(j.data ?? []))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [postId]);

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    if (!(await ensureUgcTerms())) return; // 커뮤니티 이용규칙 동의 게이트
    setSending(true);
    setHint(null);
    try {
      const j = await api<{ data: EventComment }>(`/api/events/${postId}/comments`, { method: 'POST', body: { text: t } });
      setComments((prev) => [...(prev ?? []), j.data]);
      setText('');
    } catch (e) {
      const status = e && typeof e === 'object' && 'status' in e ? (e as { status: number }).status : 0;
      setHint(status === 401 ? '댓글을 쓰려면 로그인이 필요해요' : '등록에 실패했어요. 잠시 후 다시 시도해주세요');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ marginTop: 6 }}>
      <PixelText variant={txt} size={11} weight="bold" color={tc.ink}>
        댓글 {comments ? comments.length : '…'}
      </PixelText>
      {(comments ?? []).map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', gap: 7, marginTop: 9, alignItems: 'flex-start' }}>
          <PixelText variant="ko" size={11} weight="bold" color={tc.ink}>{c.authorName}</PixelText>
          <PixelText variant="ko" size={11} color={tc.ink2} style={{ flex: 1, lineHeight: 16 }}>{c.text}</PixelText>
          <ReportMenu targetType="eventPostComment" targetId={c.id} authorId={c.authorId} authorName={c.authorName} onBlocked={hideBlockedAuthor} size={13} />
        </View>
      ))}
      {hint ? (
        <PixelText variant={txt} size={9} color={tc.red} style={{ marginTop: 8 }}>{hint}</PixelText>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: tc.pap2, borderColor: tc.ink, borderWidth: 2, paddingHorizontal: 10 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="댓글 달기..."
          placeholderTextColor={tc.ink3}
          style={{ flex: 1, paddingVertical: 9, fontSize: 13, color: tc.ink }}
          maxLength={300}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable onPress={submit} disabled={sending || !text.trim()} hitSlop={6}>
          <PixelText variant={txt} size={10} weight="bold" color={sending || !text.trim() ? tc.ink3 : tc.blu}>등록</PixelText>
        </Pressable>
      </View>
    </View>
  );
}
