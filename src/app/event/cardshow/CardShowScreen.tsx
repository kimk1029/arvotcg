'use client';

/**
 * 카드쇼 사전예약 — Claude Design 'ARVO 카드쇼 예약' 레이아웃.
 *  날짜 캘린더 칩 · 행사 요약 카드 · 예약/입장 안내 · 타임테이블(시간레일+잔여석+라디오)
 *  · 하단 고정 CTA. 시간을 고르면 선택만 되고, CTA 를 눌러야 확인 모달이 뜬다.
 *
 * 앱은 이 페이지를 WebView 로 그대로 띄우므로(mobile/app/event/cardshow.tsx)
 * 여기만 고치면 웹·앱에 함께 반영된다.
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

/** 프로토타입 팔레트 (라이트). 이 페이지는 앱 테마와 무관하게 행사 페이지 고유 톤을 쓴다. */
const P = {
  bg: '#F7F7F9',
  card: '#FFFFFF',
  line: '#EFEFF2',
  line2: '#F4F4F6',
  ink: '#16161a',
  sub: '#6B6B70',
  dim: '#9A9AA0',
  mute: '#B0B0B6',
  orange: '#FF7A00',
  orangeSoft: '#FFF1E6',
  green: '#2BB673',
  red: '#F5333F',
  gray: '#D2D2D8',
};

/**
 * 행사 안내 문구 — DB에 행사 메타(장소/명칭)가 없어 여기서 관리한다.
 * 다음 행사를 열 때 이 상수만 고치면 된다.
 */
const EVENT = {
  title: 'ARVO 카드쇼',
  venue: '서울 성수 S팩토리 A동',
};

/** 잔여 비율로 본 시간대 상태 — 날짜 칩 태그와 타임테이블 색이 같은 기준을 쓴다. */
type SlotState = 'soldout' | 'tight' | 'open';
function slotState(remaining: number, capacity: number): SlotState {
  if (remaining <= 0) return 'soldout';
  return capacity > 0 && remaining / capacity <= 0.2 ? 'tight' : 'open';
}
const STATE_COLOR: Record<SlotState, string> = { soldout: P.gray, tight: P.orange, open: P.green };
const STATE_LABEL: Record<SlotState, string> = { soldout: '매진', tight: '임박', open: '여유' };

/** 오늘부터 행사일까지 D-N. 당일이면 D-DAY, 지났으면 null. */
function dDay(dateStr: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return null;
  return diff === 0 ? 'D-DAY' : `D-${diff}`;
}

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
  // 슬롯 탭 = 선택만. 예약/이동/취소는 하단 CTA → 확인 모달을 거친다.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // '내 예약 보기' 모달 — 예약 상세 + 담당자 확인 + 예약 취소.
  const [myOpen, setMyOpen] = useState(false);

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
      setSelectedId(null);
      await load();
    } catch {
      setNotice('요청에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  /** 예약 취소 — '내 예약 보기' 모달에서만 호출된다(목록의 내 예약 칸은 비활성). */
  const cancelReservation = async () => {
    if (busy || !data?.myReservation) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await call('/api/cardshow/reserve', { method: 'DELETE' });
      if (!r.ok) throw new Error();
      setMyOpen(false);
      setSelectedId(null);
      setNotice('예약이 취소되었어요.');
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
    <div className="pagebg" style={{ background: P.bg, color: P.ink, fontFamily: "'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background: P.card, borderBottom: `1px solid ${P.line}` }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 20px 12px' }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>카드쇼 사전예약</div>
        </div>
      </div>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 40px' }}>{children}</div>
    </div>
  );

  if (failed) {
    return shell(
      <div style={{ textAlign: 'center', padding: 40, background: P.card, borderRadius: 18 }}>
        <div style={{ fontSize: 40 }}>😵</div>
        <p style={{ color: P.sub }}>정보를 불러오지 못했어요.</p>
        <button onClick={load} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: P.ink, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>다시 시도</button>
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
        <a href="/login?callbackUrl=/event/cardshow" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: P.ink, color: '#fff', fontWeight: 800, textDecoration: 'none' }}>
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

  /* 파생값 — 슬롯에서 직접 계산해 하드코딩하지 않는다. */
  const dayRemaining = daySlots.reduce((a, s) => a + s.remaining, 0);
  const dayCapacity = daySlots.reduce((a, s) => a + s.capacity, 0);
  // 마지막 슬롯의 종료 시각은 데이터에 없으므로 '입장 시작 시간대'로만 표기한다.
  const openHours = daySlots.length > 0
    ? `${daySlots[0].time} ~ ${daySlots[daySlots.length - 1].time} 입장`
    : '';
  const mySlot = data.myReservation
    ? data.slots.find((s) => s.id === data.myReservation!.slotId) ?? data.myReservation.slot
    : null;
  const checkedIn = Boolean(data.myReservation?.checkedInAt);
  // 내 예약 시간대는 목록에서 비활성이라 selected 로 잡히지 않는다(취소는 '내 예약 보기').
  const selected = selectedId != null ? daySlots.find((s) => s.id === selectedId) ?? null : null;

  return shell(
    <>
      {/* 날짜 캘린더 칩 */}
      <div className="cv-hrow" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {dates.map((d, i) => {
          const on = d === activeDate;
          const ds = (data.slots ?? []).filter((x) => x.date === d);
          const rem = ds.reduce((a, x) => a + x.remaining, 0);
          const cap = ds.reduce((a, x) => a + x.capacity, 0);
          const st = slotState(rem, cap);
          return (
            <button
              key={d}
              onClick={() => { setDateIdx(i); setSelectedId(null); }}
              style={{
                flex: 'none', width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '9px 0 10px', borderRadius: 14, cursor: 'pointer',
                background: on ? P.ink : P.card, border: `1.5px solid ${on ? P.ink : P.line}`,
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: 700, color: on ? 'rgba(255,255,255,.7)' : P.dim }}>{weekdayKo(d)}</span>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5, color: on ? '#fff' : P.ink }}>{Number(d.slice(8, 10))}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: on ? '#FFB86B' : STATE_COLOR[st] }}>{STATE_LABEL[st]}</span>
            </button>
          );
        })}
      </div>

      {/* 내 예약 — 상세/취소는 '내 예약 보기' 모달에서 */}
      {mySlot ? (
        <button
          onClick={() => setMyOpen(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            padding: '13px 14px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
            background: checkedIn ? 'rgba(43,182,115,0.10)' : P.orangeSoft,
            border: `1.5px solid ${checkedIn ? P.green : P.orange}`,
          }}
        >
          <span style={{ fontSize: 24, flex: 'none' }}>{checkedIn ? '✅' : '🎟️'}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 10.5, fontWeight: 900, letterSpacing: 1, color: checkedIn ? P.green : P.orange }}>
              {checkedIn ? '입장 완료' : 'MY RESERVATION'}
            </span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 900, color: P.ink, marginTop: 3 }}>
              {mySlot.date.replace(/-/g, '.')} ({weekdayKo(mySlot.date)}) {mySlot.time}
            </span>
          </span>
          <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 800, color: P.sub }}>
            내 예약 보기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </span>
        </button>
      ) : null}

      {/* 행사 요약 */}
      <section style={{ background: P.card, borderRadius: 18, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,.04)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: P.red, padding: '3px 8px', borderRadius: 8 }}>사전예약</span>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: P.orange, background: P.orangeSoft, padding: '3px 8px', borderRadius: 8 }}>무료 입장</span>
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.5, margin: '10px 0 0', lineHeight: 1.3 }}>{EVENT.title}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          <InfoLine icon="pin">{EVENT.venue}</InfoLine>
          <InfoLine icon="clock">
            {activeDate ? `${activeDate.replace(/-/g, '.')} (${weekdayKo(activeDate)})` : ''}{openHours ? ` · ${openHours}` : ''}
          </InfoLine>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${P.line2}` }}>
          <Stat label="전체 잔여석" value={`${dayRemaining}석`} />
          <Stat label="예약 마감" value={activeDate ? (dDay(activeDate) ?? '종료') : '—'} color={P.red} />
          <Stat label="입장 인원" value="1인 + 동반 1인" />
        </div>
      </section>

      <VisitNotice />

      {notice ? (
        <div style={{ margin: '12px 0 0', padding: '11px 14px', borderRadius: 12, background: P.orangeSoft, border: `1px solid ${P.orange}`, color: '#B4530A', fontSize: 13, fontWeight: 700 }}>
          {notice}
        </div>
      ) : null}

      {/* 타임테이블 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 4px 10px' }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800 }}>타임테이블</div>
        {(['open', 'tight', 'soldout'] as SlotState[]).map((st) => (
          <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: '#8E8E93' }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: STATE_COLOR[st] }} />
            {st === 'open' ? '여유' : st === 'tight' ? '마감임박' : '매진'}
          </div>
        ))}
      </div>

      <div>
        {daySlots.map((s, i) => {
          const mine = data.mySlotId === s.id;
          const st = slotState(s.remaining, s.capacity);
          const soldout = st === 'soldout' && !mine;
          const sel = selectedId === s.id;
          return (
            <button
              key={s.id}
              // 이미 예약한 시간대는 비활성 — 변경/취소는 '내 예약 보기'에서.
              disabled={soldout || mine || busy}
              onClick={() => setSelectedId(sel ? null : s.id)}
              style={{
                display: 'flex', alignItems: 'stretch', width: '100%', padding: 0, marginBottom: 9,
                background: sel || mine ? P.orangeSoft : P.card,
                border: `1.5px solid ${sel || mine ? P.orange : P.line}`,
                borderRadius: 16, overflow: 'hidden', textAlign: 'left',
                cursor: soldout || mine ? 'default' : 'pointer', opacity: soldout ? 0.55 : 1,
              }}
            >
              {/* 시간 레일 — 시작 시각만 (종료 시각은 데이터에 없다) */}
              <span style={{ flex: 'none', width: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', background: sel || mine ? 'rgba(255,122,0,.10)' : P.bg, padding: '16px 0' }}>
                <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.4, color: soldout ? P.mute : P.ink }}>{s.time}</span>
              </span>
              {/* 본문 — 잔여석/예약현황 (막대 그래프 없음) */}
              <span style={{ flex: 1, minWidth: 0, padding: '12px 13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: st === 'soldout' ? P.mute : STATE_COLOR[st] }}>
                    {st === 'soldout' ? '매진' : `잔여 ${s.remaining}석`}
                  </span>
                  {mine ? (
                    <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 800, color: '#fff', background: P.orange, padding: '2px 6px', borderRadius: 6 }}>내 예약</span>
                  ) : st === 'tight' ? (
                    <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 800, color: '#fff', background: P.red, padding: '2px 6px', borderRadius: 6 }}>마감임박</span>
                  ) : null}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: P.dim, fontWeight: 600, marginTop: 4 }}>
                  정원 {s.capacity}석 · {s.reserved}명 예약
                </span>
              </span>
              {/* 선택 표시 — 내 예약은 체크로 고정, 그 외는 라디오 */}
              <span style={{ flex: 'none', width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {mine ? (
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: P.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                ) : !soldout ? (
                  <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? P.orange : P.gray}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sel ? <span style={{ width: 11, height: 11, borderRadius: '50%', background: P.orange }} /> : null}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: P.mute, fontWeight: 600, padding: '4px 4px 0', lineHeight: 1.6, margin: 0 }}>
        · 예약 변경은 원하는 시간대를 고르고 다시 신청하면 자동으로 이동됩니다.<br />
        · 현장 확인을 위해 예약한 계정으로 로그인한 화면을 보여주세요.<br />
        · 잔여석은 실시간으로 변동될 수 있습니다.
      </p>

      {/* 예약 버튼 — 리스트 제일 아래에 그대로 붙는다(스크롤 따라다니지 않음). */}
      <button
        disabled={!selected || busy}
        onClick={() => selected && setConfirm(selected)}
        style={{
          width: '100%', height: 52, marginTop: 14, borderRadius: 14, border: 'none',
          background: selected ? P.ink : '#F2F2F4', color: selected ? '#fff' : P.mute,
          fontSize: 15.5, fontWeight: 800, cursor: selected ? 'pointer' : 'default',
          boxShadow: selected ? '0 6px 16px rgba(0,0,0,.18)' : 'none',
        }}
      >
        {busy ? '처리 중…' : selected ? `${selected.time} 사전예약 신청` : '시간을 선택하세요'}
      </button>

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

      {myOpen && mySlot ? (
        <MyReservationModal
          slot={mySlot}
          reservedAt={data.myReservation?.reservedAt ?? null}
          checkedInAt={data.myReservation?.checkedInAt ?? null}
          busy={busy}
          onCheckIn={() => { setMyOpen(false); setShowCheckInConfirm(true); }}
          onCancel={cancelReservation}
          onClose={() => setMyOpen(false)}
        />
      ) : null}
    </>,
  );
}

function InfoLine({ icon, children }: { icon: 'pin' | 'clock'; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: P.sub, fontWeight: 600 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.dim} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
        {icon === 'pin' ? (
          <>
            <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7Z" />
            <circle cx="12" cy="9" r="2.5" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </>
        )}
      </svg>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: P.dim, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color: color ?? P.ink, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

/**
 * 예약·입장 안내 — 동반 입장/대기/현장 방문 규칙. 시간대를 고르기 전에 읽도록
 * 타임테이블 위에 둔다.
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
    <section style={{ background: P.card, borderRadius: 16, padding: '15px 16px 14px', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
      <h2 style={{ margin: 0, fontSize: 12.5, fontWeight: 900, letterSpacing: 0.3, color: P.ink }}>예약·입장 안내</h2>
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {VISIT_NOTES.map((t) => (
          <li key={t} style={{ display: 'flex', gap: 7, fontSize: 11.5, lineHeight: 1.65, color: P.sub }}>
            <span aria-hidden style={{ flex: 'none', color: P.orange, fontWeight: 900 }}>·</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p style={{ margin: '12px 0 0', paddingTop: 10, borderTop: `1px solid ${P.line2}`, fontSize: 11.5, fontWeight: 800, color: P.ink, lineHeight: 1.6 }}>
        원활한 이용을 위해 예약 후 방문을 권장드립니다.
      </p>
    </section>
  );
}

/** 모달 공통 껍데기 — 라이트 팔레트. */
function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(22,22,26,0.5)', backdropFilter: 'blur(3px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 360, borderRadius: 20, padding: '24px 20px 18px', background: P.card, boxShadow: '0 18px 50px rgba(0,0,0,0.28)' }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * 내 예약 보기 — 예약 상세 + 담당자 확인 + 예약 취소.
 * 입장 완료(checkedInAt)된 예약은 취소할 수 없다(서버 정책과 동일).
 */
function MyReservationModal({
  slot,
  reservedAt,
  checkedInAt,
  busy,
  onCheckIn,
  onCancel,
  onClose,
}: {
  slot: Pick<Slot, 'id' | 'date' | 'time' | 'capacity'>;
  reservedAt: string | null;
  checkedInAt: string | null;
  busy: boolean;
  onCheckIn: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const done = Boolean(checkedInAt);

  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${P.line2}` }}>
      <span style={{ fontSize: 12.5, color: P.dim, flex: 'none', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: P.ink, textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <ModalShell onClose={onClose}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 36 }}>{done ? '✅' : '🎟️'}</div>
        <h3 style={{ fontSize: 17, fontWeight: 900, margin: '10px 0 0', color: P.ink }}>내 예약</h3>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, fontWeight: 700, color: done ? P.green : P.orange }}>
          {done ? '입장 완료' : '입장 대기'}
        </p>
      </div>

      <div style={{ background: P.bg, borderRadius: 14, padding: '4px 14px', marginBottom: 16 }}>
        {row('방문 일시', `${slot.date.replace(/-/g, '.')} (${weekdayKo(slot.date)}) ${slot.time}`)}
        {row('입장 인원', '1인 + 동반 1인')}
        {reservedAt ? row('예약 시각', new Date(reservedAt).toLocaleString('ko-KR')) : null}
        {checkedInAt ? row('입장 확인', new Date(checkedInAt).toLocaleString('ko-KR')) : null}
      </div>

      {done ? (
        <button onClick={onClose} style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: P.ink, color: '#fff', fontSize: 14.5, fontWeight: 900, cursor: 'pointer' }}>
          닫기
        </button>
      ) : confirming ? (
        <>
          <p style={{ margin: '0 0 12px', textAlign: 'center', fontSize: 13.5, fontWeight: 800, color: P.ink }}>
            예약을 취소하시겠습니까?
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setConfirming(false)} disabled={busy} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: `1.5px solid ${P.line}`, background: P.card, color: P.sub, fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>
              돌아가기
            </button>
            <button onClick={onCancel} disabled={busy} style={{ flex: 1.4, padding: '13px 0', borderRadius: 12, border: 'none', background: P.red, color: '#fff', fontSize: 14.5, fontWeight: 900, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? '처리 중…' : '예약 취소'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onCheckIn} disabled={busy} style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: P.orange, color: '#fff', fontSize: 14.5, fontWeight: 900, cursor: 'pointer' }}>
            담당자 확인
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={busy} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${P.line}`, background: P.card, color: P.sub, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>
              닫기
            </button>
            <button onClick={() => setConfirming(true)} disabled={busy} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${P.red}`, background: P.card, color: P.red, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>
              예약 취소
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function CheckInConfirmModal({ busy, onConfirm, onClose }: { busy: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🧑‍💼</div>
        <h3 style={{ margin: '10px 0 8px', fontSize: 18, fontWeight: 900, color: P.ink }}>현장 담당자 확인</h3>
        <p style={{ margin: '0 0 20px', color: P.sub, fontSize: 13, lineHeight: 1.65 }}>
          예약자와 방문 시간을 확인하셨나요?<br />확인하면 입장 완료 처리되며 예약을 변경하거나 취소할 수 없습니다.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} disabled={busy} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: `1.5px solid ${P.line}`, background: P.card, color: P.sub, fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>돌아가기</button>
        <button onClick={onConfirm} disabled={busy} style={{ flex: 1.4, padding: '13px 0', borderRadius: 12, border: 'none', background: P.green, color: '#fff', fontSize: 14.5, fontWeight: 900, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? '처리 중…' : '입장 완료 확인'}
        </button>
      </div>
    </ModalShell>
  );
}

/**
 * 예약/이동/취소 확인 모달 — 하단 CTA 를 눌렀을 때 "예약하시겠습니까?" 로 한 번 더 묻는다.
 * (시간대를 탭하는 것만으로는 아무 일도 일어나지 않는다.)
 */
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
  // 취소는 '내 예약 보기'에서만 — 여기는 신규 예약 / 다른 시간대로 이동만 다룬다.
  const isMove = mySlot != null && mySlot.id !== slot.id;
  const fmt = (s: Pick<Slot, 'date' | 'time'>) => `${s.date.replace(/-/g, '.')} (${weekdayKo(s.date)}) ${s.time}`;

  const title = isMove ? '예약을 이 시간으로 옮기시겠습니까?' : '예약하시겠습니까?';

  const row = (label: string, value: string, strike = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${P.line2}` }}>
      <span style={{ fontSize: 12.5, color: P.dim, flex: 'none', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: P.ink, textAlign: 'right', textDecoration: strike ? 'line-through' : 'none', opacity: strike ? 0.5 : 1 }}>
        {value}
      </span>
    </div>
  );

  return (
    <ModalShell onClose={onClose}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 36 }}>🎟️</div>
        <h3 style={{ fontSize: 17, fontWeight: 900, margin: '10px 0 0', color: P.ink }}>{title}</h3>
      </div>

      <div style={{ background: P.bg, borderRadius: 14, padding: '4px 14px', marginBottom: 16 }}>
        {isMove && mySlot ? row('기존 예약', fmt(mySlot), true) : null}
        {row('방문 일시', fmt(slot))}
        {row('잔여석', `${slot.remaining}석 (${slot.reserved}/${slot.capacity} 예약됨)`)}
        {row('입장 인원', '1인 + 동반 1인')}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onClose}
          disabled={busy}
          style={{ flex: 1, padding: '13px 0', borderRadius: 12, cursor: 'pointer', fontSize: 14.5, fontWeight: 800, border: `1.5px solid ${P.line}`, background: P.card, color: P.sub }}
        >
          취소
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{ flex: 1.4, padding: '13px 0', borderRadius: 12, cursor: 'pointer', fontSize: 14.5, fontWeight: 900, border: 'none', background: P.ink, color: '#fff', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? '처리 중…' : '확인'}
        </button>
      </div>
    </ModalShell>
  );
}
