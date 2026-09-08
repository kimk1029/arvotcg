'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';
import { CardThumb } from '@/components/CardThumb';
import { ListAdRow } from '@/components/ListAdRow';
import { PackGridCard } from '@/components/PackGridCard';
import type { BunjangItem } from '@/lib/bunjang';
import { kreamSearchUrl, type KreamItem } from '@/lib/kream';
import { searchSnkrdunkPage, type HydratedHit } from './actions';

const ACCENT = '#1B2E89';

type Category = 'snkrdunk' | 'bunjang' | 'kream';

export function SearchResults({
  q,
  ja,
  initialHits,
  initialHasMore,
}: {
  /** 원본 한국어 검색어 — 번개장터(국내) 검색에 사용. */
  q: string;
  /** 일본어 변환 검색어 — SNKRDUNK 검색에 사용. */
  ja: string;
  initialHits: HydratedHit[];
  initialHasMore: boolean;
}) {
  const [cat, setCat] = useState<Category>('snkrdunk');

  // SNKRDUNK (무한스크롤)
  const [hits, setHits] = useState<HydratedHit[]>(initialHits);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 번개장터 (한국어 원본 검색, 탭 진입 시 지연 로딩)
  const [bj, setBj] = useState<BunjangItem[]>([]);
  const [bjLoading, setBjLoading] = useState(false);
  const [bjLoaded, setBjLoaded] = useState(false);

  // KREAM (한국어 원본 검색, SSR 스크래핑, 탭 진입 시 지연 로딩)
  const [kr, setKr] = useState<KreamItem[]>([]);
  const [krLoading, setKrLoading] = useState(false);
  const [krLoaded, setKrLoaded] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const next = page + 1;
      const { hits: more, hasMore: hm } = await searchSnkrdunkPage(ja, next);
      const seen = new Set(hits.map((h) => h.apparelId));
      const fresh = more.filter((h) => !seen.has(h.apparelId));
      if (fresh.length > 0) setHits((prev) => [...prev, ...fresh]);
      setPage(next);
      setHasMore(hm && fresh.length > 0);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, hits, ja]);

  // 무한스크롤 — SNKRDUNK 탭에서 바닥 센티넬이 보이면 다음 페이지 로딩.
  useEffect(() => {
    if (cat !== 'snkrdunk' || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cat, hasMore, loadMore]);

  // 번개장터 — 검색 시 즉시 로딩(다른 탭에 있어도 탭에 건수가 뜨도록).
  // 주의: loading 상태를 deps 에 넣지 말 것 — setLoading 으로 effect 가 재실행되며
  // cleanup 이 진행 중 fetch 를 취소해 무한 로딩이 됐던 버그.
  useEffect(() => {
    if (!q) {
      setBj([]);
      setBjLoaded(false);
      return;
    }
    let alive = true;
    setBj([]);
    setBjLoaded(false);
    setBjLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/bunjang/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { items?: BunjangItem[] };
        if (alive) setBj(data.items ?? []);
      } catch {
        if (alive) setBj([]);
      } finally {
        if (alive) {
          setBjLoaded(true);
          setBjLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [q]);

  // 쿼리 변경 시 KREAM 캐시 리셋(탭 다시 열면 새 쿼리로 로딩).
  useEffect(() => {
    setKr([]);
    setKrLoaded(false);
  }, [q]);

  // KREAM — 탭을 열 때만 1회 로딩 (안티봇이 IP를 막아, 매 검색마다 호출하면 대부분 차단됨).
  // 차단/실패 시 빈 배열 → 이동 버튼 폴백. 진행 중 판정은 state 가 아니라 ref(질의별) — 로딩 중
  // 질의가 바뀌면 이전 요청은 버리고 새 질의를 바로 받는다(예전엔 loading 이 true 로 남아 스피너가 영영 돌았음).
  const krReq = useRef<string | null>(null);
  useEffect(() => {
    if (cat !== 'kream' || !q || krLoaded || krReq.current === q) return;
    let alive = true;
    krReq.current = q;
    setKrLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/kream/search?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(15_000) });
        const data = (await res.json()) as { items?: KreamItem[] };
        if (alive) setKr(data.items ?? []);
      } catch {
        if (alive) setKr([]);
      } finally {
        if (alive) {
          setKrLoaded(true);
          setKrLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      krReq.current = null;
    };
  }, [cat, q, krLoaded]);

  return (
    <div className="sect">
      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <TabButton
          label="SNKRDUNK"
          sub={hits.length > 0 ? `${hits.length}건${hasMore ? '+' : ''}` : '시세'}
          active={cat === 'snkrdunk'}
          onClick={() => setCat('snkrdunk')}
        />
        <TabButton
          label="번개장터"
          sub={bjLoaded ? `${bj.length}건` : '국내매물'}
          loading={bjLoading}
          active={cat === 'bunjang'}
          onClick={() => setCat('bunjang')}
        />
        <TabButton
          label="KREAM"
          sub={krLoaded ? `${kr.length}건` : 'KREAM'}
          loading={krLoading}
          active={cat === 'kream'}
          onClick={() => setCat('kream')}
        />
      </div>

      {cat === 'snkrdunk' ? (
        hits.length === 0 ? (
          <EmptyBox text="SNKRDUNK 결과가 없습니다" />
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              {hits.flatMap((hit, i) => {
                const card = <SearchHitCard key={hit.apparelId} hit={hit} />;
                // 6장(=2행)마다 그리드 한 행 전체를 차지하는 광고 배너 끼움.
                return (i + 1) % 6 === 0
                  ? [card, <ListAdRow key={`ad-${i}`} slotIndex={Math.floor(i / 6)} spanGrid />]
                  : [card];
              })}
            </div>
            {hasMore ? <div ref={sentinelRef} style={{ height: 1 }} /> : null}
            {loading ? <Loading /> : <StatusNote text={hasMore ? '' : `SNKRDUNK ${hits.length}건 · 끝`} />}
          </>
        )
      ) : cat === 'bunjang' ? (
        bjLoading ? (
          <Loading />
        ) : bj.length === 0 ? (
          <EmptyBox text="번개장터 결과가 없습니다" />
        ) : (
          <>
            {bj.map((item) => (
              <BunjangCard key={item.pid} item={item} />
            ))}
            <StatusNote text={`번개장터 ${bj.length}건`} />
          </>
        )
      ) : (
        <KreamPanel q={q} items={kr} loading={krLoading} />
      )}
    </div>
  );
}

function TabButton({
  label,
  sub,
  active,
  loading,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  const { theme } = useTheme();
  const isClean = isFlatTheme(theme);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 0',
        border: isClean ? `1px solid ${active ? 'transparent' : 'var(--pap3)'}` : 'none',
        cursor: 'pointer',
        textAlign: 'center',
        background: active ? (isClean ? 'var(--accent)' : 'var(--ink)') : 'var(--white)',
        color: active ? (isClean ? 'var(--white)' : 'var(--gold)') : (isClean ? 'var(--ink2)' : 'var(--ink)'),
        fontFamily: 'var(--f1)',
        letterSpacing: 0.5,
        ...(isClean
          ? { borderRadius: 'var(--r-sm)', boxShadow: active ? '0 1px 3px rgba(16,18,22,.12)' : 'none' }
          : {
              boxShadow: active
                ? '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),inset 0 2px 0 var(--ink2),5px 5px 0 var(--gold-dk)'
                : '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),4px 4px 0 var(--ink)',
            }),
      }}
    >
      <div style={{ fontSize: 11 }}>{label}</div>
      <div
        style={{
          fontSize: 8,
          marginTop: 3,
          opacity: 0.85,
          minHeight: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {loading ? (
          <>
            <span className="pf-pokeball-spinner pf-pokeball-spinner--xs" />
            검색중
          </>
        ) : (
          sub
        )}
      </div>
    </button>
  );
}

function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
      <span className="pf-pokeball-spinner pf-pokeball-spinner--sm" />
    </div>
  );
}

function StatusNote({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 14,
        textAlign: 'center',
        fontFamily: 'var(--f1)',
        fontSize: 10,
        letterSpacing: 0.5,
        color: 'var(--ink3)',
      }}
    >
      {text}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  const { theme } = useTheme();
  const isClean = isFlatTheme(theme);
  return (
    <div
      style={{
        padding: 30,
        textAlign: 'center',
        background: 'var(--white)',
        fontFamily: 'var(--f1)',
        fontSize: 10,
        color: 'var(--ink3)',
        ...(isClean
          ? { border: '1px solid var(--pap3)', borderRadius: 'var(--r)', boxShadow: '0 1px 2px rgba(24,34,58,.04),0 10px 24px rgba(24,34,58,.06)' }
          : { boxShadow: '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),5px 5px 0 var(--ink)' }),
      }}
    >
      {text}
    </div>
  );
}

function KreamPanel({ q, items, loading }: { q: string; items: KreamItem[]; loading: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {loading ? (
        <Loading />
      ) : items.length > 0 ? (
        items.map((item) => <KreamCard key={item.id} item={item} />)
      ) : (
        <div
          style={{
            padding: 16,
            background: 'var(--white)',
            fontFamily: 'var(--f1)',
            fontSize: 10,
            color: 'var(--ink3)',
            lineHeight: 1.8,
            boxShadow:
              '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),5px 5px 0 var(--ink)',
          }}
        >
          KREAM 결과를 불러오지 못했습니다. 아래에서 KREAM 검색을 직접 열 수 있어요.
        </div>
      )}
      {/* KREAM은 차단에 취약해 결과가 비어도 항상 이동 버튼 제공 */}
      <a
        href={kreamSearchUrl(q)}
        target="_blank"
        rel="noreferrer noopener"
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '13px 0',
          marginTop: 4,
          background: 'var(--ink)',
          color: 'var(--gold)',
          textDecoration: 'none',
          fontFamily: 'var(--f1)',
          fontSize: 11,
          letterSpacing: 0.5,
          boxShadow:
            '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),5px 5px 0 var(--gold-dk)',
        }}
      >
        KREAM에서 “{q}” 검색 →
      </a>
    </div>
  );
}

function KreamCard({ item }: { item: KreamItem }) {
  return (
    <a
      href={item.productUrl}
      target="_blank"
      rel="noreferrer noopener"
      className="shop-card"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <CardThumb
        className="sh-icon"
        style={{ width: 84, height: 84, background: 'var(--ink2)', overflow: 'hidden', alignSelf: 'stretch' }}
        src={item.imageUrl}
        alt={item.name}
        emojiSize={28}
      />
      <div className="sh-main">
        <div
          className="sh-title"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
          }}
        >
          {item.name}
        </div>
        <div style={{ fontFamily: 'var(--f1)', fontSize: 14, color: 'var(--red)', marginTop: 6, letterSpacing: 0.3 }}>
          {item.price > 0 ? `${item.price.toLocaleString('ko-KR')}원` : '가격문의'}
        </div>
        <div style={{ fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)', marginTop: 6 }}>KREAM</div>
      </div>
    </a>
  );
}

function BunjangCard({ item }: { item: BunjangItem }) {
  return (
    <Link
      href={`/cards/bunjang/${item.pid}`}
      className="shop-card"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <CardThumb
        className="sh-icon"
        style={{ width: 84, height: 84, background: 'var(--ink2)', overflow: 'hidden', alignSelf: 'stretch' }}
        src={item.imageUrl}
        alt={item.name}
        emoji="📦"
        emojiSize={28}
      />
      <div className="sh-main">
        <div
          className="sh-title"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
          }}
        >
          {item.ad && (
            <span style={{ fontFamily: 'var(--f1)', fontSize: 8, color: 'var(--ink3)', marginRight: 4 }}>AD</span>
          )}
          {item.name}
        </div>
        <div style={{ fontFamily: 'var(--f1)', fontSize: 14, color: 'var(--red)', marginTop: 6, letterSpacing: 0.3 }}>
          {item.price > 0 ? `${item.price.toLocaleString('ko-KR')}원` : '가격문의'}
        </div>
        <div
          style={{
            fontFamily: 'var(--f1)',
            fontSize: 9,
            color: 'var(--ink3)',
            marginTop: 6,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {item.location && <span>📍 {item.location}</span>}
          {item.favCount > 0 && <span>❤ {item.favCount}</span>}
        </div>
      </div>
    </Link>
  );
}

function SearchHitCard({ hit }: { hit: HydratedHit }) {
  const { theme } = useTheme();
  const isClean = isFlatTheme(theme);
  const koTitle = hit.koName || hit.jpName;
  const jpTitle = hit.jpName && hit.jpName !== koTitle ? hit.jpName : null;
  return (
    <PackGridCard
      href={`/cards/snkrdunk/${hit.apparelId}`}
      style={isClean ? {} : { borderTop: `4px solid ${ACCENT}` }}
      flat={isClean}
      image={hit.imageUrl}
      title={koTitle}
      subtitle={jpTitle}
      priceJpy={hit.minPrice}
      footer={hit.listingCountText ? `매물 ${hit.listingCountText}건` : '매물 없음'}
    />
  );
}
