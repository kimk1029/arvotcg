'use client';

/**
 * 관심카드 — 내 자산(컬렉션) '관심카드' 탭과 /my/favorites 가 함께 쓰는 단일 화면.
 *
 * 두 진입점이 서로 다른 화면을 보여주던 것을 하나로 합쳤다. 기본은 리스트형
 * (컬렉션 탭에서 쓰던 행 — 이름·시세·전일 등락), 우측 상단 아이콘으로 바둑판(그리드)
 * 전환. 앱 mobile/src/components/FavoritesView 와 페어.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrency } from '@/components/CurrencyProvider';
import { CardThumb } from '@/components/CardThumb';
import { PackGridCard } from '@/components/PackGridCard';
import type { MyFavoriteRow } from '@/lib/queries';

type View = 'list' | 'grid';

/** 보기 모드는 화면을 옮겨다녀도 유지 — 컬렉션 탭 ↔ /my/favorites 가 같은 값을 쓴다. */
const VIEW_KEY = 'pf30:favView';

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

export function FavoritesView({ initial }: { initial?: MyFavoriteRow[] }) {
  const { format } = useCurrency();
  const [rows, setRows] = useState<MyFavoriteRow[] | null>(initial ?? null);
  const [view, setView] = useState<View>('list');
  const [busy, setBusy] = useState(false);

  // localStorage 는 서버 렌더 결과와 달라질 수 있어 마운트 후에만 반영(하이드레이션 안전).
  useEffect(() => setView(loadView()), []);

  useEffect(() => {
    let alive = true;
    fetch('/api/me/favorites/with-prices', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: MyFavoriteRow[] } | null) => alive && setRows(j?.data ?? []))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // 저장 실패는 무시 — 이번 세션만 적용된다.
    }
  };

  const remove = async (apparelId: number) => {
    if (busy) return;
    if (typeof window !== 'undefined' && !window.confirm('관심카드에서 제거할까요?')) return;
    setBusy(true);
    // 낙관적 제거 — 실패하면 되돌린다.
    const prev = rows ?? [];
    setRows(prev.filter((r) => r.snkrdunkApparelId !== apparelId));
    try {
      const res = await fetch(`/api/me/favorites/${apparelId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setRows(prev);
    } finally {
      setBusy(false);
    }
  };

  if (rows === null) {
    return <div style={{ padding: 50, textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>불러오는 중…</div>;
  }
  if (rows.length === 0) {
    return (
      <div style={{ margin: '16px var(--gap) 40px', padding: 30, textAlign: 'center', background: 'var(--white)', borderRadius: 14, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.8 }}>
        관심카드가 없어요
        <br />
        시세상세 페이지에서 ⭐ 관심카드 버튼을 눌러보세요.
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + r.minPriceJpy, 0);

  return (
    <div style={{ margin: '0 var(--gap) 40px' }}>
      {/* 요약 + 보기 전환 (우측 상단) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 10px' }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--ink3)' }}>
          {rows.length}개 · 합산 시세 <b style={{ color: 'var(--ink)' }}>{format(total)}</b>
          <span style={{ marginLeft: 6 }}>· 자산 합계엔 포함되지 않아요</span>
        </div>
        <div style={{ flex: 'none', display: 'flex', gap: 4, background: 'var(--pap2)', borderRadius: 'var(--r-sm)', padding: 3 }}>
          {(['list', 'grid'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => changeView(v)}
              aria-label={v === 'grid' ? '바둑판 보기' : '리스트 보기'}
              aria-pressed={view === v}
              style={{
                width: 30, height: 26, borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                display: 'grid', placeItems: 'center', background: view === v ? 'var(--white)' : 'transparent',
              }}
            >
              {v === 'grid' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={view === v ? 'var(--ink)' : 'var(--ink3)'} strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={view === v ? 'var(--ink)' : 'var(--ink3)'} strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {rows.map((r) => (
            <PackGridCard
              key={r.id}
              href={`/cards/snkrdunk/${r.snkrdunkApparelId}`}
              style={{ borderTop: '4px solid var(--pur)' }}
              image={r.imageUrl}
              title={r.name ?? '(이름 없음)'}
              priceJpy={r.minPriceJpy}
              fitPrice={false}
              titleSize={10}
              titleGap={4}
              bodyPadding="7px 8px 4px"
              actions={
                <button
                  type="button"
                  onClick={() => remove(r.snkrdunkApparelId)}
                  style={{
                    width: '100%', padding: '6px 0', background: 'var(--white)', color: 'var(--red)',
                    fontFamily: 'var(--f1)', fontSize: 9, letterSpacing: 0.3, border: 0,
                    borderTop: '3px solid var(--ink)', cursor: 'pointer',
                  }}
                >
                  ✕ 제거
                </button>
              }
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => (
            <FavoriteRow key={r.id} row={r} onRemove={() => remove(r.snkrdunkApparelId)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 관심카드 1행 — 썸네일·이름·시세 + 하루 등락(전일 대비) + 제거. */
function FavoriteRow({ row, onRemove }: { row: MyFavoriteRow; onRemove: () => void }) {
  const { format } = useCurrency();
  const pct = row.changePct;
  const up = (pct ?? 0) >= 0;
  return (
    <div style={{ position: 'relative', background: 'var(--white)', borderRadius: 14 }}>
      <Link
        href={`/cards/snkrdunk/${row.snkrdunkApparelId}`}
        style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', padding: '10px 34px 10px 12px' }}
      >
        <CardThumb
          style={{ width: 44, height: 60, flex: 'none', borderRadius: 7, overflow: 'hidden', background: 'var(--pap2)' }}
          src={row.imageUrl}
          alt={row.name ?? ''}
          emojiSize={20}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name ?? '(이름 없음)'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>
            {new Date(row.createdAt).toLocaleDateString('ko-KR')} 추가
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {row.minPriceJpy > 0 ? format(row.minPriceJpy) : '시세 없음'}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, marginTop: 3, color: pct == null ? 'var(--ink3)' : up ? 'var(--red)' : 'var(--blu)' }}>
            {pct == null ? '등락 —' : `${up ? '+' : ''}${pct.toFixed(1)}% ${up ? '▲' : '▼'}`}
          </div>
        </div>
      </Link>
      {/* Link 바깥 형제 — 카드 전체가 링크라 안쪽 버튼은 이동을 막지 못한다. */}
      <button
        type="button"
        onClick={onRemove}
        aria-label="관심카드에서 제거"
        style={{
          position: 'absolute', top: '50%', right: 4, transform: 'translateY(-50%)',
          width: 26, height: 26, display: 'grid', placeItems: 'center',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', fontSize: 13,
        }}
      >
        ✕
      </button>
    </div>
  );
}
