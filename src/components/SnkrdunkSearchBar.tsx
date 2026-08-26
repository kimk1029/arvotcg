'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface SearchResult {
  apparelId: number;
  name: string;
  imageUrl: string | null;
  priceText: string;
}

export function SnkrdunkSearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 열릴 때 input 자동 focus
  useEffect(() => {
    if (open && inputRef.current) {
      // transition 끝나기 직전에 focus 하면 자연스러움
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSubmitted(false);
      return;
    }
    setLoading(true);
    setSubmitted(true);
    try {
      const res = await fetch(`/api/snkrdunk/search?q=${encodeURIComponent(trimmed)}`);
      const data = (await res.json()) as { results: SearchResult[] };
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function onClear() {
    setQuery('');
    setResults([]);
    setSubmitted(false);
    inputRef.current?.focus();
  }

  return (
    <div style={{ margin: '0 var(--gap) var(--cg)' }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        style={{
          position: 'relative',
          height: 44,
          width: '100%',
        }}
      >
        {/* Input — right edge에서 좌측으로 펼쳐짐 */}
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="일본어로 검색 (예: リザードン)"
          aria-label="스니덩크 검색"
          style={{
            position: 'absolute',
            right: 44,
            top: 0,
            height: 44,
            width: open ? 'calc(100% - 44px)' : 0,
            padding: open ? '0 12px' : 0,
            border: 'none',
            outline: 'none',
            background: 'var(--white)',
            // 인풋은 디스플레이(--f1) 가 아니라 본문 폰트(--f2) — 클린에선 Pretendard.
            fontFamily: 'var(--f2)',
            fontSize: 11,
            color: 'var(--ink)',
            // 자간은 테마 CSS 에 맡긴다 — 클린은 globals.css 의 letter-spacing:normal 적용.
            // 픽셀 폰트 폭이 넓어도 placeholder 는 항상 한 줄(줄바꿈→세로 두꺼워짐 방지).
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            transition: 'width 220ms ease, padding 220ms ease',
            boxShadow: open
              ? '-2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),inset 2px 2px 0 rgba(0,0,0,.1)'
              : 'none',
          }}
          tabIndex={open ? 0 : -1}
        />

        {/* Clear (입력값 있고 열린 상태) */}
        {open && query && (
          <button
            type="button"
            onClick={onClear}
            aria-label="검색어 지우기"
            style={{
              position: 'absolute',
              right: 50,
              top: 8,
              width: 28,
              height: 28,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--f1)',
              fontSize: 11,
              color: 'var(--ink3)',
            }}
          >
            ✕
          </button>
        )}

        {/* Toggle / Submit icon */}
        <button
          type={open ? 'submit' : 'button'}
          onClick={() => {
            if (!open) setOpen(true);
            else if (!query) setOpen(false);
            // open && query 인 경우는 type=submit 동작에 맡김
          }}
          aria-label={open ? '검색' : '검색 열기'}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 44,
            height: 44,
            border: 'none',
            background: 'var(--ink)',
            color: 'var(--gold)',
            cursor: 'pointer',
            fontFamily: 'var(--f1)',
            fontSize: 15,
            letterSpacing: 0,
            boxShadow:
              '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--yel-dk)',
          }}
        >
          🔍
        </button>
      </form>

      {/* 결과 영역 */}
      {open && submitted && (
        <div style={{ marginTop: 14 }}>
          {loading ? (
            <div
              style={{
                padding: '20px 0',
                fontFamily: 'var(--f1)',
                fontSize: 10,
                color: 'var(--ink3)',
                textAlign: 'center',
                letterSpacing: 0.3,
              }}
            >
              검색 중...
            </div>
          ) : results.length === 0 ? (
            <div
              style={{
                padding: '20px 0',
                fontFamily: 'var(--f1)',
                fontSize: 10,
                color: 'var(--ink3)',
                textAlign: 'center',
                letterSpacing: 0.3,
              }}
            >
              검색 결과가 없습니다
            </div>
          ) : (
            <>
              <div
                style={{
                  fontFamily: 'var(--f1)',
                  fontSize: 10,
                  color: 'var(--ink3)',
                  letterSpacing: 0.3,
                  marginBottom: 8,
                }}
              >
                검색 결과 {results.length}건
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.map((r) => (
                  <Link
                    key={r.apparelId}
                    href={`/cards/snkrdunk/${r.apparelId}`}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: 10,
                      background: 'var(--white)',
                      textDecoration: 'none',
                      color: 'inherit',
                      alignItems: 'center',
                      boxShadow:
                        '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),inset 0 2px 0 rgba(255,255,255,.7),4px 4px 0 var(--ink)',
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        flexShrink: 0,
                        background: 'var(--pap2)',
                        overflow: 'hidden',
                        boxShadow: '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink)',
                      }}
                    >
                      {r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.imageUrl}
                          alt={r.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--f1)',
                          fontSize: 10,
                          letterSpacing: 0.2,
                          color: 'var(--ink)',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {r.name}
                      </div>
                      {r.priceText && (
                        <div
                          style={{
                            fontFamily: 'var(--f1)',
                            fontSize: 11,
                            color: 'var(--red)',
                            letterSpacing: 0.3,
                            marginTop: 4,
                          }}
                        >
                          {r.priceText}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
