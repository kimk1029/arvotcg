/**
 * /my — 마이페이지. Claude Design 'ARVOTCG 마이페이지' 프로토타입 레이아웃
 * (홈·커뮤니티와 동일하게 모든 테마 공통 단일 디자인 — 라이트/화이트 카드/오렌지 포인트).
 * 실시간 데이터: /api/me/summary(카드·거래·찜·포인트·레벨) + /api/me/portfolio + 미읽음 쪽지.
 * 미인증 시 InlineLoginGate. 웹 MyScreen 과 페어.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { InlineLoginGate } from '@/components/InlineLoginGate';
import { useCurrency } from '@/components/CurrencyProvider';
import { useToast } from '@/components/ToastProvider';
import {
  deleteMyAccount, fetchMySummary, fetchPortfolio, fetchUnreadCount, updateMyName,
  SWR_PORTFOLIO, type MySummary, type PortfolioSummary,
} from '@/lib/myApi';
import { useSWR } from '@/lib/swr';
import { isAuthenticated, setSession, subscribeSession } from '@/lib/session';

/* 프로토타입 고정 팔레트 — 테마 무관 (홈 CleanHomeScreen·커뮤니티 feed.tsx 와 동일 접근) */
const P = {
  pageBg: '#F7F7F9',
  card: '#FFFFFF',
  ink: '#16161a',
  sub: '#9A9AA0',
  sub2: '#8E8E93',
  line: '#F4F4F6',
  headerLine: '#F0F0F2',
  chip: '#F0F0F2',
  orange: '#FF7A00',
  red: '#F5333F',
  blue: '#2F6BFF',
  chev: '#C2C2C8',
};

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

function useAuthed(): boolean {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  useEffect(() => {
    return subscribeSession(() => setAuthed(isAuthenticated()));
  }, []);
  return authed;
}

interface MenuItem {
  emoji: string;
  iconBg: string;
  label: string;
  sub?: string;
  badge?: string;
  disabled?: boolean;
  onPress?: () => void;
}

/* ---------------- 아이콘 (디자인 SVG 그대로) ---------------- */

function CartIcon() {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={9} cy={21} r={1.6} />
      <Circle cx={19} cy={21} r={1.6} />
      <Path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6" />
    </Svg>
  );
}

function GearIcon() {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Svg>
  );
}

function Chevron({ s = 16 }: { s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={P.chev} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

function PencilIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={P.sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
}

/** 포트폴리오 스파크라인 — 88×28, history 정규화. 상승=빨강(디자인)/하락=파랑. */
/**
 * 0 → target 카운트업 (ease-out) — 포인트·XP 수치가 차오르는 연출 (웹 MyScreen 페어).
 * runKey 가 바뀌면 처음부터 다시 — 탭으로 마이페이지에 재진입할 때마다 재생.
 */
function useCountUp(target: number, runKey = 0, duration = 900): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target <= 0) { setVal(Math.max(0, target)); return; }
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setVal(Math.round(target * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, runKey, duration]);
  return val;
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const W = 100;
  const H = 28;
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  const step = W / (points.length - 1);
  const coords = points.map((v, i) => ({
    x: i * step,
    y: H - 4 - ((v - min) / span) * (H - 8),
  }));
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  return (
    <Svg width={88} height={28} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ flexShrink: 0 }}>
      <Path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </Svg>
  );
}

/* ---------------- 화면 ---------------- */

export default function MyScreen() {
  const toast = useToast();
  const authed = useAuthed();
  const { format } = useCurrency();
  // SWR — 재진입 즉시 페인트(디스크 캐시) + TTL 내 재조회 생략. 내 자산 화면과
  // 포트폴리오 캐시 키를 공유해 어느 쪽을 먼저 열어도 다른 쪽이 즉시 뜬다.
  const { data, refresh } = useSWR<MySummary>('me:summary', fetchMySummary, {
    persist: true,
    enabled: authed,
    deps: [authed],
  });

  // 미읽음 쪽지 수 — 웹 useUnread 대응 (짧은 TTL — 새 쪽지 반영).
  const { data: unreadData } = useSWR<number>('me:unread', fetchUnreadCount, {
    ttlMs: 30_000,
    enabled: authed,
    deps: [authed],
  });
  const unread = unreadData ?? 0;

  // 포트폴리오 컴팩트 카드 — /api/me/portfolio (평가액·등락·30일 히스토리).
  const { data: pf } = useSWR<PortfolioSummary>(SWR_PORTFOLIO, fetchPortfolio, {
    persist: true,
    enabled: authed,
    deps: [authed],
  });

  // 이름 편집 — 웹 EditableName 대응(PATCH /api/me/name).
  const [editOpen, setEditOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameBusy, setNameBusy] = useState(false);

  // 포인트·XP 카운트업 + XP 바 채움 애니메이션 (진입 시 1회, 웹 MyScreen 페어).
  // 훅 순서 보장을 위해 아래 조기 return(로그인 게이트)보다 먼저 선언.
  const pointsTarget = data?.inventory.points ?? 0;
  const xpTarget = data?.level.xp ?? 0;
  const xpPctTarget = data?.level
    ? Math.max(0, Math.min(100, Math.round((data.level.xp / data.level.xpNeeded) * 100)))
    : 0;
  // 화면에 들어올 때마다 애니메이션 재생 (탭 전환으로 언마운트되지 않으므로 포커스로 트리거).
  const [runKey, setRunKey] = useState(0);
  useFocusEffect(useCallback(() => { setRunKey((k) => k + 1); }, []));
  const animPoints = useCountUp(pointsTarget, runKey);
  const animXp = useCountUp(xpTarget, runKey);
  // 게이지는 트랙 실측 폭(px)으로 애니메이션 — Animated 의 '%' 문자열 보간은
  // 값이 갱신돼도 초기 폭에 머무는 경우가 있어 픽셀 값으로 구동한다.
  const [xpTrackW, setXpTrackW] = useState(0);
  const xpBarAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (xpTrackW <= 0) return;
    xpBarAnim.setValue(0);
    Animated.timing(xpBarAnim, {
      toValue: (Math.max(xpPctTarget, 6) / 100) * xpTrackW,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [xpPctTarget, xpTrackW, runKey, xpBarAnim]);

  if (!authed) {
    return (
      <InlineLoginGate
        title="마이"
        feature="마이페이지"
        description="포인트·레벨·거래 활동을 한눈에 보세요."
        icon="👤"
      />
    );
  }

  const summary = data ?? null;
  const points = summary?.inventory.points ?? 0;
  const lv = summary?.level ?? null;
  const level = lv?.level ?? 1;
  const xpPct = lv ? Math.max(0, Math.min(100, Math.round((lv.xp / lv.xpNeeded) * 100))) : 0;
  const userName = summary?.user.name ?? '게스트';
  const cardCount = summary?.counts.cardCount ?? 0;
  const tradeCount = summary?.counts.tradeCount ?? 0;
  const savedCount = summary?.counts.savedCount ?? 0;

  const pfUp = (pf?.changePct ?? 0) >= 0;
  const pfColor = pfUp ? P.red : P.blue;

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || nameBusy) return;
    if (trimmed === userName) {
      setEditOpen(false);
      return;
    }
    setNameBusy(true);
    try {
      await updateMyName(trimmed);
      setEditOpen(false);
      toast.success('이름이 변경되었습니다');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '이름 변경 실패');
    } finally {
      setNameBusy(false);
    }
  };

  // 회원 탈퇴 — App Store 5.1.1(v) 계정 삭제 요건. 확인 다이얼로그 후 DELETE /api/me.
  const confirmDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '계정과 컬렉션·관심카드·알림·쪽지 및 작성한 게시물·댓글이 모두 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴하기',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyAccount();
              setSession(null);
              toast.success('탈퇴가 완료되었습니다');
              router.replace('/login' as never);
            } catch {
              toast.error('탈퇴 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
            }
          },
        },
      ],
    );
  };

  // 내 활동 — 디자인의 5행 + 기존 기능 행(관심카드·내 피드) 동일 스타일로 이어붙임.
  const activity: MenuItem[] = [
    { emoji: '✉️', iconBg: '#E3F6EC', label: '쪽지함', sub: '새 쪽지를 확인하세요', badge: unread > 0 ? `${unread > 99 ? '99+' : unread}` : undefined, onPress: () => router.push('/my/messages' as never) },
    { emoji: '📈', iconBg: '#FFF1E6', label: '포트폴리오', sub: '보유 카드 평가액과 수익률', onPress: () => router.push('/my/portfolio' as never) },
    { emoji: '🃏', iconBg: '#E0EDFF', label: '내 카드', sub: `등록한 카드 ${cardCount}장 관리`, onPress: () => router.push('/my/cards' as never) },
    { emoji: '🤝', iconBg: '#F4F1FF', label: '내 거래', sub: '판매·구매 내역', onPress: () => router.push('/my/trades' as never) },
    { emoji: '❤️', iconBg: '#FFECEC', label: '찜한 글', sub: '북마크한 게시글', onPress: () => router.push('/my/bookmarks' as never) },
    { emoji: '⭐', iconBg: '#FFF6DE', label: '관심카드', sub: '찜한 시세 카드', onPress: () => router.push('/my/favorites' as never) },
    { emoji: '🗣', iconBg: '#F1EAFF', label: '내 피드', sub: '내가 쓴 커뮤니티 글', onPress: () => router.push('/my/feeds' as never) },
  ];

  const settings: MenuItem[] = [
    { emoji: '📢', iconBg: '#FFF6DE', label: '공지사항', badge: 'NEW', onPress: () => router.push('/my/notices' as never) },
    { emoji: '❓', iconBg: '#E0EDFF', label: 'FAQ · 자주 묻는 질문', onPress: () => router.push('/my/faq' as never) },
    { emoji: '📜', iconBg: '#F0F0F2', label: '이용약관', onPress: () => router.push('/legal?doc=terms' as never) },
    { emoji: '🔒', iconBg: '#E3F6EC', label: '개인정보처리방침', onPress: () => router.push('/legal?doc=privacy' as never) },
    { emoji: '🚫', iconBg: '#FFECEC', label: '차단 관리', sub: '차단한 사용자 보기·해제', onPress: () => router.push('/my/blocks' as never) },
    { emoji: '🔔', iconBg: '#F0F0F2', label: '알림', sub: '받은 알림 확인', onPress: () => router.push('/my/notifications' as never) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: P.pageBg }}>
      {/* header — 디자인: 내 프로필 + 상점(카트)·환경설정(기어) */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: P.headerLine, flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 12, paddingHorizontal: 20 }}>
        <Text style={{ flex: 1, fontSize: 24, fontWeight: '900', color: P.ink, letterSpacing: -0.6 }}>내 프로필</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable onPress={() => router.push('/my/shop' as never)} hitSlop={8}><CartIcon /></Pressable>
          <Pressable onPress={() => router.push('/settings' as never)} hitSlop={8}><GearIcon /></Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* profile card */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
          <View style={[{ backgroundColor: P.card, borderRadius: 20, padding: 20 }, CARD_SHADOW]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ position: 'relative' }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={64} height={64} style={{ position: 'absolute' }}>
                    <Defs>
                      <LinearGradient id="av" x1="0" y1="0" x2="0.6" y2="1">
                        <Stop offset="0" stopColor="#3b5bdb" />
                        <Stop offset="1" stopColor="#1e2f8f" />
                      </LinearGradient>
                    </Defs>
                    <Rect width={64} height={64} fill="url(#av)" />
                  </Svg>
                  <Text style={{ fontSize: 32 }}>💎</Text>
                </View>
                <View style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: P.orange, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 9, borderWidth: 2.5, borderColor: '#fff' }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>LV.{level}</Text>
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '900', color: P.ink, letterSpacing: -0.4, flexShrink: 1 }}>{userName}</Text>
                  <Pressable hitSlop={8} onPress={() => { setNameInput(userName); setEditOpen(true); }}><PencilIcon /></Pressable>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: P.orange }}>★ {lv?.title ?? '트레이너'}</Text>
                  <Text style={{ fontSize: 11.5, color: P.sub, fontWeight: '600' }}>
                    · <Text style={{ color: P.orange, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{animPoints.toLocaleString('ko-KR')}</Text> 포인트
                  </Text>
                </View>
              </View>
            </View>

            {/* XP */}
            {lv ? (
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: P.sub, fontVariant: ['tabular-nums'] }}>XP {animXp} / {lv.xpNeeded}</Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: P.sub }}>다음 LV.까지 <Text style={{ color: P.ink }}>{lv.xpNeeded - lv.xp} XP</Text></Text>
                </View>
                <View
                  onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 0 && Math.abs(w - xpTrackW) > 1) setXpTrackW(w);
                  }}
                  style={{ height: 8, borderRadius: 4, backgroundColor: P.chip, overflow: 'hidden' }}
                >
                  {/* 진입 시 0 → 목표치로 차오르는 게이지 */}
                  {/* 그라디언트 SVG 는 트랙 전체 폭으로 고정하고, 애니메이션되는 부모가
                      잘라낸다 — SVG 의 '100%' 는 부모 폭이 애니메이션돼도 다시 그려지지 않음. */}
                  <Animated.View style={{ width: xpBarAnim, height: '100%', borderRadius: 4, overflow: 'hidden' }}>
                    <Svg width={Math.max(xpTrackW, 1)} height={8} preserveAspectRatio="none">
                      <Defs>
                        <LinearGradient id="xp" x1="0" y1="0" x2="1" y2="0">
                          <Stop offset="0" stopColor="#FF9A4D" />
                          <Stop offset="1" stopColor="#FF7A00" />
                        </LinearGradient>
                      </Defs>
                      <Rect width={Math.max(xpTrackW, 1)} height={8} fill="url(#xp)" />
                    </Svg>
                  </Animated.View>
                </View>
              </View>
            ) : null}

            {/* compact portfolio */}
            <Pressable
              onPress={() => router.push('/my/portfolio' as never)}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, backgroundColor: P.pageBg, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: P.sub }}>포트폴리오</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: P.ink, letterSpacing: -0.4 }}>
                    {pf ? format(pf.totalJpy) : '계산 중…'}
                  </Text>
                  {pf?.changePct != null ? (
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: pfColor }}>
                      {pfUp ? '+' : ''}{pf.changePct.toFixed(1)}% {pfUp ? '▲' : '▼'}
                    </Text>
                  ) : null}
                </View>
              </View>
              {pf && pf.history.length >= 2 ? (
                <Sparkline points={pf.history.map((h) => h.totalJpy)} color={pfColor} />
              ) : null}
              <Chevron s={15} />
            </Pressable>
          </View>
        </View>

        {/* stats */}
        <View style={{ flexDirection: 'row', gap: 9, paddingHorizontal: 16, paddingBottom: 20 }}>
          {/* 숫자 타일도 각 목록으로 이동 — 내 카드=내 컬렉션(/my/cards), 내 거래, 찜한 글. 웹 MyScreen 동일. */}
          {([
            [cardCount, '내 카드', '/my/cards'],
            [tradeCount, '내 거래', '/my/trades'],
            [savedCount, '찜한 글', '/my/bookmarks'],
          ] as const).map(([n, label, href]) => (
            <Pressable key={label} onPress={() => router.push(href as never)} style={({ pressed }) => [{ flex: 1, backgroundColor: P.card, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 12, alignItems: 'center', opacity: pressed ? 0.7 : 1 }, CARD_SHADOW, { shadowOpacity: 0.04 }]}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: P.ink }}>{n}</Text>
              <Text style={{ fontSize: 11.5, color: P.sub2, fontWeight: '600', marginTop: 3 }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 내 활동 */}
        <Text style={{ fontSize: 17, fontWeight: '800', color: P.ink, paddingHorizontal: 20, paddingBottom: 12 }}>내 활동</Text>
        <MenuCard items={activity} />

        {/* 설정 */}
        <Text style={{ fontSize: 17, fontWeight: '800', color: P.ink, paddingHorizontal: 20, paddingBottom: 12 }}>설정</Text>
        <MenuCard items={settings} />

        {/* 로그아웃 */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Pressable
            onPress={() => {
              setSession(null);
              router.replace('/login' as never);
            }}
            style={({ pressed }) => [{ backgroundColor: P.card, borderRadius: 18, paddingVertical: 15, alignItems: 'center', opacity: pressed ? 0.85 : 1 }, CARD_SHADOW, { shadowOpacity: 0.04 }]}
          >
            <Text style={{ fontSize: 14.5, fontWeight: '800', color: P.red }}>로그아웃</Text>
          </Pressable>
        </View>

        {/* 회원 탈퇴 — 구석 작은 텍스트 링크 (웹 MyScreen 과 페어) */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 8, alignItems: 'flex-end' }}>
          <Pressable onPress={confirmDeleteAccount} hitSlop={8}>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: P.sub, textDecorationLine: 'underline' }}>
              회원 탈퇴
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* 이름 편집 모달 — 웹 EditableName 대응 */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <Pressable onPress={() => setEditOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 320 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: P.ink }}>이름 변경</Text>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="새 이름"
                placeholderTextColor={P.sub}
                maxLength={20}
                autoFocus
                style={{ backgroundColor: P.pageBg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14.5, fontWeight: '600', color: P.ink }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => setEditOpen(false)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: P.chip, borderRadius: 12 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: P.sub2 }}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={saveName}
                  disabled={nameBusy || !nameInput.trim()}
                  style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: P.orange, borderRadius: 12, opacity: nameBusy || !nameInput.trim() ? 0.5 : 1 }}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#fff' }}>{nameBusy ? '저장 중…' : '저장'}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** 화이트 라운드 카드 안 메뉴 행 리스트 — 디자인 sc-for 행 그대로. */
function MenuCard({ items }: { items: MenuItem[] }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 28 }}>
      <View style={[{ backgroundColor: P.card, borderRadius: 18, overflow: 'hidden' }, CARD_SHADOW, { shadowOpacity: 0.04 }]}>
        {items.map((m, i) => (
          <Pressable
            key={m.label}
            onPress={m.disabled ? undefined : m.onPress}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, paddingHorizontal: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: P.line, opacity: m.disabled ? 0.45 : pressed ? 0.7 : 1 },
            ]}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: m.iconBg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 19 }}>{m.emoji}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '800', color: P.ink }}>{m.label}</Text>
              {m.sub ? <Text style={{ fontSize: 11.5, color: P.sub, fontWeight: '600', marginTop: 2 }}>{m.sub}</Text> : null}
            </View>
            {m.badge ? (
              <View style={{ backgroundColor: P.red, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 9 }}>
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#fff' }}>{m.badge}</Text>
              </View>
            ) : null}
            {!m.disabled ? <Chevron /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
