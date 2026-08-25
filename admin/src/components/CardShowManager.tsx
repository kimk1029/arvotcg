'use client';

/**
 * 카드쇼 슬롯 관리자 — 날짜별 그룹으로 슬롯 나열, 정원 인라인 수정·활성 토글·삭제,
 * 슬롯 클릭 시 예약자 목록 펼침. 신규 생성은 상단 폼(시간 쉼표 구분 일괄 등록).
 */
import { useMemo, useState, type FormEvent } from 'react';

interface Reservation {
  id: number;
  userId: string;
  name: string;
  email: string | null;
  createdAt: string;
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

export function CardShowManager({ initialSlots }: { initialSlots: Slot[] }) {
  const [slots, setSlots] = useState(initialSlots);
  const [openId, setOpenId] = useState<number | null>(null);
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
                              {open ? '접기 ▲' : `명단 보기 (${s.reservations.length}) ▼`}
                            </button>
                            {open ? (
                              <table className="tbl" style={{ marginTop: 6 }}>
                                <tbody>
                                  {s.reservations.map((r, i) => (
                                    <tr key={r.id}>
                                      <td className="mono muted" style={{ width: 30 }}>{i + 1}</td>
                                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                                      <td className="mono" style={{ fontSize: 11 }}>{r.email ?? '-'}</td>
                                      <td className="mono muted" style={{ width: 100 }}>{fmtTime(r.createdAt)} 예약</td>
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
    </>
  );
}
