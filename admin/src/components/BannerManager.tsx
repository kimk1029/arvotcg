'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface BannerData {
  id: number;
  sortOrder: number;
  slideClass: string;
  badge: string;
  title: string;
  sub: string;
  ctaHint: string | null;
  visualType: string;
  visualValue: string;
  onClick: string | null;
  linkUrl: string | null;
  active: boolean;
}

type Draft = Omit<BannerData, 'id'> & { id: number | null };

const SLIDE_CLASSES = ['slide-a', 'slide-b', 'slide-c', 'slide-d'] as const;
const VISUAL_TYPES = [
  { v: 'emoji', l: '이모지' },
  { v: 'image', l: '이미지' },
] as const;
const ON_CLICKS = [
  { v: '', l: '없음' },
  { v: 'stamp-rally', l: '스탬프 랠리 모달' },
  { v: 'oripa', l: '오리파 페이지' },
] as const;

const EMPTY_DRAFT: Draft = {
  id: null,
  sortOrder: 50,
  slideClass: 'slide-a',
  badge: '',
  title: '',
  sub: '',
  ctaHint: null,
  visualType: 'emoji',
  visualValue: '✨',
  onClick: null,
  linkUrl: null,
  active: true,
};

export function BannerManager({ initialBanners }: { initialBanners: BannerData[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const startEdit = (b: BannerData) => { setEditingId(b.id); setDraft({ ...b }); setMsg(null); };
  const startNew = () => { setEditingId('new'); setDraft({ ...EMPTY_DRAFT }); setMsg(null); };
  const cancel = () => { setEditingId(null); setDraft(EMPTY_DRAFT); };

  const save = async () => {
    setBusy(true); setMsg(null);
    const isNew = editingId === 'new';
    const url = isNew ? '/api/banners' : `/api/banners/${draft.id}`;
    const payload = {
      sortOrder: draft.sortOrder,
      slideClass: draft.slideClass,
      badge: draft.badge,
      title: draft.title,
      sub: draft.sub,
      ctaHint: draft.ctaHint || null,
      visualType: draft.visualType,
      visualValue: draft.visualValue,
      onClick: draft.onClick || null,
      linkUrl: draft.linkUrl || null,
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
      setMsg({ type: 'ok', text: isNew ? '추가됨' : '저장됨' });
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '저장 실패' });
    } finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!confirm('이 배너를 삭제할까요? 되돌릴 수 없습니다.')) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/banners/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: '삭제됨' });
      if (editingId === id) cancel();
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '삭제 실패' });
    } finally { setBusy(false); }
  };

  const seedDefaults = async () => {
    if (!confirm('기본 배너 4개를 채울까요? (이미 배너가 있으면 추가되지 않습니다)')) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/banners/seed', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      if (body.created > 0) setMsg({ type: 'ok', text: `기본 배너 ${body.created}개 추가됨` });
      else setMsg({ type: 'ok', text: `이미 배너가 ${body.existing}개 있어 추가하지 않았습니다` });
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '시드 실패' });
    } finally { setBusy(false); }
  };

  const toggleActive = async (b: BannerData) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/banners/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !b.active }),
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
        <span style={{ fontSize: 12, color: '#64748B' }}>총 {initialBanners.length}개</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={seedDefaults} disabled={busy} style={smBtn('#64748B')}>
            기본 배너 채우기
          </button>
          <button type="button" onClick={startNew} disabled={busy || editingId !== null} style={primaryBtn}>
            + 배너 추가
          </button>
        </div>
      </div>

      {editingId === 'new' && (
        <section className="card">
          <h2>새 배너</h2>
          <BannerForm draft={draft} setDraft={setDraft} />
          <FormActions onSave={save} onCancel={cancel} busy={busy} />
        </section>
      )}

      {initialBanners.map((b) => {
        const isEditing = editingId === b.id;
        return (
          <section key={b.id} className="card" style={{ opacity: b.active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={chip}>#{b.sortOrder}</span>
                <span style={{ ...chip, background: '#E2E8F0', color: '#334155' }}>{b.slideClass}</span>
                <span style={{ ...chip, background: b.active ? '#10B981' : '#94A3B8', color: '#fff' }}>
                  {b.active ? 'ON' : 'OFF'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => toggleActive(b)} disabled={busy} style={smBtn('#64748B')}>
                  {b.active ? '숨김' : '노출'}
                </button>
                <button type="button" onClick={() => (isEditing ? cancel() : startEdit(b))} disabled={busy || (editingId !== null && !isEditing)} style={smBtn('#3B82F6')}>
                  {isEditing ? '닫기' : '수정'}
                </button>
                <button type="button" onClick={() => remove(b.id)} disabled={busy} style={smBtn('#EF4444')}>
                  삭제
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'flex-start' }}>
              <BannerThumb visualType={b.visualType} visualValue={b.visualValue} slideClass={b.slideClass} />
              <div style={{ fontSize: 12, lineHeight: 1.6, minWidth: 0 }}>
                <div style={{ color: '#DC2626', fontWeight: 600 }}>{b.badge}</div>
                <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'pre-line', margin: '2px 0' }}>{b.title}</div>
                <div style={{ color: '#475569', whiteSpace: 'pre-line' }}>{b.sub}</div>
                <div style={{ marginTop: 6, fontSize: 11, color: '#94A3B8', wordBreak: 'break-all' }}>
                  visual: {b.visualType} · {b.visualValue}
                  {b.ctaHint && <> · CTA: {b.ctaHint}</>}
                  {b.onClick && <> · onClick: {b.onClick}</>}
                  {b.linkUrl && <> · 🔗 {b.linkUrl}</>}
                </div>
              </div>
            </div>

            {isEditing && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #E2E8F0' }}>
                <BannerForm draft={draft} setDraft={setDraft} />
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

function BannerThumb({ visualType, visualValue, slideClass }: { visualType: string; visualValue: string; slideClass: string }) {
  const bg: Record<string, string> = {
    'slide-a': '#7F1D1D', 'slide-b': '#0F766E', 'slide-c': '#6D28D9', 'slide-d': '#EA580C',
  };
  const isImg = visualType === 'image' && /^(https?:\/\/|\/)/.test(visualValue);
  return (
    <div style={{
      width: 96, height: 64, flexShrink: 0, borderRadius: 6, overflow: 'hidden',
      background: bg[slideClass] ?? '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={visualValue} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: 30 }}>{visualType === 'emoji' ? visualValue : '🖼'}</span>
      )}
    </div>
  );
}

function BannerForm({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    setUpErr(null); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/banners/upload', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      if (!body?.url) throw new Error('업로드 응답에 url 이 없습니다');
      setDraft({ ...draft, visualType: 'image', visualValue: body.url });
    } catch (e) {
      setUpErr(e instanceof Error ? e.message : '업로드 실패');
    } finally { setUploading(false); }
  };

  const hasPreview = draft.visualValue && /^(https?:\/\/|\/)/.test(draft.visualValue);
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
        <Field label="정렬 (작을수록 먼저)">
          <input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })} style={inp} />
        </Field>
        <Field label="슬라이드 색상">
          <select value={draft.slideClass} onChange={(e) => setDraft({ ...draft, slideClass: e.target.value })} style={inp}>
            {SLIDE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label="뱃지 (예: ★ 팬 프로젝트)">
        <input type="text" value={draft.badge} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} style={inp} />
      </Field>
      <Field label="제목 (줄바꿈 ⏎)">
        <textarea value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} />
      </Field>
      <Field label="설명 (줄바꿈 ⏎)">
        <textarea value={draft.sub} onChange={(e) => setDraft({ ...draft, sub: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} />
      </Field>
      <Field label="CTA 힌트 (예: 👉 TAP, 비우면 숨김)">
        <input type="text" value={draft.ctaHint ?? ''} onChange={(e) => setDraft({ ...draft, ctaHint: e.target.value || null })} style={inp} />
      </Field>

      <Field label="비주얼 타입">
        <select value={draft.visualType} onChange={(e) => setDraft({ ...draft, visualType: e.target.value })} style={inp}>
          {VISUAL_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </Field>

      <Field label={draft.visualType === 'emoji' ? '이모지 (예: 💬)' : '이미지 URL / 경로 (직접 입력 또는 업로드)'}>
        <input
          type="text"
          value={draft.visualValue}
          onChange={(e) => setDraft({ ...draft, visualValue: e.target.value })}
          placeholder={draft.visualType === 'image' ? 'https://… 또는 /promo/foo.png' : ''}
          style={inp}
        />
      </Field>

      {draft.visualType === 'image' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ ...uploadBtn, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? '업로드 중…' : '🖼 이미지 업로드 (jpg/png/webp, ≤4MB)'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => { onPickImage(e.target.files?.[0] ?? null); e.target.value = ''; }}
              style={{ display: 'none' }}
            />
          </label>
          {upErr && <span style={{ fontSize: 11, color: '#B91C1C' }}>⚠ {upErr}</span>}
        </div>
      )}
      {draft.visualType === 'image' && (
        <BannerSpec previewUrl={hasPreview ? draft.visualValue : null} dim={dim} onDim={setDim} />
      )}

      <Field label="클릭 동작 (특수 액션 — 링크보다 우선)">
        <select value={draft.onClick ?? ''} onChange={(e) => setDraft({ ...draft, onClick: e.target.value || null })} style={inp}>
          {ON_CLICKS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </Field>

      <Field label="연결 링크 (URL/경로 — 클릭 시 이동, 비우면 비클릭)">
        <input
          type="text"
          value={draft.linkUrl ?? ''}
          onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value || null })}
          placeholder="/cards/snkrdunk 또는 https://example.com"
          style={inp}
        />
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
        활성 (홈 노출)
      </label>
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
const uploadBtn: React.CSSProperties = {
  display: 'inline-block', padding: '8px 12px', fontSize: 12, color: '#334155',
  background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, cursor: 'pointer',
};
const chip: React.CSSProperties = {
  fontSize: 11, padding: '3px 7px', borderRadius: 4, background: '#1E293B', color: '#fff', lineHeight: 1,
};


/* ── 히어로 배너 표시 영역 스펙 + 업로드 이미지 판정 ───────────────────────── */
// 웹 홈은 390px 폰 프레임(≤480px 뷰포트에선 100vw), 앱은 기기 폭(대개 360~430pt).
// 이미지 슬라이드는 가로 100% · 높이 = 폭 ÷ (가로/세로) 로 좌우 잘림 없이 표시된다.
// 텍스트 슬라이드 높이는 176px 이므로, 그와 비슷한 높이가 되는 2.2:1 근처가 가장 자연스럽다.
const BANNER_WEB_W = 390;
const BANNER_TEXT_H = 176;
const RATIO_BEST = BANNER_WEB_W / BANNER_TEXT_H; // ≈ 2.22

function BannerSpec({ previewUrl, dim, onDim }: {
  previewUrl: string | null;
  dim: { w: number; h: number } | null;
  onDim: (d: { w: number; h: number } | null) => void;
}) {
  const ratio = dim ? dim.w / dim.h : null;
  const webH = ratio ? Math.round(BANNER_WEB_W / ratio) : null;
  let verdict: { text: string; color: string } | null = null;
  if (ratio) {
    if (dim!.w < 720) verdict = { text: `가로 ${dim!.w}px — 저해상도. 고밀도 화면에서 흐려집니다. 1080px 이상 권장`, color: '#B45309' };
    else if (ratio < 1.6) verdict = { text: `비율 ${ratio.toFixed(2)}:1 — 세로로 너무 길어 배너가 ${webH}px 로 커집니다(텍스트 슬라이드 ${BANNER_TEXT_H}px). 2:1 이상 권장`, color: '#B45309' };
    else if (ratio > 3.2) verdict = { text: `비율 ${ratio.toFixed(2)}:1 — 너무 납작해 배너 높이가 ${webH}px 로 낮고 위아래 여백이 생깁니다. 2~2.5:1 권장`, color: '#B45309' };
    else verdict = { text: `비율 ${ratio.toFixed(2)}:1 — 적합 ✓ (웹 390px 폭에서 높이 ${webH}px)`, color: '#047857' };
  }
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', background: '#F8FAFC', fontSize: 12, lineHeight: 1.7 }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>📐 히어로 배너 표시 영역</div>
      <div style={{ color: '#475569' }}>
        · 웹 홈: 폭 <b>{BANNER_WEB_W}px</b> (폰 프레임) · 앱: 기기 폭 <b>360~430pt</b> — 이미지는 <b>가로 100%, 높이는 비율대로</b> (좌우 잘림 없음)<br />
        · 텍스트 슬라이드 높이 {BANNER_TEXT_H}px → <b>최적 비율 {RATIO_BEST.toFixed(2)}:1</b>, 권장 해상도 <b>1080×486</b> (또는 1170×527, 2160×972)<br />
        · 허용 범위 2:1 ~ 2.5:1 · 가로 1080px 이상 · 4MB 이하 · 문구는 이미지 안에 직접(배지/제목/부제는 이미지 슬라이드에서 표시되지 않음)
      </div>
      {previewUrl && (
        <div style={{ marginTop: 8 }}>
          <div style={{ width: BANNER_WEB_W, background: '#0F172A', borderRadius: 4, overflow: 'hidden', border: '1px solid #CBD5E1' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="실제 웹 폭(390px) 미리보기"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              onLoad={(e) => { const im = e.currentTarget; onDim({ w: im.naturalWidth, h: im.naturalHeight }); }}
              onError={() => onDim(null)}
            />
          </div>
          <div style={{ marginTop: 4, color: '#475569' }}>
            {dim ? <>업로드 이미지 <b>{dim.w}×{dim.h}px</b> · </> : '이미지 정보를 읽는 중… · '}
            {verdict && <span style={{ color: verdict.color, fontWeight: 600 }}>{verdict.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
