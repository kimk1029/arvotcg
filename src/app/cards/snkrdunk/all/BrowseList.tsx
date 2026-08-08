'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CardThumb } from '@/components/CardThumb';
import { ListAdRow } from '@/components/ListAdRow';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { translateKnownCardNameToKo } from '@/lib/cardTranslate';
import { autoPriceSize } from '../../../../../shared/util/autoPriceSize';
import { SNKRDUNK_GAME_KEYWORD } from '../../../../../shared/gameKeyword';

export interface BrowseItem {
  apparelId: number;
  name: string;
  imageUrl: string | null;
  priceText: string;
}

interface BrowseResponse {
  page?: number;
  results: BrowseItem[];
}

function shortenName(name: string): string {
  const cut = name.split(/[|｜]/)[0].trim();
  return cut.length > 36 ? cut.slice(0, 35) + '…' : cut;
}

/**
 * 무한스크롤 카드 그리드. 첫 페이지는 서버에서 SSR 로 받아 props 로 주입되고
 * (검색엔진 인덱싱·초기 페인트용), 2페이지부터 클라이언트가 이어 받는다.
 * game(IP)이 포켓몬이 아니면 브라우즈 대신 해당 게임 키워드 검색으로 페이지를 잇는다.
 */
export function BrowseList({ initialItems, game = 'pokemon' }: { initialItems: BrowseItem[]; game?: string }) {
  const [items, setItems] = useState<BrowseItem[]>(initialItems);
  // 서버가 1페이지를 채웠으니 클라이언트는 2페이지부터.
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialItems.length === 0);
  const [error, setError] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set(initialItems.map((r) => r.apparelId)));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const kw = SNKRDUNK_GAME_KEYWORD[game];
      const url = kw
        ? `/api/snkrdunk/search?q=${encodeURIComponent(kw)}&page=${p}`
        : `/api/snkrdunk/browse?page=${p}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as BrowseResponse;
      const fresh = json.results.filter((r) => !seenIdsRef.current.has(r.apparelId));
      fresh.forEach((r) => seenIdsRef.current.add(r.apparelId));
      if (fresh.length === 0) {
        setDone(true);
      } else {
        setItems((prev) => [...prev, ...fresh]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [game]);

  // IntersectionObserver 로 sentinel 가 보이면 다음 페이지 요청
  useEffect(() => {
    if (done) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !done) {
          const next = page + 1;
          setPage(next);
          loadPage(next);
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [page, loading, done, loadPage]);

  return (
    <div className="sect">
      <SectionTitle title="전체 카드" right={<span className="more">{items.length}종</span>} />

      {items.flatMap((it, i) => {
        const row = (
          <Link
            key={it.apparelId}
            href={`/cards/snkrdunk/${it.apparelId}`}
            className="shop-card"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            {/* 썸네일 — +50% 확대 (2026-08-09, 기본 52 → 78). 클린 계열은 .sh-icon 이 보더 없이 라운드 처리. */}
            <CardThumb
              className="sh-icon"
              style={{ width: 78, height: 78, background: 'var(--pap2)', color: 'var(--white)', overflow: 'hidden' }}
              src={it.imageUrl}
              alt={it.name}
              emojiSize={30}
            />
            <div className="sh-main">
              {(() => {
                const jp = shortenName(it.name);
                const ko = shortenName(translateKnownCardNameToKo(it.name));
                const showJp = jp && jp !== ko;
                return (
                  <>
                    <div
                      className="sh-title"
                      style={{ fontFamily: 'var(--f1)', fontSize: 12, letterSpacing: 0.3, lineHeight: 1.4 }}
                    >
                      {ko}
                    </div>
                    {showJp ? (
                      <div
                        style={{
                          fontFamily: 'var(--f1)',
                          fontSize: 9,
                          color: 'var(--ink3)',
                          letterSpacing: 0.2,
                          lineHeight: 1.4,
                          marginTop: 3,
                        }}
                      >
                        {jp}
                      </div>
                    ) : null}
                  </>
                );
              })()}
              <div
                className="sh-desc"
                style={{
                  fontFamily: 'var(--f1)',
                  fontSize: autoPriceSize(it.priceText || '—', 12, 8),
                  color: 'var(--red)',
                  marginTop: 6,
                  letterSpacing: 0.3,
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}
              >
                {it.priceText || '—'}
              </div>
            </div>
          </Link>
        );
        // 6개마다 광고 행 끼움. slotIndex 0,1,2…
        return (i + 1) % 6 === 0
          ? [row, <ListAdRow key={`ad-${i}`} slotIndex={Math.floor(i / 6)} />]
          : [row];
      })}

      <div
        ref={sentinelRef}
        style={{
          padding: '24px 0',
          textAlign: 'center',
          fontFamily: 'var(--f1)',
          fontSize: 10,
          color: 'var(--ink3)',
          letterSpacing: 0.3,
        }}
      >
        {error ? (
          <span style={{ color: 'var(--red)' }}>
            불러오기 오류: {error}
            <button
              onClick={() => loadPage(page + 1)}
              style={{
                marginLeft: 10,
                fontFamily: 'var(--f1)',
                fontSize: 10,
                padding: '4px 10px',
                background: 'var(--ink)',
                color: 'var(--white)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              재시도
            </button>
          </span>
        ) : done ? (
          items.length === 0 ? '결과가 없습니다.' : '— 끝 —'
        ) : loading ? (
          '불러오는 중…'
        ) : (
          '아래로 스크롤'
        )}
      </div>
    </div>
  );
}
