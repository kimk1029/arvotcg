/**
 * /oripa/[id] — 오리파 플레이(티켓 현황판). 웹 OripaPlayScreen 패리티:
 * 입장 토큰 가드(구매 모달이 발급, 5분 TTL·1회용) → GET /api/oripa/{id}/tickets →
 * 티켓 선택/랜덤 선택 → 확인 모달 → POST /api/oripa/{id}/pull(서버 추첨·포인트
 * 원자 차감) → 순차 리빌 → 결과 요약 → 박스 목록 복귀. 8초 폴링으로 타 유저
 * 뽑기 반영, alreadyDrawn 은 토스트 안내.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { Spinner } from '@/components/Spinner';
import { useToast } from '@/components/ToastProvider';
import { space } from '@/theme/tokens';
import { useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { api } from '@/lib/apiClient';
import { consumeOripaPass } from '@/lib/oripaPass';

type OripaGrade = 'S' | 'A' | 'B' | 'C' | 'last';

interface OripaTicket {
  index: number;
  drawn: boolean;
  grade?: OripaGrade;
  prizeName?: string;
  prizeEmoji?: string;
  prizeImageUrl?: string;
}

interface Result {
  index: number;
  grade: OripaGrade;
  name: string;
  emoji: string;
  imageUrl?: string;
}

interface PullResponse {
  results: Array<{
    index: number;
    grade: OripaGrade;
    prizeName: string;
    prizeEmoji: string;
    prizeImageUrl?: string;
  }>;
  alreadyDrawn: number[];
}

const POLL_MS = 8_000;

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export default function OripaPlay() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const toast = useToast();
  const { id, qty: qtyParam } = useLocalSearchParams<{ id: string; qty?: string }>();
  const packId = typeof id === 'string' ? id : 'default';
  const qtyRaw = Number(typeof qtyParam === 'string' ? qtyParam : '1');
  const qty = Math.max(1, Math.min(10, Number.isFinite(qtyRaw) ? qtyRaw : 1));

  const GRADE_BG: Record<OripaGrade, string> = {
    S: tc.gold,
    A: '#A78BFA',
    B: tc.blu,
    C: tc.ink3,
    last: tc.red,
  };

  const [tickets, setTickets] = useState<OripaTicket[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [revealStage, setRevealStage] = useState<'idle' | 'running' | 'done'>('idle');
  const [results, setResults] = useState<Result[]>([]);
  const [activeReveal, setActiveReveal] = useState<Result | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const unmountedRef = useRef(false);
  const stageRef = useRef(revealStage);
  const revealLockRef = useRef(false);
  stageRef.current = revealStage;

  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    [],
  );

  // 입장 가드 — 구매 모달이 발급한 일회용 토큰이 있어야 진입 (웹 oripa_pass 동일).
  useEffect(() => {
    if (!consumeOripaPass(packId, qty)) {
      router.replace('/my/oripa' as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 서버 티켓 fetch — 폴링으로 다른 유저 뽑기 반영.
  const refresh = useCallback(async () => {
    try {
      const data = await api<{ data: OripaTicket[] }>(`/api/oripa/${encodeURIComponent(packId)}/tickets`, { auth: false });
      if (!unmountedRef.current && Array.isArray(data.data)) setTickets(data.data);
    } catch {
      // ignore
    }
  }, [packId]);

  useEffect(() => {
    refresh();
    const iv = setInterval(() => {
      if (stageRef.current === 'running') return;
      void refresh();
    }, POLL_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  const remaining = useMemo(() => tickets.filter((t) => !t.drawn).length, [tickets]);
  const selectionDone = selected.length === qty;

  const toggleSelect = (idx: number) => {
    if (revealStage !== 'idle') return;
    if (tickets[idx]?.drawn) return;
    setSelected((prev) => {
      if (prev.includes(idx)) return prev.filter((x) => x !== idx);
      if (prev.length >= qty) {
        toast.info(`${qty}장만 선택할 수 있어요`);
        return prev;
      }
      const next = [...prev, idx];
      if (next.length === qty) {
        setTimeout(() => {
          if (!unmountedRef.current) setShowConfirm(true);
        }, 250);
      }
      return next;
    });
  };

  /** 미오픈 티켓 중 랜덤 qty 장 자동 선택 → 확인 모달 (웹 동일 Fisher-Yates). */
  const randomPick = () => {
    if (revealStage !== 'idle') return;
    const available = tickets.filter((t) => !t.drawn).map((t) => t.index);
    if (available.length < qty) {
      toast.error(`남은 티켓이 ${qty}장 미만이에요`);
      return;
    }
    const arr = [...available];
    for (let i = arr.length - 1; i > arr.length - 1 - qty; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setSelected(arr.slice(arr.length - qty));
    setShowConfirm(true);
  };

  const clearSelection = () => {
    setSelected([]);
    setShowConfirm(false);
  };

  const runReveals = async () => {
    if (selected.length !== qty || revealStage !== 'idle' || revealLockRef.current) return;
    revealLockRef.current = true;
    setRevealStage('running');

    // 서버 pull — 원자적 추첨 + 포인트 차감.
    let payload: PullResponse;
    try {
      payload = await api<PullResponse>(`/api/oripa/${encodeURIComponent(packId)}/pull`, {
        method: 'POST',
        body: { indices: selected },
      });
    } catch (e) {
      const status = e && typeof e === 'object' && 'status' in e ? (e as { status: number }).status : 0;
      const body = e && typeof e === 'object' && 'body' in e ? (e as { body: unknown }).body : null;
      const serverMsg = body && typeof body === 'object' && 'error' in (body as object) ? String((body as { error?: string }).error) : null;
      toast.error(status === 401 ? '로그인 후 이용 가능합니다' : serverMsg ?? '뽑기 실패');
      revealLockRef.current = false;
      setRevealStage('idle');
      setShowConfirm(false);
      void refresh();
      return;
    }

    const { results: serverResults, alreadyDrawn } = payload;

    if (serverResults.length === 0) {
      toast.error('다른 유저가 먼저 뽑았어요');
      revealLockRef.current = false;
      setSelected([]);
      setRevealStage('idle');
      setShowConfirm(false);
      void refresh();
      return;
    }

    setShowConfirm(false);

    // 성공 티켓 하나씩 리빌 (웹 CSS 시퀀스의 단순화 버전).
    const acc: Result[] = [];
    const nextTickets = [...tickets];
    for (const pr of serverResults) {
      await delay(600);
      if (unmountedRef.current) return;
      const r: Result = { index: pr.index, grade: pr.grade, name: pr.prizeName, emoji: pr.prizeEmoji, imageUrl: pr.prizeImageUrl };
      acc.push(r);
      setActiveReveal(r);
      nextTickets[pr.index] = {
        ...nextTickets[pr.index],
        drawn: true,
        grade: pr.grade,
        prizeName: pr.prizeName,
        prizeEmoji: pr.prizeEmoji,
        prizeImageUrl: pr.prizeImageUrl,
      };
      setTickets([...nextTickets]);
      await delay(2400);
      if (unmountedRef.current) return;
      setActiveReveal(null);
      await delay(200);
    }

    setResults(acc);
    setRevealStage('done');
    setShowSummary(true);
    revealLockRef.current = false;
    if (alreadyDrawn.length > 0) {
      toast.info(`${alreadyDrawn.length}장은 이미 다른 유저가 뽑았어요`);
    }
    void refresh();
  };

  const closeSummary = () => {
    setShowSummary(false);
    setSelected([]);
    setResults([]);
    setRevealStage('idle');
    // 결과 확인 후엔 무조건 박스 목록으로 — 추가 구매는 거기서 (웹 동일).
    router.replace('/my/oripa' as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar title="티켓 현황판" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* 상태 요약 */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: space.gap, marginBottom: 10 }}>
          <StatBox label="구매 수량" value={`${selected.length} / ${qty}`} tc={tc} txt={txt} />
          <StatBox label="잔여 티켓" value={`${remaining} / ${tickets.length || '—'}`} tc={tc} txt={txt} />
        </View>

        {/* 랜덤 선택 */}
        <Pressable
          onPress={randomPick}
          disabled={revealStage !== 'idle' || remaining < qty}
          style={{
            marginHorizontal: space.gap,
            marginBottom: 10,
            paddingVertical: 11,
            alignItems: 'center',
            backgroundColor: revealStage === 'idle' && remaining >= qty ? tc.pur : tc.pap3,
            borderColor: tc.ink,
            borderWidth: 2,
          }}
        >
          <PixelText variant={txt} size={11} color={revealStage === 'idle' && remaining >= qty ? tc.white : tc.ink3}>
            🎲 랜덤으로 {qty}장 자동 선택
          </PixelText>
        </Pressable>

        {/* 범례 */}
        <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: space.gap, marginBottom: 8, flexWrap: 'wrap' }}>
          <Legend color={tc.white} label="미오픈" tc={tc} txt={txt} />
          <Legend color={GRADE_BG.S} label="S상" tc={tc} txt={txt} />
          <Legend color={GRADE_BG.A} label="A상" tc={tc} txt={txt} />
          <Legend color={GRADE_BG.B} label="B상" tc={tc} txt={txt} />
          <Legend color={GRADE_BG.C} label="C상" tc={tc} txt={txt} />
        </View>

        {/* 티켓 그리드 (10열) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: space.gap, gap: 4 }}>
          {tickets.map((t) => {
            const isSelected = selected.includes(t.index);
            const bg = t.drawn ? GRADE_BG[t.grade ?? 'C'] : isSelected ? tc.grn : tc.white;
            return (
              <Pressable
                key={t.index}
                onPress={() => toggleSelect(t.index)}
                disabled={t.drawn || revealStage !== 'idle'}
                style={{
                  width: '8.9%',
                  aspectRatio: 1,
                  backgroundColor: bg,
                  borderColor: tc.ink,
                  borderWidth: 1.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: t.drawn ? 0.85 : 1,
                }}
              >
                {t.drawn ? (
                  <PixelText variant={txt} size={8} color={tc.ink}>{t.grade}</PixelText>
                ) : isSelected ? (
                  <PixelText variant={txt} size={8} color={tc.white}>✓</PixelText>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* 안내 바 */}
        <View
          style={{
            margin: space.gap,
            marginBottom: 8,
            paddingVertical: 12,
            paddingHorizontal: 14,
            backgroundColor: selectionDone ? tc.red : tc.pap2,
            borderColor: tc.ink,
            borderWidth: 2,
            alignItems: 'center',
          }}
        >
          <PixelText variant={txt} size={9} color={selectionDone ? tc.white : tc.ink2} style={{ letterSpacing: 0.5, textAlign: 'center', lineHeight: 15 }}>
            {revealStage === 'running'
              ? '✨ 뽑기 중...'
              : selectionDone
                ? `${qty}장 선택 완료 · 아래 버튼으로 오픈`
                : `티켓을 ${qty - selected.length}장 더 선택하세요`}
          </PixelText>
        </View>

        {/* 오픈 버튼 */}
        <Pressable
          onPress={() => {
            if (selectionDone) setShowConfirm(true);
          }}
          disabled={!selectionDone || revealStage !== 'idle'}
          style={{
            marginHorizontal: space.gap,
            paddingVertical: 14,
            alignItems: 'center',
            backgroundColor: tc.ink,
            opacity: selectionDone && revealStage === 'idle' ? 1 : 0.55,
          }}
        >
          <PixelText variant={txt} size={11} color={tc.gold}>
            {revealStage === 'running' ? '▶ 오픈 중 ▶' : `▶ ${qty}장 오픈 확인 ▶`}
          </PixelText>
        </Pressable>
      </ScrollView>

      {/* 리빌 모달 */}
      <Modal visible={!!activeReveal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {activeReveal ? (
            <PixelFrame bg={tc.paper} borderWidth={3} shadow={6} inner={3}>
              <View style={{ padding: 22, alignItems: 'center', gap: 10, minWidth: 240 }}>
                <View style={{ backgroundColor: GRADE_BG[activeReveal.grade], borderColor: tc.ink, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <PixelText variant={txt} size={12} color={tc.ink}>{activeReveal.grade}상</PixelText>
                </View>
                {activeReveal.imageUrl ? (
                  <Image source={{ uri: activeReveal.imageUrl }} style={{ width: 96, height: 96 }} resizeMode="contain" />
                ) : (
                  <Text style={{ fontSize: 58, lineHeight: 66 }}>{activeReveal.emoji}</Text>
                )}
                <PixelText variant="ko" size={13} weight="bold" color={tc.ink} style={{ textAlign: 'center' }}>
                  {activeReveal.name}
                </PixelText>
                <PixelText variant={txt} size={9} color={tc.ink3}>티켓 #{activeReveal.index + 1}</PixelText>
              </View>
            </PixelFrame>
          ) : null}
        </View>
      </Modal>

      {/* 확인 모달 */}
      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => revealStage === 'idle' && setShowConfirm(false)}>
        <Pressable
          onPress={() => {
            if (revealStage === 'idle') setShowConfirm(false);
          }}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 320 }}>
            <PixelFrame bg={tc.paper} borderWidth={3} shadow={6} inner={3}>
              <View style={{ padding: 18, gap: 12, alignItems: 'center' }}>
                <View style={{ backgroundColor: tc.ink, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <PixelText variant={txt} size={10} color={tc.gold}>{qty}장 선택 완료</PixelText>
                </View>
                <PixelText variant={txt} size={9} color={tc.ink2} style={{ textAlign: 'center', lineHeight: 16 }}>
                  선택한 {qty}장의 티켓을 한 번에 오픈합니다{'\n'}한 번 오픈하면 되돌릴 수 없어요
                </PixelText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                  {selected.slice().sort((a, b) => a - b).map((idx) => (
                    <View key={idx} style={{ backgroundColor: tc.grn, borderColor: tc.ink, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 }}>
                      <PixelText variant={txt} size={8} color={tc.white}>#{idx + 1}</PixelText>
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={runReveals}
                  disabled={revealStage !== 'idle'}
                  style={{ alignSelf: 'stretch', backgroundColor: tc.red, borderColor: tc.ink, borderWidth: 2, paddingVertical: 12, alignItems: 'center', opacity: revealStage === 'idle' ? 1 : 0.7 }}
                >
                  {revealStage === 'running' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Spinner size={18} />
                      <PixelText variant={txt} size={11} color={tc.white}>뽑는 중...</PixelText>
                    </View>
                  ) : (
                    <PixelText variant={txt} size={11} color={tc.white}>▶ {qty}장 오픈 ▶</PixelText>
                  )}
                </Pressable>
                <Pressable onPress={clearSelection} disabled={revealStage !== 'idle'} hitSlop={6}>
                  <PixelText variant={txt} size={9} color={tc.ink3} style={{ textDecorationLine: 'underline', opacity: revealStage === 'idle' ? 1 : 0.4 }}>
                    ← 다시 고르기
                  </PixelText>
                </Pressable>
              </View>
            </PixelFrame>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 결과 요약 모달 */}
      <Modal visible={showSummary} transparent animationType="fade" onRequestClose={closeSummary}>
        <Pressable onPress={closeSummary} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 320 }}>
            <PixelFrame bg={tc.paper} borderWidth={3} shadow={6} inner={3}>
              <View style={{ padding: 18, gap: 12, alignItems: 'center' }}>
                <View style={{ backgroundColor: tc.ink, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <PixelText variant={txt} size={10} color={tc.gold}>{results.length}장 뽑기 결과</PixelText>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {results.map((r, i) => (
                    <View key={i} style={{ width: 40, height: 40, backgroundColor: GRADE_BG[r.grade], borderColor: tc.ink, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }}>
                      <PixelText variant={txt} size={11} color={tc.ink}>{r.grade}</PixelText>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  {(['S', 'A', 'B', 'C'] as const).map((g) => {
                    const n = results.filter((r) => r.grade === g).length;
                    return (
                      <PixelText key={g} variant={txt} size={9} color={n > 0 ? tc.red : tc.ink3}>
                        {g}: {n}
                      </PixelText>
                    );
                  })}
                </View>
                <Pressable onPress={closeSummary} style={{ alignSelf: 'stretch', backgroundColor: tc.red, borderColor: tc.ink, borderWidth: 2, paddingVertical: 12, alignItems: 'center' }}>
                  <PixelText variant={txt} size={11} color={tc.white}>▶ 확인 · 박스 목록으로 ▶</PixelText>
                </Pressable>
              </View>
            </PixelFrame>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatBox({ label, value, tc, txt }: { label: string; value: string; tc: ReturnType<typeof useThemeColors>; txt: 'pixel' | 'ko' }) {
  return (
    <View style={{ flex: 1, backgroundColor: tc.white, borderColor: tc.ink, borderWidth: 2, paddingVertical: 10, alignItems: 'center' }}>
      <PixelText variant={txt} size={8} color={tc.ink3}>{label}</PixelText>
      <PixelText variant={txt} size={12} weight="bold" color={tc.ink} style={{ marginTop: 4 }}>{value}</PixelText>
    </View>
  );
}

function Legend({ color, label, tc, txt }: { color: string; label: string; tc: ReturnType<typeof useThemeColors>; txt: 'pixel' | 'ko' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 10, height: 10, backgroundColor: color, borderColor: tc.ink, borderWidth: 1 }} />
      <PixelText variant={txt} size={8} color={tc.ink3}>{label}</PixelText>
    </View>
  );
}
