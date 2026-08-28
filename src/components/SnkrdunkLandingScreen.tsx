'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CardThumb } from '@/components/CardThumb';
import { Price } from '@/components/Price';
import { PIXEL_BORDER } from '@/components/pixelBorder';
import { AppBar } from '@/components/ui/AppBar';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatusBar } from '@/components/ui/StatusBar';
import { SnkrdunkSearchBar } from '@/components/SnkrdunkSearchBar';
import { shortenName as shortenNameShared } from '../../shared/util/shortenName';
import { autoPriceSize } from '../../shared/util/autoPriceSize';
import { SNKRDUNK_GAME_KEYWORD } from '../../shared/gameKeyword';
import { downsamplePricePoints } from '@/lib/snkrdunk';
import { translateKnownCardNameToKo } from '@/lib/cardTranslate';
import { loadHomeHotRows } from '@/lib/homeHotCache';
import type { SnkrdunkRow } from '@/lib/snkrdunkRow';

/**
 * /cards/snkrdunk — 스니덩크 시세 랜딩 (클라이언트).
 * 목록은 홈 HOT 캐러셀에 노출된 목록(homeHotCache)을 그대로 재사용해 같은 항목·순서로
 * 즉시 뜬다(재조회 없음 → 진입 속도 개선). 홈을 안 거쳐 캐시가 없으면 브라우즈 상단
 * 10종으로 폴백. 스파크라인 차트는 행 렌더 후 점진 로드. 앱 snkrdunk/index.tsx 페어.
 */

const CATEGORY_BG: Record<string, string> = {
  SAR: 'var(--orn)',
  프로모: 'var(--pur)',
  SR: 'var(--red)',
  원피스: 'var(--grn-dk)',
};

function inferCategory(name: string): SnkrdunkRow['category'] {
  if (/プロモ|PROMO/i.test(name)) return '프로모';
  if (/\bSAR\b/.test(name)) return 'SAR';
  if (/\bSR\b/.test(name)) return 'SR';
  return null;
}


function Sparkline({
  points,
  width = 140,
  height = 36,
}: {
  points: Array<[number, number]>;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div
        style={{
          width,
          height,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--f1)',
          fontSize: 8,
          color: 'var(--ink3)',
          background: 'var(--pap2)',
          letterSpacing: 0.3,
        }}
      >
        이력 부족
      </div>
    );
  }
  const ys = points.map((p) => p[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const yOf = (v: number) => height - ((v - min) / range) * height;
  const d = ys
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${yOf(v).toFixed(1)}`)
    .join(' ');
  const trendUp = ys[ys.length - 1] >= ys[0];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ display: 'block', background: 'var(--pap2)' }}
      aria-label="시세 차트"
    >
      <path
        d={d}
        fill="none"
        stroke={trendUp ? 'var(--red)' : 'var(--blu)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(points.length - 1) * stepX}
        cy={yOf(ys[ys.length - 1])}
        r="2.2"
        fill={trendUp ? 'var(--red)' : 'var(--blu)'}
      />
    </svg>
  );
}

export function SnkrdunkLandingScreen() {
  const [rows, setRows] = useState<SnkrdunkRow[] | null>(null);
  const [charts, setCharts] = useState<Record<number, Array<[number, number]>>>({});
  // 홈에서 선택한 게임(IP) — ?game= 으로 넘어온다. 전체보기 링크에도 그대로 실어 보낸다.
  const [game, setGame] = useState<string>('pokemon');

  useEffect(() => {
    let alive = true;
    const urlGame = new URLSearchParams(window.location.search).get('game') ?? 'pokemon';
    setGame(urlGame);
    // 홈 HOT 캐시는 같은 게임일 때만 재사용 — 다른 게임 요청이면 그 게임 목록을 새로 조회.
    const cached = loadHomeHotRows();
    if (cached && cached.game === urlGame) {
      setRows(cached.rows);
      return () => { alive = false; };
    }
    (async () => {
      const kw = SNKRDUNK_GAME_KEYWORD[urlGame];
      const url = kw ? `/api/snkrdunk/search?q=${encodeURIComponent(kw)}` : '/api/snkrdunk/browse?page=1';
      const j = await fetch(url)
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{
                results?: Array<{ apparelId: number; name: string; imageUrl: string | null; priceText: string }>;
              }>)
            : null,
        )
        .catch(() => null);
      if (!alive) return;
      const base: SnkrdunkRow[] = (j?.results ?? []).slice(0, 10).map((r) => ({
        apparelId: r.apparelId,
        shortName: shortenNameShared(translateKnownCardNameToKo(r.name) || r.name, 28),
        localizedName: shortenNameShared(r.name, 28),
        category: inferCategory(r.name),
        imageUrl: r.imageUrl,
        minPrice: Number((r.priceText ?? '').replace(/[^\d]/g, '')) || 0,
        listingCountText: '',
      }));
      setRows(base);
    })();
    return () => { alive = false; };
  }, []);

  // 스파크라인 차트 — 목록이 뜬 뒤 점진 로드 (진입을 막지 않음).
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    let alive = true;
    rows.forEach(async (row) => {
      const j = await fetch(`/api/snkrdunk/apparels/${row.apparelId}/sales-chart`)
        .then((r) => (r.ok ? (r.json() as Promise<{ data?: { points?: Array<[number, number]> } }>) : null))
        .catch(() => null);
      const pts = j?.data?.points;
      if (alive && pts) setCharts((p) => ({ ...p, [row.apparelId]: pts }));
    });
    return () => { alive = false; };
  }, [rows]);

  return (
    <>
      <StatusBar />
      <AppBar title="스니덩크 시세" showBack backHref="/" />

      <div style={{ height: 14 }} />

      <SnkrdunkSearchBar />

      <div className="sect">
        <SectionTitle
          title="HOT 카드"
          right={
            <Link
              href={`/cards/snkrdunk/all${game !== 'pokemon' ? `?game=${game}` : ''}`}
              className="more"
              style={{ textDecoration: 'none' }}
            >
              전체보기 →
            </Link>
          }
        />
        {rows === null ? (
          <div
            style={{
              padding: '40px 0',
              textAlign: 'center',
              fontFamily: 'var(--f1)',
              fontSize: 10,
              color: 'var(--ink3)',
            }}
          >
            불러오는 중…
          </div>
        ) : (
          rows.map((row) => {
            const bg = row.category ? CATEGORY_BG[row.category] ?? 'var(--ink2)' : 'var(--ink2)';
            // 대표 시세(시세상세 헤드라인, 홈 캐시가 보유) 우선, 없으면 최저 매물 호가.
            const priceJpy = row.recentPrice && row.recentPrice > 0 ? row.recentPrice : row.minPrice;
            const priceLabel = row.recentPrice && row.recentPrice > 0 ? (row.basis ?? '최근') : '최저';
            const listingText = row.listingCountText ? `매물 ${row.listingCountText}건` : null;
            const pts = charts[row.apparelId];
            const sparkPoints = pts ? downsamplePricePoints([...pts].sort((a, b) => a[0] - b[0])).slice(-30) : [];

            return (
              <Link
                key={row.apparelId}
                href={`/cards/snkrdunk/${row.apparelId}`}
                className="shop-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {/* 썸네일 — +50% 확대 (2026-08-09). 클린 계열은 .sh-icon 이 보더 없이 라운드 처리. */}
                <CardThumb
                  className="sh-icon"
                  style={{
                    width: 132,
                    height: 186,
                    background: bg,
                    color: 'var(--white)',
                    overflow: 'hidden',
                    alignSelf: 'stretch',
                  }}
                  src={row.imageUrl}
                  alt={row.shortName}
                />
                <div className="sh-main">
                  <div className="sh-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {row.category && (
                      <span
                        style={{
                          fontFamily: 'var(--f1)',
                          fontSize: 9,
                          padding: '2px 5px',
                          background: bg,
                          color: 'var(--white)',
                          letterSpacing: 0.5,
                          boxShadow: PIXEL_BORDER,
                        }}
                      >
                        {row.category}
                      </span>
                    )}
                    {row.shortName}
                  </div>
                  {row.localizedName && row.localizedName !== row.shortName ? (
                    <div
                      style={{
                        fontFamily: 'var(--f1)',
                        fontSize: 9,
                        color: 'var(--ink3)',
                        letterSpacing: 0.2,
                        lineHeight: 1.4,
                        marginTop: 4,
                      }}
                    >
                      {shortenNameShared(row.localizedName, 28)}
                    </div>
                  ) : null}
                  <div
                    className="sh-desc"
                    style={{
                      fontFamily: 'var(--f1)',
                      fontSize: autoPriceSize(
                        priceJpy > 0 ? `최저 ¥${priceJpy.toLocaleString('ja-JP')}` : '최저 —',
                        11,
                        7,
                      ),
                      color: 'var(--ink)',
                      marginTop: 6,
                      letterSpacing: 0.3,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {priceLabel} <Price jpy={priceJpy} empty="—" />
                  </div>
                  {listingText ? (
                    <div
                      style={{
                        fontFamily: 'var(--f1)',
                        fontSize: 9,
                        color: 'var(--ink3)',
                        marginTop: 4,
                      }}
                    >
                      {listingText}
                    </div>
                  ) : null}
                  <div style={{ marginTop: 8 }}>
                    <Sparkline points={sparkPoints} width={140} height={36} />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div style={{ height: 80 }} />
    </>
  );
}
