'use client';

/**
 * 카드쇼 관리자 — 날짜별로 (1) 행사 정보(행사명·장소·시간·배지·안내) 편집과
 * (2) 시간대 슬롯(정원 인라인 수정·노출 토글·삭제·예약자 명단)을 함께 다룬다.
 * 신규 슬롯은 상단 폼(시간 쉼표 구분 일괄 등록).
 *
 * 행사 정보는 CardShowEvent(날짜 유일)에 저장되고, 비워 두면 웹이 기본 문구/슬롯
 * 시간대에서 자동으로 채운다 — 즉 입력은 전부 선택 사항이다.
 */
import { useMemo, useState, type FormEvent } from 'react';

interface ReservationUser {
  avatarId: string;
  points: number;
  signupPlatform: string | null;
  isAdmin: boolean;
  joinedAt: string;
  cards: number;
  trades: number;
  feeds: number;
}

interface Reservation {
  id: number;
  userId: string;
  name: string;
  email: string | null;
  createdAt: string;
  /// 현장 입장 확정 시각. null = 미입장.
  checkedInAt: string | null;
  /// 회원정보 모달용 요약. 탈퇴 회원이면 null.
  user: ReservationUser | null;
}

export interface CardShowEventInfo {
  date: string;
  title: string;
  venue: string;
  hours: string;
  badges: string;
  note: string;
}

interface Slot {
  id: number;
  date: string;
  time: string;
  capacity: number;
  active: boolean;
  reservations: Reservation[];
}

function fmtTime(d: string): string {
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

export function CardShowManager({
  initialSlots,
  initialEvents,
}: {
  initialSlots: Slot[];
  initialEvents: CardShowEventInfo[];
}) {
  const [slots, setSlots] = useState(initialSlots);
  const eventByDate = useMemo(() => {
    const m = new Map<string, CardShowEventInfo>();
    for (const e of initialEvents) m.set(e.date, e);
    return m;
  }, [initialEvents]);
  const [openId, setOpenId] = useState<number | null>(null);
  /// 회원정보 모달에 띄울 예약(= 클릭한 예약자). null 이면 닫힘.
  const [detail, setDetail] = useState<(Reservation & { slotLabel: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = () => window.location.reload();

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/cardshow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: String(fd.get('date') ?? ''),
          times: String(fd.get('times') ?? '').split(','),
          capacity: Number(fd.get('capacity')),
        }),
      });
      const j = (await r.json().catch(() => null)) as { error?: string; count?: number } | null;
      if (!r.ok) setMsg(j?.error ?? `생성 실패 (HTTP ${r.status})`);
      else reload();
    } catch {
      setMsg('서버 연결 실패');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: number, data: { capacity?: number; active?: boolean }) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/cardshow/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
      } else {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setMsg(j?.error ?? '수정 실패');
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: Slot) => {
    if (busy) return;
    if (!window.confirm(`${s.date} ${s.time} 슬롯을 삭제할까요?\n예약 ${s.reservations.length}건도 함께 삭제됩니다.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/cardshow/${s.id}`, { method: 'DELETE' });
      if (r.ok) setSlots((prev) => prev.filter((x) => x.id !== s.id));
      else setMsg('삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  /** 관리자 예약 취소 — 확정·입장 완료된 예약도 지울 수 있다(노쇼·중복 정리). */
  const cancelReservation = async (slotId: number, r: Reservation) => {
    if (busy) return;
    if (!window.confirm(`${r.name} 님의 예약을 취소할까요?\n취소하면 그 자리는 다시 예약 가능해집니다.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cardshow/reservation/${r.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSlots((prev) =>
          prev.map((s) =>
            s.id === slotId ? { ...s, reservations: s.reservations.filter((x) => x.id !== r.id) } : s,
          ),
        );
        setDetail(null);
      } else {
        setMsg('예약 취소 실패');
      }
    } finally {
      setBusy(false);
    }
  };

  /** 입장 확정 토글 — 현장에서 앱 확인이 안 될 때 관리자가 직접 처리. */
  const toggleCheckIn = async (slotId: number, r: Reservation) => {
    if (busy) return;
    const next = !r.checkedInAt;
    setBusy(true);
    try {
      const res = await fetch(`/api/cardshow/reservation/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedIn: next }),
      });
      const j = (await res.json().catch(() => null)) as { checkedInAt?: string | null } | null;
      if (res.ok) {
        const checkedInAt = j?.checkedInAt ?? null;
        setSlots((prev) =>
          prev.map((s) =>
            s.id === slotId
              ? { ...s, reservations: s.reservations.map((x) => (x.id === r.id ? { ...x, checkedInAt } : x)) }
              : s,
          ),
        );
        setDetail((d) => (d && d.id === r.id ? { ...d, checkedInAt } : d));
      } else {
        setMsg('입장 처리 실패');
      }
    } finally {
      setBusy(false);
    }
  };

  const byDate = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    }
    return Array.from(m.entries());
  }, [slots]);

  return (
    <>
      {/* 슬롯 일괄 생성 */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2>➕ 슬롯 추가 (같은 날짜에 시간 여러 개 — 쉼표 구분)</h2>
        <form onSubmit={create} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
            날짜
            <input className="login-input" style={{ height: 36, width: 150 }} type="date" name="date" required />
          </label>
          <label style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
            시간들 (HH:mm, 쉼표 구분)
            <input className="login-input" style={{ height: 36 }} name="times" placeholder="10:00, 11:00, 13:00, 14:00" required />
          </label>
          <label style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
            시간당 정원
            <input className="login-input" style={{ height: 36, width: 90 }} type="number" name="capacity" defaultValue={10} min={1} max={999} required />
          </label>
          <button className="btn" type="submit" disabled={busy} style={{ height: 36, background: '#129782', color: '#fff', borderColor: '#129782' }}>
            {busy ? '처리 중…' : '슬롯 생성'}
          </button>
        </form>
        {msg ? <div style={{ marginTop: 10, fontSize: 12, color: '#B91C1C' }}>{msg}</div> : null}
        <div className="muted" style={{ marginTop: 8 }}>같은 날짜·시간이 이미 있으면 정원만 갱신됩니다.</div>
      </section>

      {byDate.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 30 }}>아직 슬롯이 없어요 — 위에서 생성하세요.</div>
      ) : (
        byDate.map(([date, daySlots]) => (
          <section className="card" key={date} style={{ marginBottom: 16 }}>
            <h2>📅 {date} <span className="muted">({daySlots.length}개 시간대 · 예약 {daySlots.reduce((a, s) => a + s.reservations.length, 0)}명)</span></h2>

            <EventInfoForm date={date} initial={eventByDate.get(date) ?? null} />

            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>시간</th>
                  <th style={{ width: 120 }}>예약/정원</th>
                  <th style={{ width: 110 }}>정원 수정</th>
                  <th style={{ width: 70 }}>노출</th>
                  <th>예약자</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {daySlots.map((s) => {
                  const full = s.reservations.length >= s.capacity;
                  const open = openId === s.id;
                  return (
                    <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                      <td className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{s.time}</td>
                      <td>
                        <span className="tag" style={full ? { background: '#FEE2E2', color: '#B91C1C' } : { background: '#F0FDF4', color: '#166534' }}>
                          {s.reservations.length} / {s.capacity} {full ? '마감' : ''}
                        </span>
                      </td>
                      <td>
                        <input
                          className="login-input"
                          style={{ height: 30, width: 70, fontSize: 13 }}
                          type="number"
                          min={1}
                          max={999}
                          defaultValue={s.capacity}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isInteger(v) && v !== s.capacity) patch(s.id, { capacity: v });
                          }}
                        />
                      </td>
                      <td>
                        <button className="btn" style={{ fontSize: 11 }} onClick={() => patch(s.id, { active: !s.active })}>
                          {s.active ? '숨김' : '노출'}
                        </button>
                      </td>
                      <td>
                        {s.reservations.length === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <>
                            <button className="btn" style={{ fontSize: 11, marginBottom: open ? 8 : 0 }} onClick={() => setOpenId(open ? null : s.id)}>
                              {open
                                ? '접기 ▲'
                                : `명단 보기 (${s.reservations.length}명 · 입장 ${s.reservations.filter((r) => r.checkedInAt).length}) ▼`}
                            </button>
                            {open ? (
                              <table className="tbl" style={{ marginTop: 6 }}>
                                <tbody>
                                  {s.reservations.map((r, i) => (
                                    <tr key={r.id}>
                                      <td className="mono muted" style={{ width: 30 }}>{i + 1}</td>
                                      <td>
                                        {/* 예약자 클릭 → 회원정보 모달 */}
                                        <button
                                          className="btn"
                                          style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px' }}
                                          onClick={() => setDetail({ ...r, slotLabel: `${s.date} ${s.time}` })}
                                        >
                                          {r.name}
                                        </button>
                                      </td>
                                      <td className="mono" style={{ fontSize: 11 }}>{r.email ?? '-'}</td>
                                      <td style={{ width: 92 }}>
                                        {r.checkedInAt ? (
                                          <span style={{ fontSize: 11, fontWeight: 700, color: '#0F766E' }}>✅ 입장완료</span>
                                        ) : (
                                          <span className="muted" style={{ fontSize: 11 }}>대기</span>
                                        )}
                                      </td>
                                      <td className="mono muted" style={{ width: 100 }}>{fmtTime(r.createdAt)} 예약</td>
                                      <td style={{ width: 150, textAlign: 'right' }}>
                                        <button
                                          className="btn"
                                          style={{ fontSize: 11, marginRight: 6 }}
                                          disabled={busy}
                                          onClick={() => toggleCheckIn(s.id, r)}
                                        >
                                          {r.checkedInAt ? '입장 취소' : '입장 확정'}
                                        </button>
                                        <button
                                          className="btn"
                                          style={{ fontSize: 11, color: '#B91C1C' }}
                                          disabled={busy}
                                          onClick={() => cancelReservation(s.id, r)}
                                        >
                                          예약 취소
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td>
                        <button className="btn" style={{ fontSize: 11, color: '#B91C1C' }} onClick={() => remove(s)}>삭제</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))
      )}

      {/* 회원정보 모달 — 예약자 이름을 누르면 뜬다. 여기서도 입장/취소 처리 가능. */}
      {detail ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDetail(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,.5)',
            display: 'grid', placeItems: 'center', padding: 16,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(460px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h2 style={{ margin: 0 }}>👤 {detail.name}</h2>
              <button className="btn" style={{ fontSize: 12 }} onClick={() => setDetail(null)}>닫기</button>
            </div>
            <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
              {detail.slotLabel} 예약 · {fmtTime(detail.createdAt)} 신청
            </div>

            <table className="tbl" style={{ marginTop: 12 }}>
              <tbody>
                <DetailRow label="회원 ID" value={<span className="mono" style={{ fontSize: 11 }}>{detail.userId}</span>} />
                <DetailRow label="이메일" value={<span className="mono" style={{ fontSize: 11 }}>{detail.email ?? '-'}</span>} />
                <DetailRow
                  label="입장 상태"
                  value={
                    detail.checkedInAt ? (
                      <span style={{ color: '#0F766E', fontWeight: 700 }}>✅ 입장 완료 ({fmtTime(detail.checkedInAt)})</span>
                    ) : (
                      <span className="muted">대기</span>
                    )
                  }
                />
                {detail.user ? (
                  <>
                    <DetailRow label="가입일" value={fmtTime(detail.user.joinedAt)} />
                    <DetailRow label="가입 경로" value={detail.user.signupPlatform ?? '-'} />
                    <DetailRow label="포인트" value={`${detail.user.points.toLocaleString()}P`} />
                    <DetailRow
                      label="활동"
                      value={`보유카드 ${detail.user.cards} · 거래 ${detail.user.trades} · 글 ${detail.user.feeds}`}
                    />
                    {detail.user.isAdmin ? <DetailRow label="권한" value={<b>관리자</b>} /> : null}
                  </>
                ) : (
                  <tr><td className="muted" colSpan={2}>탈퇴한 회원입니다.</td></tr>
                )}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  const slot = slots.find((x) => x.reservations.some((r) => r.id === detail.id));
                  if (slot) toggleCheckIn(slot.id, detail);
                }}
              >
                {detail.checkedInAt ? '입장 취소' : '입장 확정'}
              </button>
              <button
                className="btn"
                style={{ color: '#B91C1C' }}
                disabled={busy}
                onClick={() => {
                  const slot = slots.find((x) => x.reservations.some((r) => r.id === detail.id));
                  if (slot) cancelReservation(slot.id, detail);
                }}
              >
                예약 취소
              </button>
              <a className="btn" href={`/users?q=${encodeURIComponent(detail.userId)}`} target="_blank" rel="noreferrer">
                회원 관리에서 열기 ↗
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="muted" style={{ width: 90, fontSize: 12 }}>{label}</td>
      <td style={{ fontSize: 13 }}>{value}</td>
    </tr>
  );
}

/**
 * 날짜별 행사 정보 편집 — 비워 두면 웹이 기본 문구/슬롯 시간대로 채운다.
 * 저장은 PUT /api/cardshow/event (date 기준 upsert).
 */
function EventInfoForm({ date, initial }: { date: string; initial: CardShowEventInfo | null }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Omit<CardShowEventInfo, 'date'>>({
    title: initial?.title ?? '',
    venue: initial?.venue ?? '',
    hours: initial?.hours ?? '',
    badges: initial?.badges ?? '',
    note: initial?.note ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const filled = [v.title, v.venue, v.hours].filter(Boolean).length > 0;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/cardshow/event', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...v }),
      });
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setMsg({ ok: true, text: '저장됨 — 웹/앱 예약 페이지에 바로 반영됩니다' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '저장 실패' });
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.confirm(`${date} 행사 정보를 지울까요? (웹은 기본 문구로 돌아갑니다)`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/cardshow/event?date=${encodeURIComponent(date)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setV({ title: '', venue: '', hours: '', badges: '', note: '' });
      setMsg({ ok: true, text: '행사 정보를 지웠습니다' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '삭제 실패' });
    } finally {
      setBusy(false);
    }
  };

  const field = (
    key: keyof Omit<CardShowEventInfo, 'date'>,
    label: string,
    placeholder: string,
    width?: number,
  ) => (
    <label style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4, flex: width ? undefined : 1, minWidth: width ?? 180 }}>
      {label}
      <input
        className="login-input"
        style={{ height: 34, width: width ?? undefined }}
        value={v[key]}
        placeholder={placeholder}
        onChange={(e) => setV((prev) => ({ ...prev, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>🎪 행사 정보</strong>
        <span className="muted" style={{ fontSize: 12 }}>
          {filled ? `${v.title || '(행사명 없음)'}${v.venue ? ` · ${v.venue}` : ''}` : '미입력 — 웹은 기본 문구로 표시됩니다'}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn" style={{ fontSize: 11 }} onClick={() => setOpen((o) => !o)}>
          {open ? '접기 ▲' : '편집 ▼'}
        </button>
      </div>

      {open ? (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            {field('title', '행사명', 'ARVO 카드쇼 2026 서울')}
            {field('venue', '장소', '서울 성수 S팩토리 A동')}
            {field('hours', '운영 시간 (비우면 슬롯에서 자동)', '10:00 ~ 19:00', 200)}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            {field('badges', '배지 (쉼표 구분, 비우면 기본)', '사전예약, 무료 입장', 240)}
            {field('note', '추가 안내 한 줄 (선택)', '주차 공간이 협소하니 대중교통을 이용해 주세요')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <button className="btn" disabled={busy} onClick={save} style={{ height: 32, background: '#129782', color: '#fff', borderColor: '#129782' }}>
              {busy ? '저장 중…' : '행사 정보 저장'}
            </button>
            <button className="btn" disabled={busy} onClick={clear} style={{ height: 32, fontSize: 12, color: '#B91C1C' }}>
              지우기
            </button>
            {msg ? (
              <span style={{ fontSize: 12, color: msg.ok ? '#047857' : '#B91C1C' }}>
                {msg.ok ? '✓ ' : '⚠ '}{msg.text}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
