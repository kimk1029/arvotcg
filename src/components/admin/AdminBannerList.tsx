'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { HERO_AUTOPLAY_MAX_MS, HERO_AUTOPLAY_MIN_MS } from '../../../shared/heroBanner';

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

/** 클릭 시 이동할 앱/웹 화면 — 선택하면 연결 링크에 경로가 채워진다. (웹·앱 공통 경로) */
const APP_SCREENS = [
  { v: '', l: '— 직접 입력 / 없음 —' },
  { v: '/cards/snkrdunk', l: '인기 카드 (스니덩)' },
  { v: '/cards/packs', l: '시세확인 (팩)' },
  { v: '/cards/grading', l: '카드 스캔' },
  { v: '/cards/mvc-auction', l: 'MVC 경매' },
  { v: '/cards/bunjang', l: '국내마켓 (번개장터)' },
  { v: '/trade', l: '거래' },
  { v: '/feed', l: '커뮤니티 (피드)' },
  { v: '/my/cards', l: '내 컬렉션' },
  { v: '/my/oripa', l: '오리파' },
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

interface Props {
  initialBanners: BannerData[];
  /** 슬라이드 자동 전환 간격(ms) — /api/admin/banners/settings. */
  initialAutoplayMs: number;
}

export function AdminBannerList({ initialBanners, initialAutoplayMs }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 슬라이드 전환 간격(초) — 저장하면 홈(웹·앱) 히어로 배너 자동 회전 속도에 바로 반영.
  const [autoplaySec, setAutoplaySec] = useState<string>(String(Math.round(initialAutoplayMs / 100) / 10));
  const [savingInterval, setSavingInterval] = useState(false);
  const saveInterval = async () => {
    setErr(null);
    setMsg(null);
    const ms = Math.round(Number(autoplaySec) * 1000);
    if (!Number.isFinite(ms) || ms < HERO_AUTOPLAY_MIN_MS || ms > HERO_AUTOPLAY_MAX_MS) {
      setErr(`전환 간격은 ${HERO_AUTOPLAY_MIN_MS / 1000}~${HERO_AUTOPLAY_MAX_MS / 1000}초 사이로 입력해 주세요`);
      return;
    }
    setSavingInterval(true);
    try {
      const res = await fetch('/api/admin/banners/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoplayMs: ms }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setMsg('✓ 전환 간격 저장됨');
      router.refresh();
      setTimeout(() => setMsg(null), 1600);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSavingInterval(false);
    }
  };

  const startEdit = (b: BannerData) => {
    setEditingId(b.id);
    setDraft({ ...b });
    setErr(null);
    setMsg(null);
  };

  const startNew = () => {
    setEditingId('new');
    // 새 배너는 항상 맨 뒤(최대 sortOrder + 10) — 기본 50 고정이면 동점이 생겨 id 순으로 밀리며
    // 어드민이 의도한 순서가 지켜지지 않았다.
    const maxSort = initialBanners.reduce((m, b) => Math.max(m, b.sortOrder), 0);
    setDraft({ ...EMPTY_DRAFT, sortOrder: maxSort + 10 });
    setErr(null);
    setMsg(null);
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setErr(null);
  };

  const save = () => {
    setErr(null);
    setMsg(null);
    const isNew = editingId === 'new';
    const url = isNew ? '/api/admin/banners' : `/api/admin/banners/${draft.id}`;
    const method = isNew ? 'POST' : 'PATCH';

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

    startTransition(async () => {
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        setMsg(isNew ? '✓ 추가됨' : '✓ 저장됨');
        setEditingId(null);
        router.refresh();
        setTimeout(() => setMsg(null), 1600);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '저장 실패');
      }
    });
  };

  const remove = (id: number) => {
    if (!window.confirm('이 배너를 삭제할까요? 되돌릴 수 없습니다.')) return;
    setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        setMsg('✓ 삭제됨');
        if (editingId === id) cancel();
        router.refresh();
        setTimeout(() => setMsg(null), 1600);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '삭제 실패');
      }
    });
  };

  const toggleActive = (b: BannerData) => {
    setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/banners/${b.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !b.active }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : '상태 변경 실패');
      }
    });
  };

  return (
    <div style={{ padding: '0 var(--gap)' }}>
      {msg && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            background: 'var(--ink)',
            color: 'var(--yel)',
            fontFamily: 'var(--f1)',
            fontSize: 10,
            letterSpacing: 0.5,
            textAlign: 'center',
          }}
        >
          {msg}
        </div>
      )}
      {err && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            background: 'var(--red)',
            color: 'var(--white)',
            fontFamily: 'var(--f1)',
            fontSize: 10,
            letterSpacing: 0.5,
            textAlign: 'center',
          }}
        >
          ⚠ {err}
        </div>
      )}

      {/* 표시 설정 — 슬라이드 자동 전환 간격 (홈 웹·앱 공통) */}
      <div style={{ ...editorBoxStyle, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink2)', letterSpacing: 0.5, flex: '1 1 auto' }}>
          슬라이드 전환 간격
          <span style={{ marginLeft: 6, color: 'var(--ink3, var(--ink2))' }}>
            ({HERO_AUTOPLAY_MIN_MS / 1000}~{HERO_AUTOPLAY_MAX_MS / 1000}초 · 순서는 아래 정렬값 순)
          </span>
        </label>
        <input
          type="range"
          min={HERO_AUTOPLAY_MIN_MS / 1000}
          max={HERO_AUTOPLAY_MAX_MS / 1000}
          step={0.5}
          value={autoplaySec}
          onChange={(e) => setAutoplaySec(e.target.value)}
          style={{ flex: '1 1 140px', minWidth: 120, accentColor: 'var(--grn-dk)', cursor: 'pointer' }}
          aria-label="슬라이드 전환 간격(초)"
        />
        <span style={{ fontFamily: 'var(--f1)', fontSize: 12, fontWeight: 800, color: 'var(--ink)', minWidth: 44, textAlign: 'right' }}>
          {Number(autoplaySec).toFixed(1)}초
        </span>
        <button type="button" onClick={saveInterval} disabled={savingInterval || pending} style={btnStyle('var(--grn-dk)')}>
          {savingInterval ? '저장 중…' : '간격 저장'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink2)', letterSpacing: 0.5 }}>
          총 {initialBanners.length}개 · 정렬값(#) 작은 순으로 노출 · 비활성 배너는 홈에서 노출되지 않습니다
        </div>
        <button
          type="button"
          onClick={startNew}
          disabled={pending || editingId !== null}
          style={btnStyle('var(--blu)')}
        >
          + 추가
        </button>
      </div>

      {editingId === 'new' && (
        <div style={editorBoxStyle}>
          <div style={editorHeaderStyle}>새 배너</div>
          <BannerForm draft={draft} setDraft={setDraft} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={save} disabled={pending} style={btnStyle('var(--grn-dk)')}>
              {pending ? '저장 중…' : '저장'}
            </button>
            <button type="button" onClick={cancel} disabled={pending} style={btnStyle('var(--ink2)')}>
              취소
            </button>
          </div>
        </div>
      )}

      {initialBanners.map((b) => {
        const isEditing = editingId === b.id;
        return (
          <div key={b.id} style={{ ...rowBoxStyle, opacity: b.active ? 1 : 0.55 }}>
            <div style={rowHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={badgeChipStyle}>#{b.sortOrder}</span>
                <span style={{ ...badgeChipStyle, background: 'var(--pap2)' }}>{b.slideClass}</span>
                <span
                  style={{
                    ...badgeChipStyle,
                    background: b.active ? 'var(--grn-dk)' : 'var(--ink3)',
                    color: 'var(--white)',
                  }}
                >
                  {b.active ? 'ON' : 'OFF'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => toggleActive(b)}
                  disabled={pending}
                  style={btnStyleSm(b.active ? 'var(--ink3)' : 'var(--grn-dk)')}
                >
                  {b.active ? '숨김' : '노출'}
                </button>
                <button
                  type="button"
                  onClick={() => (isEditing ? cancel() : startEdit(b))}
                  disabled={pending || (editingId !== null && !isEditing)}
                  style={btnStyleSm('var(--blu)')}
                >
                  {isEditing ? '닫기' : '수정'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(b.id)}
                  disabled={pending}
                  style={btnStyleSm('var(--red)')}
                >
                  삭제
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, fontFamily: 'var(--f1)', fontSize: 11, lineHeight: 1.6, color: 'var(--ink)' }}>
              <div style={{ color: 'var(--red)' }}>{b.badge}</div>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'pre-line', margin: '4px 0' }}>{b.title}</div>
              <div style={{ color: 'var(--ink2)', whiteSpace: 'pre-line' }}>{b.sub}</div>
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink3)' }}>
                visual: {b.visualType} · {b.visualValue}
                {b.ctaHint && <> · CTA: {b.ctaHint}</>}
                {b.onClick && <> · onClick: {b.onClick}</>}
                {b.linkUrl && (
                  <> · 🔗 {APP_SCREENS.find((s) => s.v === b.linkUrl)?.l ?? b.linkUrl}</>
                )}
                {!b.onClick && !b.linkUrl && <> · (비클릭)</>}
              </div>
            </div>

            {isEditing && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed rgba(0,0,0,.2)' }}>
                <BannerForm draft={draft} setDraft={setDraft} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={save} disabled={pending} style={btnStyle('var(--grn-dk)')}>
                    {pending ? '저장 중…' : '저장'}
                  </button>
                  <button type="button" onClick={cancel} disabled={pending} style={btnStyle('var(--ink2)')}>
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BannerForm({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    setUpErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/banners/upload', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      if (!body?.url) throw new Error('업로드 응답에 url 이 없습니다');
      setDraft({ ...draft, visualType: 'image', visualValue: body.url });
    } catch (e) {
      setUpErr(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Field label="정렬 (작을수록 먼저)">
        <input
          type="number"
          value={draft.sortOrder}
          onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })}
          style={inputStyle}
        />
      </Field>

      <Field label="슬라이드 색상 클래스">
        <select
          value={draft.slideClass}
          onChange={(e) => setDraft({ ...draft, slideClass: e.target.value })}
          style={inputStyle}
        >
          {SLIDE_CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      {draft.visualType === 'image' && (
        <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink2)', padding: '8px 10px', background: 'var(--pap2)', lineHeight: 1.6 }}>
          이미지 배너는 이미지가 배너 전체를 덮고 문구를 그리지 않습니다. 뱃지·제목·설명은 선택(관리용 메모)입니다.
        </div>
      )}
      <Field label="뱃지 (선택 · 예: ★ 팬 프로젝트)">
        <input
          type="text"
          value={draft.badge}
          onChange={(e) => setDraft({ ...draft, badge: e.target.value })}
          style={inputStyle}
        />
      </Field>

      <Field label={draft.visualType === 'image' ? '제목 (선택 · 관리용 메모)' : '제목 (필수 · 줄바꿈은 ⏎ 키)'}>
        <textarea
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      <Field label="설명 (선택 · 줄바꿈은 ⏎ 키)">
        <textarea
          value={draft.sub}
          onChange={(e) => setDraft({ ...draft, sub: e.target.value })}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      <Field label="CTA 힌트 (예: 👉 TAP, 비우면 숨김)">
        <input
          type="text"
          value={draft.ctaHint ?? ''}
          onChange={(e) => setDraft({ ...draft, ctaHint: e.target.value || null })}
          style={inputStyle}
        />
      </Field>

      <Field label="비주얼 타입">
        <select
          value={draft.visualType}
          onChange={(e) => setDraft({ ...draft, visualType: e.target.value })}
          style={inputStyle}
        >
          {VISUAL_TYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.l}
            </option>
          ))}
        </select>
      </Field>

      <Field label={draft.visualType === 'emoji' ? '이모지 (예: 💬)' : '이미지 URL / 경로 (직접 입력 또는 업로드)'}>
        <input
          type="text"
          value={draft.visualValue}
          onChange={(e) => setDraft({ ...draft, visualValue: e.target.value })}
          placeholder={draft.visualType === 'image' ? 'https://… 또는 /promo/foo.png' : ''}
          style={inputStyle}
        />
      </Field>

      {draft.visualType === 'image' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ ...uploadBtnStyle, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? '업로드 중…' : '🖼 이미지 업로드 (jpg/png/webp, ≤4MB)'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                onPickImage(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
          </label>
          {upErr && (
            <div style={{ fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--red)' }}>⚠ {upErr}</div>
          )}
          {draft.visualValue && /^(https?:\/\/|\/)/.test(draft.visualValue) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.visualValue}
              alt="배너 이미지 미리보기"
              style={{ height: 72, width: 'auto', objectFit: 'contain', border: '1px solid var(--ink)', background: 'var(--pap2)' }}
            />
          )}
        </div>
      )}

      <Field label="클릭 동작 (특수 액션 — 링크보다 우선)">
        <select
          value={draft.onClick ?? ''}
          onChange={(e) => setDraft({ ...draft, onClick: e.target.value || null })}
          style={inputStyle}
        >
          {ON_CLICKS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      </Field>

      <Field label="앱 화면 바로가기 (선택하면 아래 링크에 자동 입력)">
        <select
          value={APP_SCREENS.some((s) => s.v === (draft.linkUrl ?? '')) ? (draft.linkUrl ?? '') : ''}
          onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value || null })}
          style={inputStyle}
        >
          {APP_SCREENS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.l}
            </option>
          ))}
        </select>
      </Field>

      <Field label="연결 링크 (URL/경로 — 클릭 시 이동, 비우면 비클릭)">
        <input
          type="text"
          value={draft.linkUrl ?? ''}
          onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value || null })}
          placeholder="/cards/snkrdunk 또는 https://example.com"
          style={inputStyle}
        />
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--f1)', fontSize: 11 }}>
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
        />
        활성 (홈 노출)
      </label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink2)', marginBottom: 4, letterSpacing: 0.5 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontFamily: 'var(--f1)',
  fontSize: 12,
  color: 'var(--ink)',
  background: 'var(--white)',
  border: '1px solid var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
};

const uploadBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 10px',
  fontFamily: 'var(--f1)',
  fontSize: 10,
  letterSpacing: 0.3,
  color: 'var(--white)',
  background: 'var(--ink2)',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'center',
};

const editorBoxStyle: React.CSSProperties = {
  marginBottom: 12,
  padding: 12,
  background: 'var(--white)',
  boxShadow:
    '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
};

const editorHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--f1)',
  fontSize: 11,
  color: 'var(--ink)',
  letterSpacing: 0.5,
  marginBottom: 10,
  fontWeight: 700,
};

const rowBoxStyle: React.CSSProperties = {
  marginBottom: 10,
  padding: 10,
  background: 'var(--white)',
  boxShadow:
    '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
};

const rowHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
};

const badgeChipStyle: React.CSSProperties = {
  fontFamily: 'var(--f1)',
  fontSize: 9,
  letterSpacing: 0.3,
  padding: '3px 6px',
  background: 'var(--ink)',
  color: 'var(--white)',
  lineHeight: 1,
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '8px 12px',
    fontFamily: 'var(--f1)',
    fontSize: 10,
    letterSpacing: 0.5,
    color: 'var(--white)',
    background: bg,
    border: 'none',
    cursor: 'pointer',
  };
}

function btnStyleSm(bg: string): React.CSSProperties {
  return {
    padding: '4px 8px',
    fontFamily: 'var(--f1)',
    fontSize: 9,
    letterSpacing: 0.3,
    color: 'var(--white)',
    background: bg,
    border: 'none',
    cursor: 'pointer',
  };
}
