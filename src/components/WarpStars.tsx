'use client';

/**
 * 워프 스타필드 — 로그인 화면 배경. 별들이 소실점(히어로 문구 중앙)에서 바깥으로
 * 가속하며 흘러나가 "우주를 앞으로 나아가는" 느낌을 준다. 앱 WarpStars 와 동일 파라미터.
 *
 *  · 소실점: `anchorId` 요소의 중앙 (없으면 캔버스 중앙).
 *  · 별: 중앙 근처에서 태어나 방사 방향으로 가속(ease-in), 진행할수록 길고 밝은 스트릭.
 *  · prefers-reduced-motion 이면 정지된 점만 그린다.
 */
import { useEffect, useRef } from 'react';

interface Star {
  /** 방사 방향 (단위 벡터). */
  dx: number;
  dy: number;
  /** 진행도 0→1. */
  z: number;
  /** 초당 진행 속도. */
  speed: number;
  /** 밝기 계수. */
  tint: string;
}

const COUNT = 70;
const TINTS = ['255,255,255', '255,210,122', '124,224,255', '178,124,255'];

function spawn(): Star {
  const a = Math.random() * Math.PI * 2;
  return {
    dx: Math.cos(a),
    dy: Math.sin(a),
    z: Math.random(),
    speed: 0.22 + Math.random() * 0.28,
    tint: TINTS[Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 3)],
  };
}

export function WarpStars({ anchorId }: { anchorId?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const parent = canvas.parentElement;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const stars: Star[] = Array.from({ length: COUNT }, spawn);
    let raf = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const measure = () => {
      const r = (parent ?? canvas).getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const anchor = anchorId ? document.getElementById(anchorId) : null;
      if (anchor) {
        const a = anchor.getBoundingClientRect();
        cx = a.left - r.left + a.width / 2;
        cy = a.top - r.top + a.height / 2;
      } else {
        cx = w / 2;
        cy = h / 2;
      }
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(parent ?? canvas);

    const R = () => Math.hypot(w, h) * 0.62;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      const radius = R();
      for (const s of stars) {
        if (!reduced) s.z += s.speed * dt * (0.35 + s.z);
        if (s.z >= 1) {
          Object.assign(s, spawn(), { z: 0 });
          continue;
        }
        const e = s.z * s.z; // ease-in: 가까울수록 빠르게
        const x = cx + s.dx * e * radius;
        const y = cy + s.dy * e * radius;
        const len = reduced ? 0 : 2 + e * 26;
        const x0 = x - s.dx * len;
        const y0 = y - s.dy * len;
        const alpha = Math.min(1, s.z * 1.8) * (0.25 + e * 0.75);
        ctx.strokeStyle = `rgba(${s.tint},${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.6 + e * 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [anchorId]);

  return <canvas ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />;
}
