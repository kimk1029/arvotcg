'use client';

import { useEffect, useState } from 'react';

/**
 * 카메라 스캔 진행 오버레이 — 홈 검색바·카드추가 카메라 공용.
 * 앱은 사진 선택 즉시 검색 화면으로 넘어가 스피너+단계 문구를 보여주지만,
 * 웹은 File 객체를 페이지 전환으로 넘길 수 없어 현재 화면 위 풀스크린
 * 오버레이로 같은 피드백(스피너 + 진행 단계 작은 문구)을 준다 (패리티 예외 사유).
 */
export function ScanProgressOverlay({ visible }: { visible: boolean }) {
  const [step, setStep] = useState('사진 업로드 중...');
  useEffect(() => {
    if (!visible) return;
    setStep('사진 업로드 중...');
    // 업로드+OCR 은 단일 요청 — 경과 기반으로 단계 문구만 전환 (앱 동일).
    const t = setTimeout(() => setStep('카드 인식 중 (AI 분석)...'), 1600);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: 'rgba(0,0,0,0.55)',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 34,
          height: 34,
          border: '3px solid rgba(255,255,255,0.25)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'scanspin 0.8s linear infinite',
        }}
      />
      <div style={{ fontFamily: 'var(--f1)', fontSize: 11, color: '#fff', letterSpacing: 0.3 }}>{step}</div>
      <style>{'@keyframes scanspin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
