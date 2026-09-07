'use client';

import { useEffect, useState } from 'react';
import { CardThumb } from '@/components/CardThumb';
import { useTheme } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';

interface Props {
  src: string | null;
  alt: string;
  /** 썸네일 크기. 기본 96x96 (기존 호출부 유지). 상세 히어로는 크게 지정. */
  width?: number;
  height?: number;
}

export function SnkrdunkImageZoom({ src, alt, width = 96, height = 96 }: Props) {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  const isClean = isFlatTheme(theme);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (src) setOpen(true);
        }}
        aria-label={src ? `${alt} 이미지 확대 보기` : alt}
        style={{
          width,
          height,
          flexShrink: 0,
          background: 'var(--pap2)',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          padding: 0,
          cursor: src ? 'zoom-in' : 'default',
          ...(isClean
            ? { border: '1px solid var(--pap3)', borderRadius: 0, boxShadow: '0 1px 3px rgba(16,18,22,.12)' }
            : { border: 'none', boxShadow: '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink)' }),
        }}
      >
        <CardThumb src={src} alt={alt} style={{ width: '100%', height: '100%' }} />
      </button>
      {open && src ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            zIndex: 1000,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            cursor: 'zoom-out',
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* 실제 카드 크기(63×88mm) — CSS mm 단위는 화면에서 대략 실물 치수. 화면이 더 작으면 폭/높이에 맞춘다.
              (앱 [id].tsx 줌 모달과 같은 규칙: 63mm ↔ 397dp) */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(63mm, 92vw, calc(82vh * 63 / 88))',
              aspectRatio: '63 / 88',
              borderRadius: '3mm',
              overflow: 'hidden',
              background: '#111',
              boxShadow: '0 24px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.12)',
              cursor: 'default',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10, letterSpacing: 0.5, color: 'rgba(255,255,255,.6)', pointerEvents: 'none' }}>
            실제 카드 크기 63 × 88mm · 탭하면 닫힘
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            aria-label="닫기"
            style={{
              position: 'fixed',
              top: 16,
              right: 16,
              background: 'var(--ink)',
              color: 'var(--gold)',
              fontFamily: 'var(--f1)',
              fontSize: 12,
              letterSpacing: 0.5,
              padding: '8px 12px',
              border: '2px solid var(--gold)',
              cursor: 'pointer',
            }}
          >
            ✕ 닫기
          </button>
        </div>
      ) : null}
    </>
  );
}
