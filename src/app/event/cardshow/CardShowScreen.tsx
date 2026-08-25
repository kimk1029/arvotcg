'use client';

/**
 * 카드쇼 사전예약 — 날짜 탭 + 시간 슬롯 그리드.
 *
 * 인증 두 경로:
 *  · 브라우저: 웹 세션 쿠키 (credentials include)
 *  · 앱 웹뷰: URL ?token=<JWT> — 앱이 로그인 토큰을 붙여 열며, 모든 API 를
 *    Authorization 헤더로 호출한다 (웹뷰엔 웹 쿠키가 없음).
 * 미로그인이면 "로그인해주세요!" 게이트 표시.
 * 정책: 1인 1예약 — 다른 시간대를 누르면 예약이 이동. 내 예약 재클릭 시 취소.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Slot {
  id: number;
  date: string;
  time: string;
  capacity: number;
  reserved: number;
  remaining: number;
}

interface SlotsResp {
  loggedIn: boolean;
  mySlotId: number | null;
  slots: Slot[];
}

const P = {
  bg: '#0F172A',
  card: 'rgba(255,255,255,0.06)',
  line: 'rgba(255,255,255,0.12)',
  ink: '#FFFFFF',
  sub: 'rgba(255,255,255,0.65)',
  dim: 'rgba(255,255,255,0.38)',
  teal: '#2DD4BF',
  gold: '#FFD23F',
  red: '#F87171',
};

function weekdayKo(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] ?? '';
}

export function CardShowScreen() {
  // 앱 웹뷰 토큰 (없으면 웹 쿠키 세션 사용)
  const token = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('token');
  }, []);

  const call = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(path, {
        ...init,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers ?? {}),
        },
      }),
    [token],
  );

  const [data, setData] = useState<SlotsResp | null>(null);
  const [dateIdx, setDateIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await call('/api/cardshow/slots');
      if (!r.ok) throw new Error(String(r.status));
      setData((await r.json()) as SlotsResp);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [call]);

  useEffect(() => {
    load();
  }, [load]);

  const dates = useMemo(
    () => Array.from(new Set((data?.slots ?? []).map((s) => s.date))),
    [data],
  );
  const activeDate = dates[Math.min(dateIdx, Math.max(0, dates.length - 1))] ?? null;
  const daySlots = (data?.slots ?? []).filter((s) => s.date === activeDate);

  const act = async (slot: Slot) => {
    if (busy || !data) return;
    setBusy(true);
    setNotice(null);
    try {
      if (data.mySlotId === slot.id) {
        const r = await call('/api/cardshow/reserve', { method: 'DELETE' });
        if (!r.ok) throw new Error();
        setNotice('예약이 취소되었어요.');
      } else {
        const r = await call('/api/cardshow/reserve', {
          method: 'POST',
          body: JSON.stringify({ slotId: slot.id }),
        });
        const j = (await r.json().catch(() => null)) as { error?: string; moved?: boolean } | null;
        if (!r.ok) {
          setNotice(j?.error ?? '예약에 실패했어요. 다시 시도해 주세요.');
        } else {
          setNotice(
            j?.moved
              ? `예약을 ${slot.date} ${slot.time} 으로 옮겼어요! 🎟️`
              : `${slot.date} ${slot.time} 예약 완료! 🎟️`,
          );
        }
      }
      await load();
    } catch {
      setNotice('요청에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  /* ---------- 렌더 ---------- */

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100dvh', background: `linear-gradient(165deg, ${P.bg} 0%, #134E4A 130%)`, color: P.ink, fontFamily: "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 4, color: P.gold }}>ARVOTCG EVENT</div>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: '10px 0 6px', letterSpacing: -0.5 }}>🎪 카드쇼 사전예약</h1>
          <p style={{ fontSize: 13.5, color: P.sub, margin: 0, lineHeight: 1.6 }}>
            원하는 방문 시간대를 선택해 예약하세요.<br />1인 1타임 — 다른 시간을 누르면 예약이 이동해요.
          </p>
        </div>
        {children}
      </div>
    </div>
  );

  if (failed) {
    return shell(
      <div style={{ textAlign: 'center', padding: 40, background: P.card, borderRadius: 18 }}>
        <div style={{ fontSize: 40 }}>😵</div>
        <p style={{ color: P.sub }}>정보를 불러오지 못했어요.</p>
        <button onClick={load} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: P.teal, color: '#043', fontWeight: 800, cursor: 'pointer' }}>다시 시도</button>
      </div>,
    );
  }

  if (!data) {
    return shell(<div style={{ textAlign: 'center', color: P.dim, padding: 60 }}>불러오는 중…</div>);
  }

  if (!data.loggedIn) {
    return shell(
      <div style={{ textAlign: 'center', padding: '44px 24px', background: P.card, border: `1px solid ${P.line}`, borderRadius: 20 }}>
        <div style={{ fontSize: 46 }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: '12px 0 8px' }}>로그인해주세요!</h2>
        <p style={{ fontSize: 13.5, color: P.sub, lineHeight: 1.7, margin: '0 0 20px' }}>
          카드쇼 예약은 로그인한 회원만 가능해요.<br />앱에서는 로그인 후 다시 열어주세요.
        </p>
        <a href="/login?callbackUrl=/event/cardshow" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: P.gold, color: '#3A2D00', fontWeight: 800, textDecoration: 'none' }}>
          로그인하기
        </a>
      </div>,
    );
  }

  if (dates.length === 0) {
    return shell(
      <div style={{ textAlign: 'center', padding: 40, background: P.card, borderRadius: 18, color: P.sub }}>
        아직 오픈된 예약 시간대가 없어요. 곧 공개됩니다! 🎫
      </div>,
    );
  }

  return shell(
    <>
      {/* 날짜 탭 */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 16 }}>
        {dates.map((d, i) => {
          const on = d === activeDate;
          return (
            <button
              key={d}
              onClick={() => setDateIdx(i)}
              style={{
                flex: 'none', padding: '10px 16px', borderRadius: 14, cursor: 'pointer',
                border: `1px solid ${on ? P.teal : P.line}`,
                background: on ? P.teal : 'transparent', color: on ? '#043' : P.sub,
                fontWeight: 800, fontSize: 13.5,
              }}
            >
              {d.slice(5).replace('-', '.')} ({weekdayKo(d)})
            </button>
          );
        })}
      </div>

      {notice ? (
        <div style={{ marginBottom: 14, padding: '11px 16px', borderRadius: 12, background: 'rgba(45,212,191,0.12)', border: `1px solid ${P.teal}`, color: P.teal, fontSize: 13.5, fontWeight: 700 }}>
          {notice}
        </div>
      ) : null}

      {/* 시간 슬롯 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
        {daySlots.map((s) => {
          const mine = data.mySlotId === s.id;
          const full = s.remaining <= 0 && !mine;
          return (
            <button
              key={s.id}
              disabled={full || busy}
              onClick={() => act(s)}
              style={{
                padding: '16px 12px', borderRadius: 16, cursor: full ? 'default' : 'pointer',
                border: `2px solid ${mine ? P.gold : full ? 'transparent' : P.line}`,
                background: mine ? 'rgba(255,210,63,0.15)' : full ? 'rgba(255,255,255,0.03)' : P.card,
                color: P.ink, textAlign: 'center', opacity: full ? 0.55 : 1,
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: 0.5 }}>{s.time}</div>
              <div style={{ fontSize: 12, marginTop: 6, fontWeight: 700, color: mine ? P.gold : full ? P.red : P.teal }}>
                {mine ? '✓ 내 예약 (탭하면 취소)' : full ? '마감' : `잔여 ${s.remaining}석`}
              </div>
              <div style={{ fontSize: 10.5, color: P.dim, marginTop: 3 }}>{s.reserved}/{s.capacity} 예약됨</div>
            </button>
          );
        })}
      </div>

      <p style={{ marginTop: 26, fontSize: 11.5, color: P.dim, textAlign: 'center', lineHeight: 1.7 }}>
        예약 변경은 원하는 시간대를 다시 선택하면 자동 이동됩니다.<br />
        현장 확인을 위해 예약한 계정으로 로그인한 화면을 보여주세요.
      </p>
    </>,
  );
}
