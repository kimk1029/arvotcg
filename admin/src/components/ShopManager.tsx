'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { COLOR_PRESETS, PRICE_LEVELS } from '@/lib/shops';

export interface ShopData {
  id: number;
  name: string;
  official: boolean;
  addr: string;
  lat: number | null;
  lng: number | null;
  emoji: string;
  gradFrom: string;
  gradTo: string;
  tileColor: string;
  oripaPct: number;
  singleText: string;
  priceLevel: string;
  rating: number;
  reviewCount: number;
  dist: string;
  sortOrder: number;
  active: boolean;
}

type Draft = Omit<ShopData, 'id'> & { id: number | null };

const EMPTY_DRAFT: Draft = {
  id: null,
  name: '',
  official: false,
  addr: '',
  lat: null,
  lng: null,
  emoji: '🏪',
  gradFrom: COLOR_PRESETS[0].gradFrom,
  gradTo: COLOR_PRESETS[0].gradTo,
  tileColor: COLOR_PRESETS[0].tileColor,
  oripaPct: 0,
  singleText: '',
  priceLevel: '보통',
  rating: 0,
  reviewCount: 0,
  dist: '',
  sortOrder: 50,
  active: true,
};

/* ------------------------------------------------------------------ */
/* Daum(카카오) 우편번호 — 키 불필요 팝업 위젯. 도로명 주소를 draft.addr 로. */
/* ------------------------------------------------------------------ */

interface DaumPostcodeData {
  roadAddress?: string;
  jibunAddress?: string;
  address?: string;
}
declare global {
  interface Window {
    daum?: { Postcode: new (opts: { oncomplete: (data: DaumPostcodeData) => void }) => { open: () => void } };
  }
}

const POSTCODE_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

function loadPostcode(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${POSTCODE_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('postcode script load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = POSTCODE_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('postcode script load failed'));
    document.head.appendChild(s);
  });
}

export function ShopManager({ initialShops }: { initialShops: ShopData[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const startEdit = (s: ShopData) => { setEditingId(s.id); setDraft({ ...s }); setMsg(null); };
  const startNew = () => { setEditingId('new'); setDraft({ ...EMPTY_DRAFT }); setMsg(null); };
  const cancel = () => { setEditingId(null); setDraft(EMPTY_DRAFT); };

  const save = async () => {
    setBusy(true); setMsg(null);
    const isNew = editingId === 'new';
    const url = isNew ? '/api/shops' : `/api/shops/${draft.id}`;
    const payload = {
      name: draft.name,
      official: draft.official,
      addr: draft.addr,
      lat: draft.lat,
      lng: draft.lng,
      emoji: draft.emoji,
      gradFrom: draft.gradFrom,
      gradTo: draft.gradTo,
      tileColor: draft.tileColor,
      oripaPct: draft.oripaPct,
      singleText: draft.singleText,
      priceLevel: draft.priceLevel,
      rating: draft.rating,
      reviewCount: draft.reviewCount,
      dist: draft.dist,
      sortOrder: draft.sortOrder,
      active: draft.active,
    };
    try {
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: isNew ? '추가됨 — 웹/앱 카드샵 지도에 바로 반영됩니다' : '저장됨' });
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '저장 실패' });
    } finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!confirm('이 카드샵을 삭제할까요? 되돌릴 수 없습니다.')) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/shops/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: '삭제됨' });
      if (editingId === id) cancel();
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '삭제 실패' });
    } finally { setBusy(false); }
  };

  const toggleActive = async (s: ShopData) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/shops/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !s.active }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '상태 변경 실패' });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msg && (
        <div style={{
          padding: '9px 12px', borderRadius: 6, fontSize: 12,
          background: msg.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
          color: msg.type === 'ok' ? '#047857' : '#B91C1C',
        }}>
          {msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#64748B' }}>총 {initialShops.length}개 · 활성 {initialShops.filter((s) => s.active).length}개</span>
        <button type="button" onClick={startNew} disabled={busy || editingId !== null} style={primaryBtn}>
          + 카드샵 추가
        </button>
      </div>

      {editingId === 'new' && (
        <section className="card">
          <h2>새 카드샵</h2>
          <ShopForm draft={draft} setDraft={setDraft} />
          <FormActions onSave={save} onCancel={cancel} busy={busy} />
        </section>
      )}

      {initialShops.map((s) => {
        const isEditing = editingId === s.id;
        return (
          <section key={s.id} className="card" style={{ opacity: s.active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={chip}>#{s.sortOrder}</span>
                <span style={{ ...chip, background: s.active ? '#10B981' : '#94A3B8', color: '#fff' }}>
                  {s.active ? 'ON' : 'OFF'}
                </span>
                {s.official && <span style={{ ...chip, background: '#2C8FFF', color: '#fff' }}>공식</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => toggleActive(s)} disabled={busy} style={smBtn('#64748B')}>
                  {s.active ? '숨김' : '노출'}
                </button>
                <button type="button" onClick={() => (isEditing ? cancel() : startEdit(s))} disabled={busy || (editingId !== null && !isEditing)} style={smBtn('#3B82F6')}>
                  {isEditing ? '닫기' : '수정'}
                </button>
                <button type="button" onClick={() => remove(s.id)} disabled={busy} style={smBtn('#EF4444')}>
                  삭제
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 52, height: 52, flexShrink: 0, borderRadius: 12,
                background: `linear-gradient(150deg,${s.gradFrom},${s.gradTo})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>
                {s.emoji}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</div>
                <div style={{ color: '#475569' }}>
                  📍 {s.addr}
                  {s.lat != null && s.lng != null
                    ? ` (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})`
                    : ' (좌표 없음 — 지도에서 주소로 자동 표시)'}
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: '#94A3B8' }}>
                  오리파 {s.oripaPct}% · 싱글 {s.singleText || '-'} · 시세 {s.priceLevel} · ★ {s.rating.toFixed(1)} · 후기 {s.reviewCount}
                  {s.dist && <> · 거리 {s.dist}</>}
                </div>
              </div>
            </div>

            {isEditing && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #E2E8F0' }}>
                <ShopForm draft={draft} setDraft={setDraft} />
                <FormActions onSave={save} onCancel={cancel} busy={busy} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FormActions({ onSave, onCancel, busy }: { onSave: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
      <button type="button" onClick={onSave} disabled={busy} style={primaryBtn}>
        {busy ? '저장 중…' : '저장'}
      </button>
      <button type="button" onClick={onCancel} disabled={busy} style={smBtn('#64748B')}>
        취소
      </button>
    </div>
  );
}

function ShopForm({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [addrErr, setAddrErr] = useState<string | null>(null);

  const openPostcode = async () => {
    setAddrErr(null);
    try {
      await loadPostcode();
      new window.daum!.Postcode({
        oncomplete: (data) => {
          const road = data.roadAddress || data.address || data.jibunAddress || '';
          // 주소가 바뀌면 이전 좌표는 무효 — 비워서 지도 지오코더가 새 주소로 찍게 한다.
          setDraft({ ...draft, addr: road, lat: null, lng: null });
        },
      }).open();
    } catch {
      setAddrErr('주소찾기 위젯 로드 실패 — 주소를 직접 입력해주세요');
    }
  };

  const presetKey = COLOR_PRESETS.find(
    (p) => p.gradFrom === draft.gradFrom && p.gradTo === draft.gradTo && p.tileColor === draft.tileColor,
  )?.key ?? 'custom';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 12 }}>
        <Field label="샵 이름">
          <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="포켓랩 성수점" style={inp} />
        </Field>
        <Field label="이모지">
          <input type="text" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} style={inp} />
        </Field>
        <Field label="정렬 (작을수록 먼저)">
          <input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })} style={inp} />
        </Field>
      </div>

      <Field label="주소 (도로명) — 지도 핀은 이 주소를 지오코딩해 표시됩니다">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={draft.addr}
            onChange={(e) => setDraft({ ...draft, addr: e.target.value })}
            placeholder="🔍 주소찾기를 눌러 검색하세요"
            style={{ ...inp, flex: 1 }}
          />
          <button type="button" onClick={openPostcode} style={{ ...primaryBtn, whiteSpace: 'nowrap', flexShrink: 0 }}>
            🔍 주소찾기
          </button>
        </div>
        {addrErr && <div style={{ marginTop: 4, fontSize: 11, color: '#B91C1C' }}>⚠ {addrErr}</div>}
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="위도 lat (선택 — 비우면 주소로 자동)">
          <input
            type="text"
            value={draft.lat ?? ''}
            onChange={(e) => setDraft({ ...draft, lat: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder="37.5433"
            style={inp}
          />
        </Field>
        <Field label="경도 lng (선택)">
          <input
            type="text"
            value={draft.lng ?? ''}
            onChange={(e) => setDraft({ ...draft, lng: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder="127.0512"
            style={inp}
          />
        </Field>
      </div>

      <Field label="타일 색상">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.label}
              onClick={() => setDraft({ ...draft, gradFrom: p.gradFrom, gradTo: p.gradTo, tileColor: p.tileColor })}
              style={{
                width: 34, height: 34, borderRadius: 9, cursor: 'pointer',
                background: `linear-gradient(150deg,${p.gradFrom},${p.gradTo})`,
                border: presetKey === p.key ? '3px solid #1E293B' : '3px solid transparent',
              }}
            />
          ))}
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{presetKey === 'custom' ? '(커스텀)' : ''}</span>
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="오리파 비중 (0~100%)">
          <input type="number" min={0} max={100} value={draft.oripaPct} onChange={(e) => setDraft({ ...draft, oripaPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} style={inp} />
        </Field>
        <Field label="싱글 종수 표시 (예: 1,240종)">
          <input type="text" value={draft.singleText} onChange={(e) => setDraft({ ...draft, singleText: e.target.value })} style={inp} />
        </Field>
        <Field label="가격대">
          <select value={draft.priceLevel} onChange={(e) => setDraft({ ...draft, priceLevel: e.target.value })} style={inp}>
            {PRICE_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="평점 (0~5)">
          <input type="number" min={0} max={5} step={0.1} value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })} style={inp} />
        </Field>
        <Field label="후기 수">
          <input type="number" min={0} value={draft.reviewCount} onChange={(e) => setDraft({ ...draft, reviewCount: Math.max(0, Number(e.target.value) || 0) })} style={inp} />
        </Field>
        <Field label="거리 표시 (예: 320m, 비우면 숨김)">
          <input type="text" value={draft.dist} onChange={(e) => setDraft({ ...draft, dist: e.target.value })} style={inp} />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 18 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={draft.official} onChange={(e) => setDraft({ ...draft, official: e.target.checked })} />
          공식 인증 뱃지
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
          활성 (웹/앱 노출)
        </label>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 9px', fontSize: 13, color: '#1A1A1A',
  background: '#fff', border: '1px solid #CBD5E1', borderRadius: 6, outline: 'none', boxSizing: 'border-box',
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#fff',
  background: '#3B82F6', border: 'none', borderRadius: 6, cursor: 'pointer',
};
function smBtn(bg: string): React.CSSProperties {
  return { padding: '5px 10px', fontSize: 12, color: '#fff', background: bg, border: 'none', borderRadius: 6, cursor: 'pointer' };
}
const chip: React.CSSProperties = {
  fontSize: 11, padding: '3px 7px', borderRadius: 4, background: '#1E293B', color: '#fff', lineHeight: 1,
};
