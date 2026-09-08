'use client';

import { useEffect, useState } from 'react';
import { CardThumb } from '@/components/CardThumb';
import { useTheme } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { cardZoomCaption, cardZoomLayout, type CardZoomKind } from '../../shared/cardZoom';

/**
 * 1in 당 CSS px — 터치 기기(폰·태블릿)는 CSS px ≈ Android dp / iOS pt(160/in)라 실물에 가깝고,
 * 데스크톱은 CSS 표준 96px/in. (앱 CardImageZoom 은 dp 160 고정)
 */
function cssPxPerInch(): number {
  if (typeof window === 'undefined') return 96;
  return window.matchMedia?.('(pointer: coarse)').matches ? 160 : 96;
}

function useViewport(active: boolean) {
  const read = () => (typeof window === 'undefined' ? { w: 390, h: 800 } : { w: window.innerWidth, h: window.innerHeight });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    if (!active) return;
    const on = () => setVp(read());
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [active]);
  return vp;
}

interface Props {
  src: string | null;
  alt: string;
  /** 썸네일 크기. 기본 96x96 (기존 호출부 유지). 상세 히어로는 크게 지정. */
  width?: number;
  height?: number;
  /** box 면 카드 비율·실물 크기 강제 없이 이미지 비율대로 화면에 맞춤 */
  kind?: CardZoomKind;
}

export function SnkrdunkImageZoom({ src, alt, width = 96, height = 96, kind = 'card' }: Props) {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  const isClean = isFlatTheme(theme);
  const vp = useViewport(open);
  // 실물 63×88mm 컨테이너에 카드가 꽉 차게 — 레이아웃 정본 shared/cardZoom.ts (앱 CardImageZoom 동일).
  const L = cardZoomLayout({ viewportWidth: vp.w, viewportHeight: vp.h, pxPerInch: cssPxPerInch(), kind });

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
            padding: 12,
            cursor: 'zoom-out',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: L.width,
              height: L.height,
              borderRadius: L.radius,
              overflow: 'hidden',
              background: '#111',
              boxShadow: '0 24px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.12)',
              cursor: 'default',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              style={{ position: 'absolute', left: L.imageLeft, top: L.imageTop, width: L.imageWidth, height: L.imageHeight, objectFit: 'contain', display: 'block' }}
            />
          </div>
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10, letterSpacing: 0.5, color: 'rgba(255,255,255,.6)', pointerEvents: 'none' }}>
            {cardZoomCaption(kind)}
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
