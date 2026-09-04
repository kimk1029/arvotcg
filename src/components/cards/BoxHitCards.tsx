'use client';

/**
 * 박스 시세상세의 '힛카드 목록' — 해당 박스에서 나오는 싱글카드를 비싼 순으로
 * 가로 스크롤(스와이프)로 나열. 홈 'HOT 카드' 캐러셀과 같은 타일이지만
 * 자동으로 흘러가지 않고 손으로만 넘긴다(요구사항).
 *
 * 데이터는 팩 카탈로그 정본(NAS `/api/card-packs/{code}`) 하나만 쓴다 —
 * 클라이언트에서 시세를 다시 계산하지 않는다. 앱 mobile/src/components/cards/BoxHitCards 와 페어.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CardThumb } from '@/components/CardThumb';
import { Price } from '@/components/Price';
import { GradeMark } from '@/components/cards/GradeMark';
import type { PackHitCard, PackWithHits } from '@/lib/cardPackHits';

/** 가로로 보여줄 최대 장수 — 비싼 순 상위만(전체는 팩 페이지에서). */
const MAX = 20;

/** 대표 시세 — 서버가 시세상세 헤드라인과 같은 규칙으로 계산해 준 값. */
function hitPrice(h: PackHitCard): number {
  return h.headlinePrice > 0 ? h.headlinePrice : h.minPrice;
}

export function BoxHitCards({ packCode, setCode }: { packCode: string; setCode?: string | null }) {
  const [hits, setHits] = useState<PackHitCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/card-packs/${encodeURIComponent(packCode)}?limit=600`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: PackWithHits } | null) => {
        if (!alive) return;
        const singles = (j?.data?.hits ?? []).filter((h) => h.itemKind === 'single');
        singles.sort((a, b) => hitPrice(b) - hitPrice(a));
        setHits(singles.slice(0, MAX));
      })
      .catch(() => alive && setHits([]));
    return () => {
      alive = false;
    };
  }, [packCode]);

  // 조회 중/없음이면 섹션 자체를 만들지 않는다 (빈 상자 방지).
  if (hits !== null && hits.length === 0) return null;

  return (
    <div className="sect">
      <div className="sect-hd">
        <h2>🔥 힛카드 목록</h2>
        <Link href={`/cards/packs/${encodeURIComponent(packCode)}`} className="more" style={{ color: 'inherit', textDecoration: 'none' }}>
          {setCode ? `${setCode.toUpperCase()} 전체 ›` : '전체 보기 ›'}
        </Link>
      </div>
      <div
        className="hrow"
        style={{
          display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none',
          padding: '2px 2px 8px', WebkitOverflowScrolling: 'touch',
        }}
      >
        {hits === null
          ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} style={{ flex: 'none', width: 100 }}>
                <div style={{ width: 100, height: 138, borderRadius: 11, background: 'var(--pap2)' }} />
              </div>
            ))
          : hits.map((h, i) => (
              <Link
                key={h.apparelId}
                href={`/cards/snkrdunk/${h.apparelId}${h.headlineBasis ? `?grade=${encodeURIComponent(h.headlineBasis)}` : ''}`}
                style={{ flex: 'none', width: 100, textDecoration: 'none', color: 'inherit' }}
              >
                <CardThumb
                  style={{ position: 'relative', width: 100, height: 138, borderRadius: 11, overflow: 'hidden', background: 'var(--pap2)' }}
                  src={h.imageUrl}
                  alt={h.koName || h.shortName}
                  emojiSize={30}
                >
                  <div
                    style={{
                      position: 'absolute', top: 6, left: 6, width: 21, height: 21, borderRadius: '50%',
                      background: rankColor(i + 1), color: '#fff', fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800,
                      display: 'grid', placeItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,.25)',
                    }}
                  >
                    {i + 1}
                  </div>
                  {/* 대표가가 PSA10 기준이면 우하단 표식 — 목록 어디서나 같은 규칙. */}
                  {h.headlineBasis === 'PSA 10' && <GradeMark company="PSA" grade="10" height={9} />}
                </CardThumb>
                <div
                  style={{
                    fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginTop: 8,
                    lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {h.shortName || h.koName}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--f1)', fontSize: 12.5, fontWeight: 900, color: 'var(--ink)', marginTop: 3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  <Price jpy={hitPrice(h)} empty="—" />
                </div>
              </Link>
            ))}
      </div>
    </div>
  );
}

/** 순위 배지색 — 홈 HOT 카드와 같은 금/은/동. */
function rankColor(rank: number): string {
  if (rank === 1) return 'var(--gold)';
  if (rank === 2) return '#9AA0A6';
  if (rank === 3) return '#C8732B';
  return 'var(--ink)';
}
