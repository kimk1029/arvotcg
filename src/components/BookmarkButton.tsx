'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  tradeId?: number;
  feedId?: number;
  initial?: boolean;
  /** 서버가 준 좋아요 수 — 버튼 옆에 함께 표시(낙관 반영 포함). 없으면 숫자 숨김. */
  count?: number;
}

/**
 * 좋아요(하트) 버튼 — 누르면 **즉시** 하트가 빨갛게 켜지고 숫자도 바로 오른다.
 * 서버(POST /api/bookmarks) 응답은 뒤에서 확인해 어긋나면 되돌린다.
 * (예전엔 응답을 기다렸다 켜져서 반응이 느렸다.)
 */
export function BookmarkButton({ tradeId, feedId, initial = false, count }: Props) {
  const [liked, setLiked] = useState(initial);
  const [delta, setDelta] = useState(0);
  const pendingRef = useRef(false);

  // 목록을 다시 받아 서버 값이 바뀌면 그 값으로 맞춘다(앱 BookmarkHeart 와 동일).
  useEffect(() => {
    if (pendingRef.current) return;
    setLiked(initial);
    setDelta(0);
  }, [initial]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pendingRef.current) return;
    pendingRef.current = true;
    const next = !liked;
    setLiked(next);            // 낙관 토글 — 클릭 즉시 반영
    setDelta((d) => d + (next ? 1 : -1));
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId, feedId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { bookmarked: boolean };
      // 서버가 다른 상태를 주면(중복 클릭·미로그인 등) 그 값으로 맞춘다.
      if (data.bookmarked !== next) {
        setLiked(data.bookmarked);
        setDelta((d) => d + (data.bookmarked ? 1 : -1) - (next ? 1 : -1));
      }
    } catch {
      setLiked(!next);
      setDelta((d) => d - (next ? 1 : -1));
    } finally {
      pendingRef.current = false;
    }
  };

  const total = count != null ? Math.max(0, count + delta) : null;

  return (
    <button
      onClick={toggle}
      aria-label={liked ? '좋아요 취소' : '좋아요'}
      aria-pressed={liked}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{liked ? '❤️' : '🤍'}</span>
      {total != null && total > 0 && (
        <span style={{ fontSize: 12.5, fontWeight: 700, color: liked ? 'var(--red)' : 'var(--ink3)' }}>{total}</span>
      )}
    </button>
  );
}
