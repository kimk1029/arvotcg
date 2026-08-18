'use client';

import { useState } from 'react';
import { searchByKeyword, type HydratedHit } from './actions';
import { SearchResults } from './SearchResults';

/**
 * 카드 검색 폼 + 결과 — 검색을 인플레이스(클라이언트)에서 처리한다.
 * `<form method="get">` 의 전체 페이지 네비게이션(깜빡임) 대신, 제출 시
 * 결과 자리에 스피너를 돌리다가 도착하면 그 자리에 결과를 뿌린다.
 * 직접 URL(?q=) 방문 시엔 서버가 채워준 initial 값으로 즉시 렌더(SSR 유지).
 */
export function SearchPanel({
  initialQ,
  initialJa,
  initialHits,
  initialHasMore,
}: {
  initialQ: string;
  initialJa: string;
  initialHits: HydratedHit[];
  initialHasMore: boolean;
}) {
  const [input, setInput] = useState(initialQ);
  const [q, setQ] = useState(initialQ);
  const [ja, setJa] = useState(initialJa);
  const [hits, setHits] = useState<HydratedHit[]>(initialHits);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [searching, setSearching] = useState(false);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const newQ = input.trim();
    if (!newQ || searching) return;
    setQ(newQ);
    setJa(''); // 결과 도착 시 새 번역으로 채움
    setSearching(true);
    // 네비게이션 없이 URL 만 동기화(새로고침/공유 대비) — 전체 페이지 깜빡임 방지.
    window.history.replaceState(null, '', `${window.location.pathname}?q=${encodeURIComponent(newQ)}`);
    try {
      const res = await searchByKeyword(newQ);
      setJa(res.ja);
      setHits(res.hits);
      setHasMore(res.hasMore);
      // 검색 로그(쿠키 세션이 함께 전송돼 로그인 시 userId 귀속).
      fetch('/api/search-log', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: newQ, resultCount: res.hits.length, source: 'web' }),
      }).catch(() => {});
    } catch {
      setJa('');
      setHits([]);
      setHasMore(false);
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      {/* 검색 폼 */}
      <form onSubmit={runSearch} className="ko-search-box">
        <div className="ko-search-hint">한국어로 카드명 입력 → 🇯🇵 스니덩 검색</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            name="q"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예) 카드명 또는 세트코드"
            autoFocus
            className="ko-search-input"
          />
          <button type="submit" className="ko-search-submit">
            검색
          </button>
        </div>
      </form>

      {!q ? (
        <div
          style={{
            margin: '0 var(--gap)',
            padding: 24,
            fontFamily: 'var(--f1)',
            fontSize: 10,
            color: 'var(--ink3)',
            textAlign: 'center',
            lineHeight: 1.8,
          }}
        >
          한국어로 카드명을 입력해보세요.<br />
          🇯🇵 자동으로 일본어로 번역해 스니덩에서 검색합니다.
        </div>
      ) : (
        <>
          {/* 번역 결과 / 카운트 */}
          <div className="search-panel search-panel--muted">
            입력: <b style={{ color: 'var(--ink)' }}>{q}</b>
            {ja && ja !== q ? (
              <>
                <br />
                🇯🇵 JA: <b style={{ color: 'var(--red)' }}>{ja}</b>
              </>
            ) : null}
          </div>

          {searching ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '44px 0' }}>
              <span className="pf-pokeball-spinner pf-pokeball-spinner--sm" />
            </div>
          ) : (
            <SearchResults key={q} q={q} ja={ja} initialHits={hits} initialHasMore={hasMore} />
          )}
        </>
      )}
    </>
  );
}
