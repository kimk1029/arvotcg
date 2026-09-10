'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

/**
 * 서버 컴포넌트 페이지를 지금 즉시 다시 불러온다.
 * router.refresh() 는 페이지 전체를 새로 그리지 않고 서버에서 데이터만 다시 받아온다.
 */
export function RefreshButton({ label = '새로고침' }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);

  const click = () => {
    setSpinning(true);
    startTransition(() => router.refresh());
    // 갱신이 순식간에 끝나도 눌린 게 보이도록 최소 시간은 돌린다.
    window.setTimeout(() => setSpinning(false), 500);
  };

  const busy = pending || spinning;
  return (
    <button
      type="button"
      className="refresh-btn"
      onClick={click}
      disabled={busy}
      aria-label={label}
      aria-busy={busy}
      title={label}
    >
      <span className={busy ? 'refresh-ico spin' : 'refresh-ico'} aria-hidden>⟳</span>
      <span className="refresh-label">{busy ? '불러오는 중' : label}</span>
    </button>
  );
}
