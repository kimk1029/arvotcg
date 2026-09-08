'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 서버 컴포넌트 페이지를 주기적으로 다시 렌더 (접속중 사용자 현황). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
