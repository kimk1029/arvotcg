'use client';

/**
 * 내 자산 ↔ 관심카드 탭 — 커뮤니티(커뮤니티↔Shop)와 같은 타이틀 스왑 전환.
 * 관심카드는 탭을 처음 열 때 조회하고, 카드별 하루 등락(전일 대비)을 함께 보여준다.
 * 모바일 mobile/app/my/portfolio.tsx 와 페어.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrency } from '@/components/CurrencyProvider';
import { PortfolioScreen } from '@/components/screens/PortfolioScreen';
import { TitleSwapTabs } from '@/components/ui/TitleSwapTabs';
import type { MyFavoriteRow } from '@/lib/queries';

type Mode = 'assets' | 'favorites';

export function AssetsTabs() {
  const [mode, setMode] = useState<Mode>('assets');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px 12px' }}>
        <TitleSwapTabs
          left={{ id: 'assets', label: '내 자산' }}
          right={{ id: 'favorites', label: '관심카드' }}
          value={mode}
          onChange={setMode}
          ink="var(--ink)"
          dim="var(--ink3)"
        />
        <div style={{ flex: 1 }} />
        <Link href="/my" aria-label="마이페이지" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textDecoration: 'none' }}>
          마이 ›
        </Link>
      </div>

      {mode === 'assets' ? <PortfolioScreen /> : <FavoritesPanel />}
    </>
  );
}

function FavoritesPanel() {
  const { format } = useCurrency();
  const [rows, setRows] = useState<MyFavoriteRow[] | null>(null);

  useEffect(() => {
    fetch('/api/me/favorites/with-prices', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: MyFavoriteRow[] } | null) => setRows(j?.data ?? []))
      .catch(() => setRows([]));
  }, []);

  if (rows === null) {
    return <div style={{ padding: 50, textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>불러오는 중…</div>;
  }
  if (rows.length === 0) {
    return (
      <div style={{ margin: '20px var(--gap)', padding: 30, textAlign: 'center', background: 'var(--white)', borderRadius: 14, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.8 }}>
        관심카드가 없어요
        <br />
        시세상세 페이지에서 ⭐ 관심카드 버튼을 눌러보세요.
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + r.minPriceJpy, 0);

  return (
    <div style={{ margin: '0 var(--gap) 30px' }}>
      <div style={{ fontSize: 12, color: 'var(--ink3)', margin: '2px 0 10px' }}>
        {rows.length}개 · 합산 시세 <b style={{ color: 'var(--ink)' }}>{format(total)}</b>
        <span style={{ marginLeft: 6 }}>· 자산 합계엔 포함되지 않아요</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => (
          <FavoriteRow key={r.id} row={r} />
        ))}
      </div>
    </div>
  );
}

/** 관심카드 1행 — 썸네일·이름·시세 + 하루 등락(전일 대비). */
function FavoriteRow({ row }: { row: MyFavoriteRow }) {
  const { format } = useCurrency();
  const pct = row.changePct;
  const up = (pct ?? 0) >= 0;
  return (
    <Link
      href={`/cards/snkrdunk/${row.snkrdunkApparelId}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit',
        background: 'var(--white)', borderRadius: 14, padding: '10px 12px',
      }}
    >
      <div style={{ width: 44, height: 60, flex: 'none', borderRadius: 7, overflow: 'hidden', background: 'var(--pap2)' }}>
        {row.imageUrl ? (
          // 외부 CDN 이미지 — next/image 도메인 설정 없이 쓰기 위해 img 사용.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
      </div>
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
  );
}
