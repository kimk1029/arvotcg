'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { snkrdunkApparelUrl } from '@/lib/snkrdunk';
import { useToast } from '@/components/ToastProvider';
import { CardRegisterSheet } from '@/components/cards/CardRegisterSheet';

interface Props {
  apparelId: number;
  /** 추가시 별칭으로 저장될 카드명. 비우면 null. */
  cardName?: string;
  /** 카드등록 시트에 표시할 이미지. */
  imageUrl?: string | null;
  /** 현재시세 (JPY) — 시트의 자동 표시/직접뽑기 기준가. */
  currentPriceJpy?: number | null;
  /** 등급별 현재시세 (JPY) — 등록 시트의 등록가 미리보기용. */
  gradePrices?: { single: number; psa10: number; psa9: number; psa8: number } | null;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

/**
 * 카드 시세 상세 페이지의 액션 줄 — 모바일 PixelPress 와 동일 라벨/룩.
 * 컬렉션은 `/api/me/cards`, 관심은 `/api/me/favorites` 를 호출.
 * 마운트 시 둘 다 fetch 해서 이미 추가된 카드면 ✓ 표시.
 * 미로그인 시 클릭하면 `/login` 으로 이동.
 */
export function CardActions({ apparelId, cardName, imageUrl, currentPriceJpy, gradePrices }: Props) {
  const [favStatus, setFavStatus] = useState<Status>('idle');
  const [isFav, setIsFav] = useState<boolean>(false);
  const [isCollected, setIsCollected] = useState<boolean>(false);
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean>(true);
  const toast = useToast();

  // 마운트 시 컬렉션/관심 여부 확인 — 이미 추가된 카드면 즉시 ✓ 로 표시.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [favRes, cardRes] = await Promise.all([
          fetch('/api/me/favorites', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/me/cards', { credentials: 'include', cache: 'no-store' }),
        ]);
        if (!alive) return;
        if (favRes.status === 401 || cardRes.status === 401) setAuthed(false);
        if (favRes.ok) {
          const j = (await favRes.json()) as { data?: Array<{ snkrdunkApparelId: number }> };
          setIsFav((j.data ?? []).some((row) => row.snkrdunkApparelId === apparelId));
        }
        if (cardRes.ok) {
          const j = (await cardRes.json()) as {
            data?: Array<{ snkrdunkApparelId: number | null }>;
          };
          setIsCollected((j.data ?? []).some((row) => row.snkrdunkApparelId === apparelId));
        }
      } catch {
        // ignore — 미로그인일 가능성
      }
    })();
    return () => {
      alive = false;
    };
  }, [apparelId]);

  const goLogin = () => {
    window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
  };

  // 바로 추가하지 않고 "카드 등록" 시트를 띄운다 (구매가/직접뽑기/등급 입력).
  // 이미 담긴 카드면 제거 확인 → 확인 시 컬렉션에서 제거 후 버튼 원복 (모바일 동일).
  const openSheet = () => {
    if (!authed) {
      goLogin();
      return;
    }
    if (isCollected) {
      if (window.confirm('내 컬렉션에서 제거하겠습니까?')) void removeFromCollection();
      return;
    }
    setSheetOpen(true);
  };

  const removeFromCollection = async () => {
    try {
      const res = await fetch('/api/me/cards', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        goLogin();
        return;
      }
      const j = (await res.json()) as { data?: Array<{ id: number; snkrdunkApparelId: number | null }> };
      const rows = (j.data ?? []).filter((r) => r.snkrdunkApparelId === apparelId);
      for (const r of rows) {
        const d = await fetch(`/api/me/cards/${r.id}`, { method: 'DELETE', credentials: 'include' });
        if (!d.ok) throw new Error(`HTTP ${d.status}`);
      }
      setIsCollected(false);
      toast.success('내 컬렉션에서 제거되었습니다');
    } catch {
      toast.error('컬렉션 제거 실패 — 잠시 후 다시 시도해 주세요');
    }
  };

  const toggleFavorite = async () => {
    if (favStatus === 'loading') return;
    setFavStatus('loading');
    const wantOn = !isFav;
    try {
      const r = await fetch(
        wantOn
          ? '/api/me/favorites'
          : `/api/me/favorites/${apparelId}`,
        {
          method: wantOn ? 'POST' : 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: wantOn ? JSON.stringify({ snkrdunkApparelId: apparelId }) : undefined,
        },
      );
      if (r.status === 401) {
        goLogin();
        return;
      }
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as
          | { error?: string; code?: string; message?: string }
          | null;
        const detail = body?.message || body?.code || body?.error || `HTTP ${r.status}`;
        throw new Error(detail);
      }
      setIsFav(wantOn);
      setFavStatus('done');
      toast.success(wantOn ? '관심카드에 추가되었습니다' : '관심카드에서 제거되었습니다');
      setTimeout(() => setFavStatus('idle'), 800);
    } catch (err) {
      setFavStatus('error');
      const msg = err instanceof Error ? err.message : '실패';
      toast.error(`관심카드 ${wantOn ? '추가' : '제거'} 실패: ${msg}`);
      setTimeout(() => setFavStatus('idle'), 1200);
    }
  };

  return (
    <>
    {sheetOpen && (
      <div className="cv-sheet-overlay" onClick={() => setSheetOpen(false)}>
        <div className="cv-sheet-modal" onClick={(e) => e.stopPropagation()}>
          <div className="cv-sheet-head">
            <span className="form-label" style={{ margin: 0 }}>＋ 카드 등록</span>
            <button type="button" className="cv-sheet-close" onClick={() => setSheetOpen(false)} aria-label="닫기">
              ✕
            </button>
          </div>
          <CardRegisterSheet
            card={{
              snkrdunkApparelId: apparelId,
              name: cardName ?? null,
              imageUrl: imageUrl ?? null,
              currentPriceJpy: currentPriceJpy ?? null,
              gradePrices: gradePrices ?? null,
            }}
            redirectOnSave={false}
            onSaved={() => {
              setIsCollected(true);
              toast.success('내 컬렉션에 등록되었습니다');
              setTimeout(() => setSheetOpen(false), 900);
            }}
          />
        </div>
      </div>
    )}
    {/* ARVOTCG 카드상세 디자인 — 넓은 컬렉션 버튼 + 정사각형 SNKR·관심 버튼. */}
    <div style={{ display: 'flex', gap: 8, margin: '0 var(--gap) var(--cg)' }}>
      <button
        type="button"
        onClick={openSheet}
        aria-label="내 컬렉션에 추가"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          padding: 13,
          border: 'none',
          borderRadius: 'var(--r)',
          background: isCollected ? 'var(--grn)' : 'var(--ink)',
          color: 'var(--white)',
          fontFamily: 'var(--f1)',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.3,
          cursor: 'pointer',
        }}
      >
        {isCollected ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        )}
        <span style={{ whiteSpace: 'nowrap' }}>{isCollected ? '내 컬렉션에 담김' : '내 컬렉션에 추가'}</span>
      </button>
      <a
        href={snkrdunkApparelUrl(apparelId)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="SNKRDUNK 에서 보기"
        title="SNKRDUNK에서 보기"
        style={{
          flex: 'none',
          width: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--pap3)',
          borderRadius: 'var(--r)',
          background: 'var(--white)',
          cursor: 'pointer',
        }}
      >
        <Image src="/snkrdunk-icon.png" alt="snkrdunk" width={20} height={20} style={{ display: 'block' }} />
      </a>
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={favStatus === 'loading'}
        aria-label="관심카드"
        title="관심카드"
        style={{
          flex: 'none',
          width: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${isFav ? 'var(--orn)' : 'var(--pap3)'}`,
          borderRadius: 'var(--r)',
          background: isFav ? 'var(--orn-lt,var(--white))' : 'var(--white)',
          cursor: 'pointer',
          opacity: favStatus === 'loading' ? 0.6 : 1,
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill={isFav ? 'var(--orn)' : 'none'} stroke="var(--orn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 15.1 8.3 22 9.3l-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z" />
        </svg>
      </button>
    </div>
    </>
  );
}
