/**
 * /messages/[id] — 1:1 쪽지 스레드 (id = peerId).
 * 웹 MessagesThreadScreen 과 동일 로직: GET /api/messages/{peerId} 증분 병합,
 * POST /api/messages 전송(낙관적 추가), ↻ 수동 새로고침, ?trade= 거래글 배너.
 * 내 메시지 판별은 senderId !== peerId (모바일 세션엔 userId 가 없음 — 동치).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { InlineLoginGate } from '@/components/InlineLoginGate';
import { useToast } from '@/components/ToastProvider';
import { colors, space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant, useInputFont } from '@/components/ThemeProvider';
import { api } from '@/lib/apiClient';
import { isAuthenticated, subscribeSession } from '@/lib/session';

interface Msg {
  id: number;
  senderId: string;
  receiverId: string;
  text: string;
  tradeId: number | null;
  readAt: string | null;
  createdAt: string;
}

interface PeerProfile {
  id: string;
  name: string;
  avatarId: string;
  backgroundId: string;
  frameId: string;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function useAuthed(): boolean {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  useEffect(() => subscribeSession(() => setAuthed(isAuthenticated())), []);
  return authed;
}

export default function MessagesThread() {
  // 클린·다크는 시스템 산세리프 — 인풋/placeholder 가 비트맵 폰트로 남지 않게.
  const inputFont = useInputFont();
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const toast = useToast();
  const authed = useAuthed();
  const { id, trade } = useLocalSearchParams<{ id: string; trade?: string }>();
  const peerId = typeof id === 'string' ? id : '';
  const tradeId = typeof trade === 'string' && trade ? trade : null;

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [peer, setPeer] = useState<PeerProfile | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scRef = useRef<ScrollView>(null);
  const loadingRef = useRef(false);
  const sendingRef = useRef(false);

  const loadMessages = useCallback(async () => {
    if (!peerId || loadingRef.current) return;
    loadingRef.current = true;
    setRefreshing(true);
    try {
      const data = await api<{ data: Msg[] }>(`/api/messages/${encodeURIComponent(peerId)}`);
      const incoming = data.data ?? [];
      setMsgs((prev) => {
        if (prev.length === 0) return incoming;
        const seen = new Set(prev.map((m) => m.id));
        const toAdd = incoming.filter((m) => !seen.has(m.id));
        if (toAdd.length === 0) return prev;
        return [...prev, ...toAdd];
      });
    } catch {
      // ignore — 웹과 동일(조용히 무시, 수동 새로고침으로 재시도)
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
    }
  }, [peerId]);

  useEffect(() => {
    if (!authed) return;
    loadMessages();
  }, [authed, loadMessages]);

  useEffect(() => {
    if (!peerId) return;
    let alive = true;
    api<{ user: PeerProfile }>(`/api/users/${encodeURIComponent(peerId)}`, { auth: false })
      .then((r) => alive && r.user && setPeer(r.user))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [peerId]);

  useEffect(() => {
    setTimeout(() => scRef.current?.scrollToEnd({ animated: true }), 100);
  }, [msgs.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const body: Record<string, unknown> = { receiverId: peerId, text };
      if (tradeId) body.tradeId = Number(tradeId);
      const data = await api<{ data: { id: number } }>('/api/messages', { method: 'POST', body });
      setMsgs((m) => [
        ...m,
        {
          id: data.data.id,
          senderId: 'me', // peerId 와 다르기만 하면 mine 으로 렌더됨
          receiverId: peerId,
          text,
          tradeId: tradeId ? Number(tradeId) : null,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setInput('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '전송 실패');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (!authed) {
    return (
      <InlineLoginGate
        title="쪽지"
        feature="쪽지"
        description="쪽지는 로그인 후 이용 가능합니다."
        icon="💬"
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar
        onBack={() => router.back()}
        title={peer?.name ?? '쪽지'}
        right={
          <Pressable onPress={loadMessages} disabled={refreshing} hitSlop={8}>
            <PixelText variant={txt} size={16} color={tc.ink} style={{ opacity: refreshing ? 0.4 : 1 }}>
              ↻
            </PixelText>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {tradeId ? (
          <Pressable
            onPress={() => router.push(`/trade/${tradeId}` as never)}
            style={{
              margin: 14,
              marginBottom: 0,
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: tc.pap2,
              borderColor: tc.ink,
              borderWidth: 2,
              alignItems: 'center',
            }}
          >
            <PixelText variant={txt} size={9} color={tc.ink2} style={{ letterSpacing: 0.3 }}>
              🔗 거래글 #{tradeId} 에 대한 쪽지
            </PixelText>
          </Pressable>
        ) : null}

        <ScrollView ref={scRef} contentContainerStyle={{ padding: space.gap, gap: 8 }}>
          {msgs.length === 0 ? (
            <PixelText variant={txt} size={9} color={tc.ink3} style={{ textAlign: 'center', paddingVertical: 30 }}>
              — 주고받은 쪽지가 없어요 —
            </PixelText>
          ) : (
            msgs.map((m) => {
              const mine = m.senderId !== peerId;
              return (
                <View key={m.id} style={[styles.row, mine ? styles.rowMine : styles.rowPeer]}>
                  {!mine ? (
                    <View style={styles.avatar}>
                      <Text style={{ fontSize: 16 }}>{peerEmoji(peer?.avatarId)}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.bubble, mine ? styles.bubMine : styles.bubPeer]}>
                    <PixelText variant="ko" size={11} color={mine ? tc.white : tc.ink} style={{ lineHeight: 16 }}>
                      {m.text}
                    </PixelText>
                  </View>
                  <PixelText variant={txt} size={7} color={tc.ink3}>
                    {fmtTime(m.createdAt)}
                  </PixelText>
                </View>
              );
            })
          )}
        </ScrollView>
        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="쪽지 입력..."
            placeholderTextColor={tc.ink3}
            style={[styles.input, { fontFamily: inputFont }]}
            onSubmitEditing={send}
            returnKeyType="send"
            maxLength={500}
          />
          <Pressable
            style={[styles.sendBtn, { opacity: sending || !input.trim() ? 0.5 : 1 }]}
            onPress={send}
            disabled={sending || !input.trim()}
          >
            <PixelText variant={txt} size={10} color={tc.white}>
              전송
            </PixelText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** avatarId(예: 'cat')는 앱에 아바타 에셋 합성이 없어 이모지 폴백. */
function peerEmoji(v: string | null | undefined): string {
  if (!v) return '🐣';
  if (/^[\p{Emoji}\p{Extended_Pictographic}]/u.test(v)) return v;
  return '🃏';
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  rowMine: { justifyContent: 'flex-end' },
  rowPeer: { justifyContent: 'flex-start' },
  avatar: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.pap2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '70%',
    padding: 10,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  bubMine: { backgroundColor: colors.red },
  bubPeer: { backgroundColor: colors.white },
  inputBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: colors.paper,
    borderTopWidth: 3,
    borderTopColor: colors.ink,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: colors.ink,
    fontSize: 14,
    fontFamily: 'Galmuri11',
    color: colors.ink,
  },
  sendBtn: {
    backgroundColor: colors.ink,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.ink,
  },
});
