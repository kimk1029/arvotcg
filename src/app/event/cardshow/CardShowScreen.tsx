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
  myReservation: {
    slotId: number;
    reservedAt: string;
    checkedInAt: string | null;
    slot: Pick<Slot, 'id' | 'date' | 'time' | 'capacity'>;
  } | null;
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
  // 슬롯 클릭 → 바로 실행하지 않고 확인 모달을 먼저 띄운다 (예약/이동/취소 공통).
  const [confirm, setConfirm] = useState<Slot | null>(null);
  const [showCheckInConfirm, setShowCheckInConfirm] = useState(false);

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
    setConfirm(null);
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

  const checkIn = async () => {
    if (busy || !data?.myReservation) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await call('/api/cardshow/check-in', { method: 'POST', body: '{}' });
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setNotice(j?.error ?? '입장 확인에 실패했어요. 다시 시도해 주세요.');
        return;
      }
      setShowCheckInConfirm(false);
      setNotice('입장 확인이 완료되었습니다. 즐거운 관람 되세요! 🎉');
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
      {data.myReservation ? (() => {
        const mySlot = data.slots.find((s) => s.id === data.myReservation!.slotId) ?? data.myReservation.slot;
        const checkedIn = Boolean(data.myReservation.checkedInAt);
        return (
          <section style={{ marginBottom: 20, padding: '18px 18px 16px', borderRadius: 18, background: checkedIn ? 'rgba(45,212,191,0.14)' : 'rgba(255,210,63,0.12)', border: `2px solid ${checkedIn ? P.teal : P.gold}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ color: checkedIn ? P.teal : P.gold, fontSize: 12, fontWeight: 900, letterSpacing: 1.5 }}>
                  {checkedIn ? '✓ 입장 완료' : 'MY RESERVATION'}
                </div>
                <div style={{ marginTop: 7, fontSize: 21, fontWeight: 900 }}>
                  {mySlot.date.replace(/-/g, '.')} ({weekdayKo(mySlot.date)}) {mySlot.time}
                </div>
              </div>
              <div style={{ fontSize: 36 }}>{checkedIn ? '✅' : '🎟️'}</div>
            </div>
            {checkedIn ? (
              <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${P.line}`, color: P.sub, fontSize: 12.5 }}>
                입장 확인 시각: {new Date(data.myReservation.checkedInAt!).toLocaleString('ko-KR')}
              </div>
            ) : (
              <button
                onClick={() => setShowCheckInConfirm(true)}
                disabled={busy}
                style={{ width: '100%', marginTop: 16, padding: '13px 16px', border: 'none', borderRadius: 12, background: P.gold, color: '#3A2D00', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}
              >
                담당자 확인
              </button>
            )}
          </section>
        );
      })() : null}

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
              onClick={() => {
                if (mine && data.myReservation?.checkedInAt) return;
                setConfirm(s);
              }}
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

      <VisitNotice />

      {confirm ? (
        <ConfirmModal
          slot={confirm}
          mySlot={data.slots.find((s) => s.id === data.mySlotId) ?? null}
          busy={busy}
          onConfirm={() => act(confirm)}
          onClose={() => setConfirm(null)}
        />
      ) : null}

      {showCheckInConfirm ? (
        <CheckInConfirmModal
          busy={busy}
          onConfirm={checkIn}
          onClose={() => setShowCheckInConfirm(false)}
        />
      ) : null}
    </>,
  );
}

/**
 * 예약·입장 안내 — 동반 입장/대기/현장 방문 규칙. 페이지 하단에 작게 붙는다.
 * 앱은 이 페이지를 WebView 로 그대로 띄우므로(mobile/app/event/cardshow.tsx)
 * 여기만 고치면 웹·앱에 함께 반영된다.
 */
const VISIT_NOTES = [
  '1인 예약 시 동반 1인까지 함께 입장 가능합니다.',
  '자녀는 동반 1인 인원과 별도로 함께 입장 가능합니다.',
  '예약 시간에 방문하셔도 현장 상황에 따라 대기가 발생할 수 있습니다.',
  '사전 예약 없이 현장 방문도 가능합니다.',
  '현장 방문 고객은 도착 순서대로 순차 입장 안내드립니다.',
];

function VisitNotice() {
  return (
    <section
      style={{
        marginTop: 18,
        padding: '15px 16px 14px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${P.line}`,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 12, fontWeight: 900, letterSpacing: 0.6, color: P.sub }}>
        예약·입장 안내
      </h2>
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {VISIT_NOTES.map((t) => (
          <li key={t} style={{ display: 'flex', gap: 7, fontSize: 11.5, lineHeight: 1.65, color: P.dim }}>
            <span aria-hidden style={{ flex: 'none', color: P.teal }}>·</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p style={{ margin: '12px 0 0', paddingTop: 10, borderTop: `1px solid ${P.line}`, fontSize: 11.5, fontWeight: 700, color: P.sub, lineHeight: 1.6 }}>
        원활한 이용을 위해 예약 후 방문을 권장드립니다.
      </p>
    </section>
  );
}

function CheckInConfirmModal({ busy, onConfirm, onClose }: { busy: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(3px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, borderRadius: 20, padding: '26px 22px 20px', background: '#12233F', border: `1px solid ${P.line}`, boxShadow: '0 18px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 42 }}>🧑‍💼</div>
          <h3 style={{ margin: '10px 0 8px', fontSize: 19, fontWeight: 900 }}>현장 담당자 확인</h3>
          <p style={{ margin: '0 0 20px', color: P.sub, fontSize: 13.5, lineHeight: 1.65 }}>
            예약자와 방문 시간을 확인하셨나요?<br />확인하면 입장 완료 처리되며 예약을 변경하거나 취소할 수 없습니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={busy} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: `1px solid ${P.line}`, background: 'transparent', color: P.sub, fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>돌아가기</button>
          <button onClick={onConfirm} disabled={busy} style={{ flex: 1.4, padding: '13px 0', borderRadius: 12, border: 'none', background: P.teal, color: '#043', fontSize: 14.5, fontWeight: 900, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? '처리 중…' : '입장 완료 확인'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 예약/이동/취소 공통 확인 모달 — 날짜·요일·시간 정보를 보여주고 확인을 받는다. */
function ConfirmModal({
  slot,
  mySlot,
  busy,
  onConfirm,
  onClose,
}: {
  slot: Slot;
  mySlot: Slot | null;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isCancel = mySlot?.id === slot.id;
  const isMove = !isCancel && mySlot != null;
  const fmt = (s: Slot) => `${s.date.replace(/-/g, '.')} (${weekdayKo(s.date)}) ${s.time}`;

  const title = isCancel ? '예약을 취소하시겠습니까?' : isMove ? '예약을 이 시간으로 옮기시겠습니까?' : '예약하시겠습니까?';
  const icon = isCancel ? '🗑️' : '🎟️';
  const accent = isCancel ? P.red : P.teal;

  const row = (label: string, value: string, strike = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: `1px solid ${P.line}` }}>
      <span style={{ fontSize: 12.5, color: P.dim, flex: 'none' }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: P.ink, textAlign: 'right', textDecoration: strike ? 'line-through' : 'none', opacity: strike ? 0.55 : 1 }}>
        {value}
      </span>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, borderRadius: 20, padding: '26px 22px 20px',
          background: '#12233F', border: `1px solid ${P.line}`, boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 38 }}>{icon}</div>
          <h3 style={{ fontSize: 17, fontWeight: 900, margin: '10px 0 0', color: P.ink }}>{title}</h3>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '6px 14px', marginBottom: 18 }}>
          {isMove && mySlot ? row('기존 예약', fmt(mySlot), true) : null}
          {row(isCancel ? '취소할 예약' : '방문 일시', fmt(slot))}
          {!isCancel ? row('잔여석', `${slot.remaining}석 (${slot.reserved}/${slot.capacity} 예약됨)`) : null}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 12, cursor: 'pointer', fontSize: 14.5, fontWeight: 800,
              border: `1px solid ${P.line}`, background: 'transparent', color: P.sub,
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1.4, padding: '13px 0', borderRadius: 12, cursor: 'pointer', fontSize: 14.5, fontWeight: 900,
              border: 'none', background: accent, color: isCancel ? '#FFF' : '#043',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? '처리 중…' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
