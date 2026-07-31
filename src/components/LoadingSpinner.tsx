'use client';

import { useEffect, useState } from 'react';
import {
  LOADING_PROGRESS_TICK_MS,
  stepLoadingProgress,
} from '../../shared/loadingProgress';

/**
 * 의사-진행률 훅 — 99%까지 점점 느리게 오르고, 100은 절대 스스로 도달하지 않는다.
 * 100%는 로딩이 실제로 끝난 시점에만 (percent prop 강제 또는 언마운트로) 표시한다.
 */
export function useLoadingProgress(): number {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setPct((p) => stepLoadingProgress(p)),
      LOADING_PROGRESS_TICK_MS,
    );
    return () => clearInterval(id);
  }, []);
  return Math.floor(pct);
}

interface Props {
  size?: number;
  /** 지정 시 내부 시뮬레이션 대신 이 값을 표시 (완료 시 100 강제용). */
  percent?: number;
  /** 퍼센트 텍스트 숨김 (인라인 소형 스피너용). */
  hidePercent?: boolean;
}

/** 일반 링 스피너 + 로딩 퍼센트. 웹 전 페이지 로딩 UI 공용. */
export function LoadingSpinner({ size = 56, percent, hidePercent }: Props) {
  const simulated = useLoadingProgress();
  const shown = percent ?? simulated;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        className="pf-pokeball-spinner"
        style={{ width: size, height: size }}
        aria-hidden
      />
      {hidePercent ? null : (
        <div
          style={{
            fontFamily: 'var(--f1)',
            fontSize: 11,
            color: 'var(--ink)',
            letterSpacing: 1,
          }}
        >
          {shown}%
        </div>
      )}
    </div>
  );
}
