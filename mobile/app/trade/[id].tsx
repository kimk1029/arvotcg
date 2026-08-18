/**
 * /trade/[id] — 거래글 상세. 웹 src/app/trade/[id]/page.tsx 패리티:
 * GET /api/trades/{id} + 작성자 판별(내 summary) + inbound-check(작성자),
 * 상태 라벨, 이미지 그리드, 북마크, 1:1 쪽지(비작성자), 카카오 버튼,
 * 끌어올리기(bump, 최대 3회), 상태변경(거래중/예약/완료 — 쪽지 수신 전 완료 불가).
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { LoadingState, ErrorView } from '@/components/cv/ListState';
import { useToast } from '@/components/ToastProvider';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { api } from '@/lib/apiClient';
import { fetchMySummary } from '@/lib/myApi';
import { ReportMenu } from '@/components/ReportMenu';
import { formatPrice } from '@/lib/numberFormat';
import { REWARDS } from '@/lib/rewards';
import { isAuthenticated } from '@/lib/session';
import { shotSource } from '@/lib/shotMode';

type TradeStatus = 'open' | 'reserved' | 'done' | 'cancelled';

interface TradeDetail {
  id: number;
  type: 'sell' | 'buy';
  status: TradeStatus;
  title: string;
  body: string;
  place: string;
  time: string;
  price: string;
  kakaoId?: string | null;
  bumpCount?: number;
  authorId?: string | null;
  authorName?: string;
  authorEmoji: string;
  images?: string[];
}

const STATUS_LABEL: Record<string, string> = {
  open: '거래 중',
  reserved: '예약 중',
  done: '거래 완료',
  cancelled: '취소됨',
};

const BUMP_MAX = 3;

export default function TradeDetailScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tradeId = Number(id);

  const [trade, setTrade] = useState<TradeDetail | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [canComplete, setCanComplete] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(tradeId) || tradeId <= 0) return;
    setErr(null);
    try {
      const r = await api<{ data: TradeDetail }>(`/api/trades/${tradeId}`, { auth: false });
      setTrade(r.data);
    } catch (e) {
      setErr(e instanceof Error ? e : new Error('불러오기 실패'));
    }
  }, [tradeId]);

  useEffect(() => {
    load();
    if (isAuthenticated()) {
      fetchMySummary()
        .then((s) => setMyId(s.user.id))
        .catch(() => undefined);
    }
  }, [load]);

  const isAuthor = !!myId && !!trade?.authorId && myId === trade.authorId;

  // 작성자면 쪽지 수신 여부(완료 가능 조건) 조회 — 웹 inbound-check 동일.
  useEffect(() => {
    if (!isAuthor || !trade) return;
    let alive = true;
    api<{ hasInboundMessage: boolean }>(`/api/trades/${trade.id}/inbound-check`)
      .then((r) => alive && setCanComplete(r.hasInboundMessage ?? false))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isAuthor, trade]);

  if (err) {
    return (
      <View style={{ flex: 1, backgroundColor: tc.paper }}>
        <AppBar title="거래글" onBack={() => router.back()} />
        <View style={{ margin: space.gap }}><ErrorView error={err} onRetry={load} /></View>
      </View>
    );
  }
  if (!trade) {
    return (
      <View style={{ flex: 1, backgroundColor: tc.paper }}>
        <AppBar title="거래글" onBack={() => router.back()} />
        <View style={{ paddingTop: 40 }}><LoadingState /></View>
      </View>
    );
  }

  const isSell = trade.type === 'sell';

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="거래글" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.gap, gap: 12, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* 태그 + 상태 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ backgroundColor: isSell ? tc.red : tc.blu, borderColor: tc.ink, borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3 }}>
            <PixelText variant={txt} size={9} color={tc.white}>{isSell ? '팝니다' : '삽니다'}</PixelText>
          </View>
          {trade.place ? (
            <View style={{ backgroundColor: tc.pap2, borderColor: tc.ink, borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3 }}>
              <PixelText variant={txt} size={9} color={tc.ink}>📍 {trade.place}</PixelText>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <PixelText variant={txt} size={9} color={tc.ink3}>{STATUS_LABEL[trade.status] ?? trade.status}</PixelText>
        </View>

        {/* 제목 */}
        <PixelText variant="ko" size={16} weight="bold" color={tc.ink} style={{ lineHeight: 23 }}>
          {trade.title}
        </PixelText>

        {/* 작성자 + 가격 + 북마크 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tc.pap2, borderColor: tc.ink, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>{emojiOf(trade.authorEmoji)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PixelText variant="ko" size={12} weight="bold" color={tc.ink} numberOfLines={1}>
              {trade.authorName ?? '-'}
            </PixelText>
            <PixelText variant={txt} size={9} color={tc.ink3} style={{ marginTop: 3 }}>{trade.time}</PixelText>
          </View>
          <PixelText variant={txt} size={14} weight="bold" color={tc.grnDk}>{formatPrice(trade.price) || '협의'}</PixelText>
          <TradeBookmark tradeId={trade.id} />
          {!isAuthor ? (
            <ReportMenu
              targetType="trade"
              targetId={trade.id}
              authorId={trade.authorId}
              authorName={trade.authorName}
              onBlocked={() => router.back()}
            />
          ) : null}
        </View>

        {/* 이미지 그리드 */}
        {trade.images && trade.images.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
            {trade.images.map((url) => (
              <Pressable key={url} onPress={() => setZoom(url)} style={{ width: '48%', aspectRatio: 1, borderColor: tc.ink, borderWidth: 2, backgroundColor: tc.pap2, overflow: 'hidden' }}>
                <Image source={shotSource(url)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* 본문 */}
        {trade.body ? (
          <View style={{ borderTopWidth: 1, borderTopColor: tc.pap3, paddingTop: 12 }}>
            <PixelText variant="ko" size={13} color={tc.ink} style={{ lineHeight: 22 }}>
              {trade.body}
            </PixelText>
          </View>
        ) : null}

        {/* 비작성자: 1:1 쪽지 */}
        {!isAuthor && trade.authorId ? (
          <Pressable
            onPress={() => router.push(`/messages/${trade.authorId}?trade=${trade.id}` as never)}
            style={{ backgroundColor: tc.ink, paddingVertical: 13, alignItems: 'center', borderColor: tc.ink, borderWidth: 2 }}
          >
            <PixelText variant={txt} size={11} color={tc.gold}>✉ 1:1 쪽지 보내기 ▶</PixelText>
          </Pressable>
        ) : null}

        {/* 카카오 버튼 */}
        {trade.kakaoId ? <KakaoButton kakaoId={trade.kakaoId} /> : null}

        {/* 작성자: 끌올 + 상태 변경 */}
        {isAuthor ? (
          <>
            <BumpButton tradeId={trade.id} initialCount={trade.bumpCount ?? 0} />
            <TradeStatusActions
              tradeId={trade.id}
              status={trade.status}
              canComplete={canComplete}
              onChanged={(next) => {
                setTrade((t) => (t ? { ...t, status: next } : t));
                toast.success(next === 'done' ? `거래 완료 · +${REWARDS.trade_done}P 획득` : `"${STATUS_LABEL[next]}" 로 변경`);
              }}
            />
          </>
        ) : null}
      </ScrollView>

      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable onPress={() => setZoom(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}>
          {zoom ? <Image source={shotSource(zoom)} style={{ width: '94%', height: '80%' }} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function emojiOf(v: string | null | undefined): string {
  if (!v) return '🙂';
  if (/^[\p{Emoji}\p{Extended_Pictographic}]/u.test(v)) return v;
  return '🙂';
}

/* ── 북마크 — 웹 BookmarkButton(tradeId) 동일 ── */
function TradeBookmark({ tradeId }: { tradeId: number }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api<{ bookmarked: boolean }>('/api/bookmarks', { method: 'POST', body: { tradeId } });
      setBookmarked(r.bookmarked);
    } catch {
      // 미로그인 등 — 웹과 동일하게 조용히 무시
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable onPress={toggle} hitSlop={6} style={{ padding: 4, opacity: busy ? 0.5 : 1 }}>
      <Text style={{ fontSize: 18 }}>{bookmarked ? '💛' : '🤍'}</Text>
    </Pressable>
  );
}

/* ── 카카오 — 오픈채팅 링크는 열기, ID 는 표시(앱엔 클립보드 모듈 없음) ── */
function KakaoButton({ kakaoId }: { kakaoId: string }) {
  const isOpenChat = /^https?:\/\//.test(kakaoId);
  const onPress = () => {
    if (isOpenChat) {
      Linking.openURL(kakaoId).catch(() => {});
      return;
    }
    Alert.alert('카카오톡 ID', `${kakaoId}\n\n카카오톡에서 검색해주세요.`);
  };
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: '#FEE500', borderColor: '#16161a', borderWidth: 2, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: '#16161a' }}>
        💬 {isOpenChat ? '오픈채팅으로 연락하기' : `카카오톡 ID: ${kakaoId}`}
      </Text>
      <Text style={{ fontSize: 13, color: '#16161a' }}>{isOpenChat ? '↗' : '👁'}</Text>
    </Pressable>
  );
}

/* ── 끌어올리기 — 웹 BumpButton 동일: POST /api/trades/{id}/bump, 최대 3회 ── */
function BumpButton({ tradeId, initialCount }: { tradeId: number; initialCount: number }) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const remaining = BUMP_MAX - count;
  const bump = async () => {
    if (busy || remaining <= 0) return;
    setBusy(true);
    try {
      const r = await api<{ bumpCount: number }>(`/api/trades/${tradeId}/bump`, { method: 'POST' });
      setCount(r.bumpCount);
    } catch {
      // ignore — 웹 동일
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable
      onPress={bump}
      disabled={busy || remaining <= 0}
      style={{
        backgroundColor: remaining > 0 ? tc.blu : tc.pap3,
        borderColor: tc.ink,
        borderWidth: 2,
        paddingVertical: 11,
        alignItems: 'center',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <PixelText variant={txt} size={10} color={remaining > 0 ? tc.white : tc.ink3}>
        ⬆ 최신화하기 ({remaining > 0 ? `${remaining}회 남음` : '횟수 소진'})
      </PixelText>
    </Pressable>
  );
}

/* ── 상태 변경 — 웹 TradeStatusActions 동일: PATCH /api/trades/{id}/status ── */
function TradeStatusActions({
  tradeId,
  status,
  canComplete,
  onChanged,
}: {
  tradeId: number;
  status: TradeStatus;
  canComplete: boolean;
  onChanged: (next: TradeStatus) => void;
}) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const patch = async (next: TradeStatus) => {
    if (pending !== null || next === status) return;
    if (next === 'done' && !canComplete) {
      toast.error('쪽지를 1통 이상 받은 뒤에 완료 처리할 수 있어요');
      return;
    }
    setPending(next);
    try {
      await api(`/api/trades/${tradeId}/status`, { method: 'PATCH', body: { status: next } });
      onChanged(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '상태 변경 실패');
    } finally {
      setPending(null);
    }
  };

  const Btn = ({ next, bg, label }: { next: TradeStatus; bg: string; label: string }) => {
    const disabled = pending !== null || status === next || (next === 'done' && !canComplete);
    return (
      <Pressable
        onPress={() => patch(next)}
        disabled={pending !== null || status === next}
        style={{ flex: 1, backgroundColor: bg, borderColor: tc.ink, borderWidth: 2, paddingVertical: 10, alignItems: 'center', opacity: disabled ? 0.55 : 1 }}
      >
        <PixelText variant={txt} size={9} color={tc.white}>{label}</PixelText>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn next="open" bg={tc.blu} label="거래 중" />
        <Btn next="reserved" bg={tc.orn ?? '#E8842C'} label="예약 중" />
        <Btn next="done" bg={tc.grnDk} label={status === 'done' ? '완료' : `완료 +${REWARDS.trade_done}P`} />
      </View>
      {!canComplete && status !== 'done' ? (
        <View style={{ backgroundColor: tc.pap2, paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center' }}>
          <PixelText variant={txt} size={8} color={tc.ink2} style={{ letterSpacing: 0.5, textAlign: 'center' }}>
            ✉ 쪽지를 받은 적이 없어요. 구매자와 쪽지를 먼저 주고받은 뒤 완료해주세요.
          </PixelText>
        </View>
      ) : null}
    </View>
  );
}
