'use client';

import { STORE_REVIEW_URL, storePlatformFromUa } from '../../../shared/reviewPrompt';

/**
 * 예약형 이벤트 화면 — 카드쇼(/event/cardshow)와 트레이드 데이(/event/tradeday)가 같은 컴포넌트를 쓴다.
 * 행사별 차이(제목·팔레트·1부/2부 회차·안내 박스·슬롯 카드 표시 항목)는 shared/eventPages.ts 설정으로.
 *
 *  날짜 캘린더 칩 · 행사 요약 카드 · (안내 박스) · 타임테이블(회차 헤더 + 시간레일 + 잔여석 + 상태점 + 라디오)
 *  · (하단 안내 박스) · 예약 CTA. 시간을 고르면 선택만 되고, CTA 를 눌러야 확인 모달이 뜬다.
 *
 * 앱은 이 페이지를 WebView 로 그대로 띄우므로(mobile/app/event/*.tsx) 여기만 고치면 웹·앱에 함께 반영된다.
 *
 * 인증 두 경로:
 *  · 브라우저: 웹 세션 쿠키 (credentials include)
 *  · 앱 웹뷰: URL ?token=<JWT> — 앱이 로그인 토큰을 붙여 열며, 모든 API 를 Authorization 헤더로 호출한다.
 * 정책: 행사당 1인 1예약 — 같은 행사의 다른 시간대를 누르면 예약이 이동. 취소는 '내 예약 보기'.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EVENT_PAGES,
  SLOT_STATE_LABEL,
  sessionIndexFor,
  sessionFor,
  slotDisplay,
  slotCapacityLabel,
  fillEventText,
  type EventKey,
  type EventNoticeBox,
  type EventPageConfig,
} from '@/lib/eventPages';

interface Slot {
  id: number;
  date: string;
  time: string;
  capacity: number;
  reserved: number;
  remaining: number;
}

/** 날짜별 행사 정보 — 어드민(카드쇼 관리)에서 입력. 없으면 설정의 기본 문구로 렌더. */
interface EventInfo {
  date: string;
  title: string;
  venue: string;
  hours: string;
  badges: string[];
  note: string;
}

interface SlotsResp {
  loggedIn: boolean;
  mySlotId: number | null;
  myReservation: {
    slotId: number;
    reservedAt: string;
    checkedInAt: string | null;
    /** 입장 완료 후 본인이 확인한 이벤트 참여 / 리뷰 이벤트 참여 시각. 구서버 응답엔 없을 수 있다. */
    eventJoinedAt?: string | null;
    reviewJoinedAt?: string | null;
    slot: Pick<Slot, 'id' | 'date' | 'time' | 'capacity'>;
  } | null;
  slots: Slot[];
  events?: EventInfo[];
}

/** 화면 팔레트 — light(카드쇼 프로토타입) / night(트레이드 데이: 다크 네이비 + 글래스 카드). */
interface Palette {
  pageBg: string;
  card: string;
  cardShadow: string;
  line: string;
  line2: string;
  ink: string;
  sub: string;
  dim: string;
  mute: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  green: string;
  red: string;
  gray: string;
  rail: string;
  ctaOff: string;
  ctaOffText: string;
  modalBg: string;
  chipOnBg: string;
  chipOnText: string;
  chipOnSub: string;
  chipOnState: string;
}

const LIGHT: Palette = {
  pageBg: '#F7F7F9',
  card: '#FFFFFF',
  cardShadow: '0 2px 8px rgba(0,0,0,.04)',
  line: '#EFEFF2',
  line2: '#F4F4F6',
  ink: '#16161a',
  sub: '#6B6B70',
  dim: '#9A9AA0',
  mute: '#B0B0B6',
  accent: '#FF7A00',
  accentSoft: '#FFF1E6',
  accentText: '#B4530A',
  green: '#2BB673',
  red: '#F5333F',
  gray: '#D2D2D8',
  rail: '#F7F7F9',
  ctaOff: '#F2F2F4',
  ctaOffText: '#B0B0B6',
  modalBg: '#F7F7F9',
  chipOnBg: '#16161a',
  chipOnText: '#fff',
  chipOnSub: 'rgba(255,255,255,.7)',
  chipOnState: '#FFB86B',
};

const NIGHT: Palette = {
  pageBg: 'linear-gradient(180deg,#0B1024 0%,#0A0D1F 55%,#07091A 100%)',
  card: 'rgba(255,255,255,0.055)',
  cardShadow: '0 10px 30px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.06)',
  line: 'rgba(255,255,255,0.12)',
  line2: 'rgba(255,255,255,0.08)',
  ink: '#FFFFFF',
  sub: 'rgba(255,255,255,0.72)',
  dim: 'rgba(255,255,255,0.5)',
  mute: 'rgba(255,255,255,0.35)',
  accent: '#2DD4BF',
  accentSoft: 'rgba(45,212,191,0.14)',
  accentText: '#7FF0E1',
  green: '#34D399',
  red: '#FB7185',
  gray: 'rgba(255,255,255,0.28)',
  rail: 'rgba(255,255,255,0.05)',
  ctaOff: 'rgba(255,255,255,0.08)',
  ctaOffText: 'rgba(255,255,255,0.35)',
  modalBg: 'rgba(255,255,255,0.06)',
  chipOnBg: '#2DD4BF',
  chipOnText: '#06201C',
  chipOnSub: 'rgba(6,32,28,.7)',
  chipOnState: '#06201C',
};

/** 잔여 비율로 본 시간대 상태 — 날짜 칩 태그와 타임테이블 색이 같은 기준을 쓴다. */
type SlotState = 'soldout' | 'tight' | 'open';
function slotState(remaining: number, capacity: number): SlotState {
  if (remaining <= 0) return 'soldout';
  return capacity > 0 && remaining / capacity <= 0.2 ? 'tight' : 'open';
}

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

const fmtDate = (d: string) => `${d.replace(/-/g, '.')} (${weekdayKo(d)})`;

export function EventReserveScreen({ eventKey }: { eventKey: EventKey }) {
  const config = EVENT_PAGES[eventKey];
  const P = config.theme === 'night' ? NIGHT : LIGHT;
  const STATE_COLOR: Record<SlotState, string> = { soldout: P.gray, tight: P.accent, open: P.green };

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
  const [confirm, setConfirm] = useState<Slot | null>(null);
  const [showCheckInConfirm, setShowCheckInConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [myOpen, setMyOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await call(`/api/cardshow/slots?event=${eventKey}`);
      if (!r.ok) throw new Error(String(r.status));
      setData((await r.json()) as SlotsResp);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [call, eventKey]);

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
        body: JSON.stringify({ slotId: slot.id, event: eventKey }),
      });
      const j = (await r.json().catch(() => null)) as { error?: string; moved?: boolean } | null;
      if (!r.ok) {
        setNotice(j?.error ?? '예약에 실패했어요. 다시 시도해 주세요.');
      } else {
        setNotice(
          j?.moved
            ? `예약을 ${slot.date} ${slotDisplay(config, slot.time)} 으로 옮겼어요! 🎟️`
            : `${slot.date} ${slotDisplay(config, slot.time)} 예약 완료! 🎟️`,
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

  const cancelReservation = async () => {
    if (busy || !data?.myReservation) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await call(`/api/cardshow/reserve?event=${eventKey}`, { method: 'DELETE' });
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
      const r = await call('/api/cardshow/check-in', { method: 'POST', body: JSON.stringify({ event: eventKey }) });
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setNotice(j?.error ?? '입장 확인에 실패했어요. 다시 시도해 주세요.');
        return;
      }
      setShowCheckInConfirm(false);
      setNotice('입장 확인이 완료되었습니다. 즐거운 시간 되세요! 🎉');
      await load();
    } catch {
      setNotice('요청에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  /** 이벤트 참여 / 리뷰 이벤트 참여 확정 — 입장 완료자만. 서버가 멱등 처리. */
  const participate = async (kind: 'event' | 'review') => {
    if (busy || !data?.myReservation) return;
    const field = kind === 'event' ? 'eventJoinedAt' : 'reviewJoinedAt';
    // 낙관적 반영 — 확인을 누르는 즉시 '참여완료 ✓' 로 바꾼다(서버 응답을 기다리면 아무 동작이 없는 것처럼 보임, 2026-09-12).
    // 실패하면 이전 값으로 되돌리고 안내한다.
    const prev = data.myReservation[field] ?? null;
    const patch = (v: string | null) => setData((d) => (d?.myReservation ? { ...d, myReservation: { ...d.myReservation, [field]: v } } : d));
    patch(new Date().toISOString());
    setBusy(true);
    setNotice(null);
    try {
      const r = await call('/api/cardshow/participate', { method: 'POST', body: JSON.stringify({ event: eventKey, kind }) });
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        patch(prev);
        setNotice(j?.error ?? '참여 처리에 실패했어요. 다시 시도해 주세요.');
        return;
      }
      // 서버 시각으로 맞추기 위한 재조회 — 화면은 이미 완료 상태라 기다리지 않는다.
      void load();
    } catch {
      patch(prev);
      setNotice('요청에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  /* ---------- 렌더 ---------- */

  const night = config.theme === 'night';
  const shell = (children: React.ReactNode) => (
    <div
      className="pagebg"
      style={{
        background: P.pageBg,
        color: P.ink,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif",
      }}
    >
      {night ? (
        <>
          {/* 스타일리시 배경 — 그리드 + 글로우 두 점 */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)', backgroundSize: '28px 28px', maskImage: 'linear-gradient(180deg,rgba(0,0,0,.9),rgba(0,0,0,0) 70%)', WebkitMaskImage: 'linear-gradient(180deg,rgba(0,0,0,.9),rgba(0,0,0,0) 70%)' }} />
          <div aria-hidden style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 460, height: 460, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle,rgba(45,212,191,.22),rgba(45,212,191,0) 62%)' }} />
          <div aria-hidden style={{ position: 'absolute', top: 380, right: -160, width: 420, height: 420, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle,rgba(139,92,246,.2),rgba(139,92,246,0) 62%)' }} />
        </>
      ) : null}
      <div style={{ position: 'relative', background: night ? 'rgba(7,9,26,.55)' : P.card, borderBottom: `1px solid ${P.line}`, backdropFilter: night ? 'blur(8px)' : undefined }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 20px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {night ? <span style={{ width: 8, height: 8, borderRadius: 4, background: P.accent, boxShadow: `0 0 10px ${P.accent}` }} /> : null}
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>{config.header}</div>
        </div>
      </div>
      <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto', padding: '16px 16px 40px' }}>{children}</div>
    </div>
  );

  const box = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    background: P.card,
    borderRadius: 18,
    padding: 16,
    boxShadow: P.cardShadow,
    border: night ? `1px solid ${P.line}` : undefined,
    backdropFilter: night ? 'blur(10px)' : undefined,
    ...extra,
  });

  if (failed) {
    return shell(
      <div style={box({ textAlign: 'center', padding: 40 })}>
        <div style={{ fontSize: 40 }}>😵</div>
        <p style={{ color: P.sub }}>정보를 불러오지 못했어요.</p>
        <button onClick={load} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: night ? P.accent : P.ink, color: night ? P.chipOnText : '#fff', fontWeight: 800, cursor: 'pointer' }}>다시 시도</button>
      </div>,
    );
  }

  if (!data) {
    return shell(<div style={{ textAlign: 'center', color: P.dim, padding: 60 }}>불러오는 중…</div>);
  }

  if (!data.loggedIn) {
    return shell(
      <div style={box({ textAlign: 'center', padding: '44px 24px', borderRadius: 20 })}>
        <div style={{ fontSize: 46 }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: '12px 0 8px' }}>로그인해주세요!</h2>
        <p style={{ fontSize: 13.5, color: P.sub, lineHeight: 1.7, margin: '0 0 20px' }}>
          {config.loginNote}<br />앱에서는 로그인 후 다시 열어주세요.
        </p>
        <a href={`/login?callbackUrl=${encodeURIComponent(config.path)}`} style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: night ? P.accent : P.ink, color: night ? P.chipOnText : '#fff', fontWeight: 800, textDecoration: 'none' }}>
          로그인하기
        </a>
      </div>,
    );
  }

  if (dates.length === 0) {
    return shell(
      <>
        <SummaryCard config={config} P={P} night={night} info={null} activeDate={config.fallback.date || null} daySlots={[]} box={box} />
        {config.topNotice ? <NoticeBox P={P} night={night} box={box} n={config.topNotice} capacity={null} /> : null}
        <div style={box({ textAlign: 'center', padding: 40, color: P.sub, marginTop: 12 })}>
          아직 오픈된 예약 시간대가 없어요. 곧 공개됩니다! 🎫
        </div>
      </>,
    );
  }

  const info = (data.events ?? []).find((e) => e.date === activeDate) ?? null;
  const mySlot = data.myReservation
    ? data.slots.find((s) => s.id === data.myReservation!.slotId) ?? data.myReservation.slot
    : null;
  const checkedIn = Boolean(data.myReservation?.checkedInAt);
  const selected = selectedId != null ? daySlots.find((s) => s.id === selectedId) ?? null : null;
  // 정원 라벨 — 어드민이 슬롯에 설정한 capacity 에서. 설정 문구의 {capacity} 토큰을 이 값으로 채운다.
  const capacity = slotCapacityLabel(daySlots.map((s) => s.capacity));

  // 회차(1부/2부) 그룹 — 설정에 회차가 없으면 한 그룹.
  const groups: Array<{ label: string | null; range: string | null; slots: Slot[] }> =
    config.sessions.length === 0
      ? [{ label: null, range: null, slots: daySlots }]
      : [
          ...config.sessions.map((s) => ({ label: s.label, range: s.range, slots: [] as Slot[] })),
          { label: '기타', range: null, slots: [] as Slot[] },
        ];
  if (config.sessions.length > 0) {
    for (const s of daySlots) {
      const idx = sessionIndexFor(config, s.time);
      groups[idx >= 0 ? idx : groups.length - 1].slots.push(s);
    }
  }

  const renderSlot = (s: Slot) => {
    const mine = data.mySlotId === s.id;
    const st = slotState(s.remaining, s.capacity);
    const soldout = st === 'soldout' && !mine;
    const sel = selectedId === s.id;
    const hi = sel || mine;
    return (
      <button
        key={s.id}
        disabled={soldout || mine || busy}
        onClick={() => setSelectedId(sel ? null : s.id)}
        style={{
          display: 'flex', alignItems: 'stretch', width: '100%', padding: 0, marginBottom: 9,
          background: hi ? P.accentSoft : P.card,
          border: `1.5px solid ${hi ? P.accent : P.line}`,
          borderRadius: 16, overflow: 'hidden', textAlign: 'left',
          cursor: soldout || mine ? 'default' : 'pointer', opacity: soldout ? 0.5 : 1,
          boxShadow: night ? (hi ? `0 0 0 1px ${P.accent}33, 0 8px 24px rgba(0,0,0,.25)` : '0 6px 18px rgba(0,0,0,.2)') : 'none',
          backdropFilter: night ? 'blur(10px)' : undefined,
          color: P.ink,
        }}
      >
        {/* 시간 레일 — session 모드(트레이드 데이)는 회차 라벨 + 시간 범위, 아니면 시각 */}
        {config.slotMode === 'session' && sessionFor(config, s.time) ? (
          <span style={{ flex: 'none', width: 118, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: hi ? (night ? 'rgba(45,212,191,.12)' : 'rgba(255,122,0,.10)') : P.rail, padding: '16px 6px' }}>
            <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.3, color: soldout ? P.mute : P.ink, textAlign: 'center', lineHeight: 1.2 }}>{sessionFor(config, s.time)!.label.replace(/\s*\(.*\)$/, '')}</span>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: soldout ? P.mute : P.dim, whiteSpace: 'nowrap' }}>{sessionFor(config, s.time)!.range}</span>
          </span>
        ) : (
          <span style={{ flex: 'none', width: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hi ? (night ? 'rgba(45,212,191,.12)' : 'rgba(255,122,0,.10)') : P.rail, padding: config.showSlotMeta ? '16px 0' : '18px 0' }}>
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.4, color: soldout ? P.mute : P.ink }}>{s.time}</span>
          </span>
        )}
        {/* 본문 — 회차 잔여석 + 상태 점 */}
        <span style={{ flex: 1, minWidth: 0, padding: config.showSlotMeta ? '12px 13px' : '0 13px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span aria-hidden style={{ flex: 'none', width: 9, height: 9, borderRadius: 5, background: STATE_COLOR[st], boxShadow: night && st !== 'soldout' ? `0 0 8px ${STATE_COLOR[st]}` : undefined }} />
            <span style={{ fontSize: 14.5, fontWeight: 800, color: st === 'soldout' ? P.mute : STATE_COLOR[st] }}>
              {st === 'soldout' ? SLOT_STATE_LABEL.soldout : `잔여 ${s.remaining}석`}
            </span>
            {mine ? (
              <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 800, color: night ? P.chipOnText : '#fff', background: P.accent, padding: '2px 6px', borderRadius: 6 }}>내 예약</span>
            ) : st === 'tight' ? (
              <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 800, color: '#fff', background: P.red, padding: '2px 6px', borderRadius: 6 }}>{SLOT_STATE_LABEL.tight}</span>
            ) : null}
          </span>
          {config.showSlotMeta ? (
            <span style={{ display: 'block', fontSize: 11.5, color: P.dim, fontWeight: 600, marginTop: 4 }}>
              정원 {s.capacity}석 · {s.reserved}명 예약
            </span>
          ) : null}
        </span>
        {/* 선택 표시 */}
        <span style={{ flex: 'none', width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {mine ? (
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={night ? P.chipOnText : '#fff'} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
          ) : !soldout ? (
            <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? P.accent : P.gray}`, background: night ? 'rgba(255,255,255,.04)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {sel ? <span style={{ width: 11, height: 11, borderRadius: '50%', background: P.accent }} /> : null}
            </span>
          ) : null}
        </span>
      </button>
    );
  };

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
                background: on ? P.chipOnBg : P.card, border: `1.5px solid ${on ? P.chipOnBg : P.line}`,
                boxShadow: night && on ? `0 0 18px ${P.accent}66` : 'none',
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: 700, color: on ? P.chipOnSub : P.dim }}>{weekdayKo(d)}</span>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5, color: on ? P.chipOnText : P.ink }}>{Number(d.slice(8, 10))}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: on ? P.chipOnState : STATE_COLOR[st] }}>{SLOT_STATE_LABEL[st] === '마감임박' ? '임박' : SLOT_STATE_LABEL[st]}</span>
            </button>
          );
        })}
      </div>

      {/* 내 예약 */}
      {mySlot ? (
        <button
          onClick={() => setMyOpen(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            padding: '13px 14px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
            background: checkedIn ? 'rgba(43,182,115,0.12)' : P.accentSoft,
            border: `1.5px solid ${checkedIn ? P.green : P.accent}`,
            color: P.ink,
          }}
        >
          <span style={{ fontSize: 24, flex: 'none' }}>{checkedIn ? '✅' : '🎟️'}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 10.5, fontWeight: 900, letterSpacing: 1, color: checkedIn ? P.green : P.accent }}>
              {checkedIn ? '입장 완료' : 'MY RESERVATION'}
            </span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 900, color: P.ink, marginTop: 3 }}>
              {fmtDate(mySlot.date)} {mySlot.time}
            </span>
            {checkedIn ? (
              <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: P.sub, marginTop: 3 }}>
                이벤트 {data.myReservation?.eventJoinedAt ? '참여완료 ✓' : '미참여'} · 리뷰 이벤트 {data.myReservation?.reviewJoinedAt ? '참여완료 ✓' : '미참여'}
              </span>
            ) : null}
          </span>
          <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 800, color: P.sub }}>
            내 예약 보기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </span>
        </button>
      ) : null}

      <SummaryCard config={config} P={P} night={night} info={info} activeDate={activeDate} daySlots={daySlots} box={box} />

      {config.topNotice ? <NoticeBox P={P} night={night} box={box} n={config.topNotice} capacity={capacity} /> : null}
      {config.visitNotice && config.visitNoticePlacement === 'top' ? <VisitNotice P={P} box={box} n={config.visitNotice} capacity={capacity} /> : null}

      {notice ? (
        <div style={{ margin: '12px 0 0', padding: '11px 14px', borderRadius: 12, background: P.accentSoft, border: `1px solid ${P.accent}`, color: P.accentText, fontSize: 13, fontWeight: 700 }}>
          {notice}
        </div>
      ) : null}

      {/* 타임테이블 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 4px 10px' }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800 }}>타임테이블</div>
        {(['open', 'tight', 'soldout'] as SlotState[]).map((st) => (
          <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: P.dim }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: STATE_COLOR[st] }} />
            {SLOT_STATE_LABEL[st]}
          </div>
        ))}
      </div>

      <div>
        {groups.map((g) => {
          if (g.label && g.slots.length === 0) return null;
          const rem = g.slots.reduce((a, s) => a + s.remaining, 0);
          return (
            <div key={g.label ?? 'all'}>
              {g.label && config.slotMode !== 'session' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 2px 10px' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: 0.5, color: night ? P.chipOnText : '#fff', background: P.accent, padding: '3px 9px', borderRadius: 8 }}>{g.label}</span>
                  {g.range ? <span style={{ fontSize: 12.5, fontWeight: 800, color: P.ink }}>{g.range}</span> : null}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: P.dim }}>잔여 {rem}석</span>
                </div>
              ) : null}
              {g.slots.map(renderSlot)}
            </div>
          );
        })}
      </div>

      {config.bottomNotice ? <NoticeBox P={P} night={night} box={box} n={config.bottomNotice} capacity={capacity} /> : null}
      {config.visitNotice && config.visitNoticePlacement === 'bottom' ? <VisitNotice P={P} box={box} n={config.visitNotice} capacity={capacity} marginTop={12} /> : null}

      <p style={{ fontSize: 11, color: P.mute, fontWeight: 600, padding: '12px 4px 0', lineHeight: 1.6, margin: 0 }}>
        · 예약 변경은 원하는 시간대를 고르고 다시 신청하면 자동으로 이동됩니다.<br />
        · 현장 확인을 위해 예약한 계정으로 로그인한 화면을 보여주세요.<br />
        · 잔여석은 실시간으로 변동될 수 있습니다.
      </p>

      <button
        disabled={!selected || busy}
        onClick={() => selected && setConfirm(selected)}
        style={{
          width: '100%', height: 52, marginTop: 14, borderRadius: 14, border: 'none',
          background: selected ? (night ? `linear-gradient(90deg,${P.accent},#8B5CF6)` : P.ink) : P.ctaOff,
          color: selected ? (night ? '#06201C' : '#fff') : P.ctaOffText,
          fontSize: 15.5, fontWeight: 800, cursor: selected ? 'pointer' : 'default',
          boxShadow: selected ? (night ? '0 8px 24px rgba(45,212,191,.35)' : '0 6px 16px rgba(0,0,0,.18)') : 'none',
        }}
      >
        {busy ? '처리 중…' : selected ? `${slotDisplay(config, selected.time)} 사전예약 신청` : config.slotMode === 'session' ? '테이블(회차)을 선택하세요' : '시간을 선택하세요'}
      </button>

      {confirm ? (
        <ConfirmModal P={P} night={night} config={config} slot={confirm} mySlot={data.slots.find((s) => s.id === data.mySlotId) ?? null} busy={busy} onConfirm={() => act(confirm)} onClose={() => setConfirm(null)} />
      ) : null}

      {showCheckInConfirm ? (
        <CheckInConfirmModal P={P} night={night} busy={busy} onConfirm={checkIn} onClose={() => setShowCheckInConfirm(false)} />
      ) : null}

      {myOpen && mySlot ? (
        <MyReservationModal
          P={P}
          night={night}
          config={config}
          slot={mySlot}
          reservedAt={data.myReservation?.reservedAt ?? null}
          checkedInAt={data.myReservation?.checkedInAt ?? null}
          eventJoinedAt={data.myReservation?.eventJoinedAt ?? null}
          reviewJoinedAt={data.myReservation?.reviewJoinedAt ?? null}
          busy={busy}
          onParticipate={participate}
          onCheckIn={() => { setMyOpen(false); setShowCheckInConfirm(true); }}
          onCancel={cancelReservation}
          onClose={() => setMyOpen(false)}
        />
      ) : null}
    </>,
  );
}

/* ---------- 조각 ---------- */

type BoxFn = (extra?: React.CSSProperties) => React.CSSProperties;

function SummaryCard({ config, P, night, info, activeDate, daySlots, box }: { config: EventPageConfig; P: Palette; night: boolean; info: EventInfo | null; activeDate: string | null; daySlots: Slot[]; box: BoxFn }) {
  const dayRemaining = daySlots.reduce((a, s) => a + s.remaining, 0);
  const evTitle = info?.title || config.fallback.title;
  const evVenue = info?.venue || config.fallback.venue;
  const evBadges = info && info.badges.length > 0 ? info.badges : config.fallback.badges;
  const openHours = info?.hours
    ? info.hours
    : config.fallback.hours
      ? config.fallback.hours
      : daySlots.length > 0
        ? `${daySlots[0].time} ~ ${daySlots[daySlots.length - 1].time} 입장`
        : '';
  return (
    <section style={box({ marginBottom: 12, ...(night ? { background: 'linear-gradient(135deg,rgba(45,212,191,.14),rgba(139,92,246,.12))' } : {}) })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {evBadges.map((b, i) => (
          <span
            key={b}
            style={{
              fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 8,
              color: i === 0 ? (night ? '#06201C' : '#fff') : night ? P.accentText : P.accent,
              background: i === 0 ? (night ? P.accent : P.red) : P.accentSoft,
            }}
          >
            {b}
          </span>
        ))}
      </div>
      <h1 style={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.5, margin: '10px 0 0', lineHeight: 1.3, color: P.ink }}>{evTitle}</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {evVenue ? <InfoLine P={P} icon="pin">{evVenue}</InfoLine> : null}
        <InfoLine P={P} icon="clock">
          {activeDate ? fmtDate(activeDate) : ''}{openHours ? ` · ${openHours}` : ''}
        </InfoLine>
      </div>
      {info?.note ? (
        <p style={{ margin: '10px 0 0', fontSize: 11.5, fontWeight: 600, color: P.sub, lineHeight: 1.6 }}>{info.note}</p>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${P.line2}` }}>
        <Stat P={P} label="전체 잔여석" value={daySlots.length > 0 ? `${dayRemaining}석` : '오픈 예정'} />
        <Stat P={P} label="예약 마감" value={activeDate ? (dDay(activeDate) ?? '종료') : '—'} color={P.red} />
        <Stat P={P} label={config.thirdStat.label} value={fillEventText(config.thirdStat.value, { capacity: slotCapacityLabel(daySlots.map((s) => s.capacity)) })} />
      </div>
    </section>
  );
}

function InfoLine({ P, icon, children }: { P: Palette; icon: 'pin' | 'clock'; children: React.ReactNode }) {
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

function Stat({ P, label, value, color }: { P: Palette; label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: P.dim, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color: color ?? P.ink, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

/** 안내 박스 — 제목 · 서문 · 불릿 · 강조 줄 · 인용. 설정(shared/eventPages.ts)에서 내용을 받는다. */
function NoticeBox({ P, night, box, n, capacity }: { P: Palette; night: boolean; box: BoxFn; n: EventNoticeBox; capacity: string | null }) {
  const t = (s: string) => fillEventText(s, { capacity });
  return (
    <section style={box({ padding: '15px 16px 14px', borderRadius: 16, marginTop: 12 })}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 900, letterSpacing: 0.3, color: P.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden style={{ width: 4, height: 14, borderRadius: 2, background: P.accent, boxShadow: night ? `0 0 8px ${P.accent}` : undefined }} />
        {t(n.title)}
      </h2>
      {n.intro ? <p style={{ margin: '10px 0 0', fontSize: 12, fontWeight: 700, color: P.ink, lineHeight: 1.65 }}>{t(n.intro)}</p> : null}
      <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {n.bullets.map((b) => (
          <li key={b} style={{ display: 'flex', gap: 7, fontSize: 11.5, lineHeight: 1.65, color: P.sub }}>
            <span aria-hidden style={{ flex: 'none', color: P.accent, fontWeight: 900 }}>·</span>
            <span>{t(b)}</span>
          </li>
        ))}
      </ul>
      {n.footnotes?.map((f) => (
        <p key={f} style={{ margin: '12px 0 0', paddingTop: 10, borderTop: `1px solid ${P.line2}`, fontSize: 11.5, fontWeight: 800, color: P.ink, lineHeight: 1.6 }}>
          ※ {t(f)}
        </p>
      ))}
      {n.quote ? (
        <p style={{ margin: '10px 0 0', padding: '9px 12px', borderLeft: `3px solid ${P.accent}`, background: P.accentSoft, borderRadius: '0 10px 10px 0', fontSize: 11.5, fontWeight: 700, color: night ? P.accentText : P.accentText, lineHeight: 1.65 }}>
          {t(n.quote)}
        </p>
      ) : null}
    </section>
  );
}

/** 예약·입장 안내 — 문구·위치(visitNoticePlacement)는 shared/eventPages.ts 의 이벤트별 설정. */
function VisitNotice({ P, box, n, capacity, marginTop }: { P: Palette; box: BoxFn; n: NonNullable<EventPageConfig['visitNotice']>; capacity: string | null; marginTop?: number }) {
  const t = (s: string) => fillEventText(s, { capacity });
  return (
    <section style={box({ padding: '15px 16px 14px', borderRadius: 16, marginTop })}>
      <h2 style={{ margin: 0, fontSize: 12.5, fontWeight: 900, letterSpacing: 0.3, color: P.ink }}>예약·입장 안내</h2>
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {n.bullets.map((b) => (
          <li key={b} style={{ display: 'flex', gap: 7, fontSize: 11.5, lineHeight: 1.65, color: P.sub }}>
            <span aria-hidden style={{ flex: 'none', color: P.accent, fontWeight: 900 }}>·</span>
            <span>{t(b)}</span>
          </li>
        ))}
      </ul>
      <p style={{ margin: '12px 0 0', paddingTop: 10, borderTop: `1px solid ${P.line2}`, fontSize: 11.5, fontWeight: 800, color: P.ink, lineHeight: 1.6 }}>
        {t(n.footer)}
      </p>
    </section>
  );
}

function ModalShell({ P, night, onClose, children }: { P: Palette; night: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,9,26,0.6)', backdropFilter: 'blur(3px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 360, borderRadius: 20, padding: '24px 20px 18px', background: night ? '#111632' : P.card, border: night ? `1px solid ${P.line}` : undefined, color: P.ink, boxShadow: '0 18px 50px rgba(0,0,0,0.35)' }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ P, label, value, strike }: { P: Palette; label: string; value: string; strike?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${P.line2}` }}>
      <span style={{ fontSize: 12.5, color: P.dim, flex: 'none', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: P.ink, textAlign: 'right', textDecoration: strike ? 'line-through' : 'none', opacity: strike ? 0.5 : 1 }}>{value}</span>
    </div>
  );
}

const btn = (P: Palette, kind: 'ghost' | 'primary' | 'danger' | 'accent' | 'green', night: boolean): React.CSSProperties => {
  const base: React.CSSProperties = { padding: '13px 0', borderRadius: 12, cursor: 'pointer', fontSize: 14.5, fontWeight: 800, border: 'none' };
  if (kind === 'ghost') return { ...base, border: `1.5px solid ${P.line}`, background: 'transparent', color: P.sub };
  if (kind === 'danger') return { ...base, background: P.red, color: '#fff', fontWeight: 900 };
  if (kind === 'green') return { ...base, background: P.green, color: '#fff', fontWeight: 900 };
  if (kind === 'accent') return { ...base, background: P.accent, color: night ? '#06201C' : '#fff', fontWeight: 900 };
  return { ...base, background: night ? P.accent : P.ink, color: night ? '#06201C' : '#fff', fontWeight: 900 };
};

function MyReservationModal({ P, night, config, slot, reservedAt, checkedInAt, eventJoinedAt, reviewJoinedAt, busy, onParticipate, onCheckIn, onCancel, onClose }: {
  P: Palette; night: boolean; config: EventPageConfig;
  slot: Pick<Slot, 'id' | 'date' | 'time' | 'capacity'>;
  reservedAt: string | null; checkedInAt: string | null; busy: boolean;
  eventJoinedAt: string | null; reviewJoinedAt: string | null;
  onParticipate: (kind: 'event' | 'review') => void;
  onCheckIn: () => void; onCancel: () => void; onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  // 참여 확인창 — 어느 버튼을 눌렀는지. 확인하면 onParticipate 호출.
  const [joinConfirm, setJoinConfirm] = useState<'event' | 'review' | null>(null);
  const done = Boolean(checkedInAt);
  const platform = typeof navigator !== 'undefined' ? storePlatformFromUa(navigator.userAgent) : null;
  const reviewUrl = platform ? STORE_REVIEW_URL[platform] : null;
  return (
    <ModalShell P={P} night={night} onClose={onClose}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 36 }}>{done ? '✅' : '🎟️'}</div>
        <h3 style={{ fontSize: 17, fontWeight: 900, margin: '10px 0 0', color: P.ink }}>내 예약</h3>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, fontWeight: 700, color: done ? P.green : P.accent }}>{done ? '입장 완료' : '입장 대기'}</p>
      </div>
      <div style={{ background: P.modalBg, borderRadius: 14, padding: '4px 14px', marginBottom: 16 }}>
        <Row P={P} label="방문 일시" value={`${fmtDate(slot.date)} ${slotDisplay(config, slot.time)}`} />
        {config.partyLine ? <Row P={P} label="입장 인원" value={config.partyLine} /> : null}
        {reservedAt ? <Row P={P} label="예약 시각" value={new Date(reservedAt).toLocaleString('ko-KR')} /> : null}
        {checkedInAt ? <Row P={P} label="입장 확인" value={new Date(checkedInAt).toLocaleString('ko-KR')} /> : null}
      </div>
      {done ? (
        joinConfirm ? (
          <>
            <p style={{ margin: '0 0 12px', textAlign: 'center', fontSize: 13.5, fontWeight: 800, color: P.ink, lineHeight: 1.6 }}>
              {joinConfirm === 'event' ? '이벤트에 참여하시겠습니까?' : '리뷰 이벤트에 참여하시겠습니까?'}<br />
              <span style={{ fontSize: 12, fontWeight: 700, color: P.sub }}>확인하면 참여완료 상태로 표시되며 되돌릴 수 없습니다.</span>
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setJoinConfirm(null)} disabled={busy} style={{ flex: 1, ...btn(P, 'ghost', night) }}>돌아가기</button>
              <button onClick={() => { const k = joinConfirm; setJoinConfirm(null); onParticipate(k); }} disabled={busy} style={{ flex: 1.4, ...btn(P, 'green', night), opacity: busy ? 0.6 : 1 }}>{busy ? '처리 중…' : '확인'}</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* 리뷰 쓰러가기 — 참여 버튼 위 오른쪽 정렬 텍스트 링크(OS 별 스토어). 앱 WebView 는 스토어 주소를 가로채 스토어 앱으로 연다. */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingRight: 2 }}>
              {reviewUrl ? (
                <a href={reviewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 800, color: P.accentText, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  ⭐ 리뷰 쓰러가기 ({platform === 'ios' ? 'App Store' : 'Google Play'})
                </a>
              ) : (
                <>
                  <a href={STORE_REVIEW_URL.android} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 800, color: P.accentText, textDecoration: 'underline', textUnderlineOffset: 3 }}>⭐ Google Play 리뷰</a>
                  <a href={STORE_REVIEW_URL.ios} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 800, color: P.accentText, textDecoration: 'underline', textUnderlineOffset: 3 }}>⭐ App Store 리뷰</a>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <JoinButton P={P} night={night} label="이벤트 참여" doneLabel="이벤트 참여완료" doneAt={eventJoinedAt} busy={busy} onPress={() => setJoinConfirm('event')} />
              <JoinButton P={P} night={night} label="리뷰 이벤트 참여" doneLabel="리뷰 이벤트 참여완료" doneAt={reviewJoinedAt} busy={busy} onPress={() => setJoinConfirm('review')} />
            </div>
            <button onClick={onClose} style={{ width: '100%', ...btn(P, 'ghost', night), fontSize: 13.5, padding: '12px 0' }}>닫기</button>
          </div>
        )
      ) : confirming ? (
        <>
          <p style={{ margin: '0 0 12px', textAlign: 'center', fontSize: 13.5, fontWeight: 800, color: P.ink }}>예약을 취소하시겠습니까?</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setConfirming(false)} disabled={busy} style={{ flex: 1, ...btn(P, 'ghost', night) }}>돌아가기</button>
            <button onClick={onCancel} disabled={busy} style={{ flex: 1.4, ...btn(P, 'danger', night), opacity: busy ? 0.6 : 1 }}>{busy ? '처리 중…' : '예약 취소'}</button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onCheckIn} disabled={busy} style={{ width: '100%', ...btn(P, 'accent', night) }}>담당자 확인</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={busy} style={{ flex: 1, ...btn(P, 'ghost', night), fontSize: 13.5, padding: '12px 0' }}>닫기</button>
            <button onClick={() => setConfirming(true)} disabled={busy} style={{ flex: 1, ...btn(P, 'ghost', night), fontSize: 13.5, padding: '12px 0', border: `1.5px solid ${P.red}`, color: P.red }}>예약 취소</button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/** 입장 완료자용 참여 버튼 — 미참여면 누를 수 있는 버튼, 완료면 초록 상태 칩(비활성). */
function JoinButton({ P, night, label, doneLabel, doneAt, busy, onPress }: { P: Palette; night: boolean; label: string; doneLabel: string; doneAt: string | null; busy: boolean; onPress: () => void }) {
  if (doneAt) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 6px', borderRadius: 12, background: 'rgba(43,182,115,0.12)', border: `1.5px solid ${P.green}`, color: P.green, fontSize: 12.5, fontWeight: 900 }}>
        <span>✓ {doneLabel}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: P.sub }}>{new Date(doneAt).toLocaleDateString('ko-KR')}</span>
      </div>
    );
  }
  return (
    <button onClick={onPress} disabled={busy} style={{ flex: 1, ...btn(P, 'accent', night), fontSize: 13, padding: '12px 0' }}>{label}</button>
  );
}

function CheckInConfirmModal({ P, night, busy, onConfirm, onClose }: { P: Palette; night: boolean; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <ModalShell P={P} night={night} onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🧑‍💼</div>
        <h3 style={{ margin: '10px 0 8px', fontSize: 18, fontWeight: 900, color: P.ink }}>현장 담당자 확인</h3>
        <p style={{ margin: '0 0 20px', color: P.sub, fontSize: 13, lineHeight: 1.65 }}>
          예약자와 방문 시간을 확인하셨나요?<br />확인하면 입장 완료 처리되며 예약을 변경하거나 취소할 수 없습니다.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} disabled={busy} style={{ flex: 1, ...btn(P, 'ghost', night) }}>돌아가기</button>
        <button onClick={onConfirm} disabled={busy} style={{ flex: 1.4, ...btn(P, 'green', night), opacity: busy ? 0.6 : 1 }}>{busy ? '처리 중…' : '입장 완료 확인'}</button>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({ P, night, config, slot, mySlot, busy, onConfirm, onClose }: { P: Palette; night: boolean; config: EventPageConfig; slot: Slot; mySlot: Slot | null; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  const isMove = mySlot != null && mySlot.id !== slot.id;
  const fmt = (s: Pick<Slot, 'date' | 'time'>) => `${fmtDate(s.date)} ${slotDisplay(config, s.time)}`;
  return (
    <ModalShell P={P} night={night} onClose={onClose}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 36 }}>🎟️</div>
        <h3 style={{ fontSize: 17, fontWeight: 900, margin: '10px 0 0', color: P.ink }}>{isMove ? '예약을 이 시간으로 옮기시겠습니까?' : '예약하시겠습니까?'}</h3>
      </div>
      <div style={{ background: P.modalBg, borderRadius: 14, padding: '4px 14px', marginBottom: 16 }}>
        {isMove && mySlot ? <Row P={P} label="기존 예약" value={fmt(mySlot)} strike /> : null}
        <Row P={P} label="방문 일시" value={fmt(slot)} />
        <Row P={P} label="잔여석" value={`${slot.remaining}석 (${slot.reserved}/${slot.capacity} 예약됨)`} />
        {config.partyLine ? <Row P={P} label="입장 인원" value={config.partyLine} /> : null}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} disabled={busy} style={{ flex: 1, ...btn(P, 'ghost', night) }}>취소</button>
        <button onClick={onConfirm} disabled={busy} style={{ flex: 1.4, ...btn(P, 'primary', night), opacity: busy ? 0.6 : 1 }}>{busy ? '처리 중…' : '확인'}</button>
      </div>
    </ModalShell>
  );
}
