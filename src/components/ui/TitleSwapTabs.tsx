'use client';

/**
 * 두 타이틀이 자리를 서로 교환하며 전환되는 탭 헤더.
 * 큰(22px)/작은(16px) 폭을 숨김 측정해 절대 위치 + transform 으로 애니메이션한다.
 * 커뮤니티(커뮤니티↔Shop)·내 자산(내 자산↔관심카드)이 공유.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

const TITLE_GAP = 12;

interface Props<T extends string> {
  left: { id: T; label: string };
  right: { id: T; label: string };
  value: T;
  onChange: (id: T) => void;
  /** 활성 타이틀 색 */
  ink: string;
  /** 비활성 타이틀 색 */
  dim: string;
}

export function TitleSwapTabs<T extends string>({ left, right, value, onChange, ink, dim }: Props<T>) {
  const measRef = useRef<HTMLDivElement | null>(null);
  const [tw, setTw] = useState<{ lb: number; ls: number; rb: number; rs: number } | null>(null);
  const isRight = value === right.id;

  useLayoutEffect(() => {
    const measure = () => {
      const el = measRef.current;
      if (!el) return;
      const [lb, ls, rb, rs] = Array.from(el.children).map((c) => (c as HTMLElement).offsetWidth);
      setTw({ lb, ls, rb, rs });
    };
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => window.removeEventListener('resize', measure);
  }, [left.label, right.label]);

  const leftX = !tw ? 0 : isRight ? tw.rb + TITLE_GAP : 0;
  const rightX = !tw ? (isRight ? 0 : 130) : isRight ? 0 : tw.lb + TITLE_GAP;
  const boxW = !tw ? 180 : Math.max(tw.lb + TITLE_GAP + tw.rs, tw.rb + TITLE_GAP + tw.ls);

  const btn = (active: boolean): CSSProperties => ({
    position: 'absolute', left: 0, bottom: 0, lineHeight: 1,
    fontSize: active ? 22 : 16, fontWeight: 900,
    color: active ? ink : dim, letterSpacing: '-.6px',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    transition: 'transform .3s cubic-bezier(.4,0,.2,1), font-size .3s cubic-bezier(.4,0,.2,1), color .3s',
  });
  const meas: CSSProperties = {
    fontWeight: 900, letterSpacing: '-.6px', lineHeight: 1,
    display: 'inline-block', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ position: 'relative', width: boxW, height: 24 }}>
      {/* 폭 측정용 숨김 스팬: 왼쪽(대/소) · 오른쪽(대/소) */}
      <div ref={measRef} aria-hidden style={{ position: 'absolute', visibility: 'hidden', height: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <span style={{ ...meas, fontSize: 22 }}>{left.label}</span>
        <span style={{ ...meas, fontSize: 16 }}>{left.label}</span>
        <span style={{ ...meas, fontSize: 22 }}>{right.label}</span>
        <span style={{ ...meas, fontSize: 16 }}>{right.label}</span>
      </div>
      <button type="button" onClick={() => onChange(left.id)} style={{ ...btn(!isRight), transform: `translateX(${leftX}px)` }}>
        {left.label}
      </button>
      <button type="button" onClick={() => onChange(right.id)} style={{ ...btn(isRight), transform: `translateX(${rightX}px)` }}>
        {right.label}
      </button>
    </div>
  );
}
