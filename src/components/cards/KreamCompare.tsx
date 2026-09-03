'use client';

import { useEffect, useMemo, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { useCurrency } from '@/components/CurrencyProvider';
import {
  bestKreamMatch,
  kreamSearchQuery,
  pickKreamByCode,
  type KreamItemLite,
} from '../../../shared/util/kreamMatch';

/**
 * 시세 비교 — SNKRDUNK(엔화) vs KREAM(원화)를 통화 설정(엔/원)에 맞춰 나란히 보여준다.
 * KREAM 은 이름으로 검색해(스크래핑·캐시·플레이키) 후보를 받은 뒤, 카드의
 * setCode / cardNumber / rarity 힌트로 정확한 카드를 골라 즉시판매가를 비교한다.
 * 실패/매칭 없으면 "KREAM 에서 검색" 이동 버튼으로 폴백.
 */

type KreamItem = KreamItemLite; // { id, name, price(KRW), imageUrl, productUrl }

interface Props {
  /** 검색어(카드 한글명). */
  query: string;
  /** SNKRDUNK 비교 기준가 (JPY). 보통 RAW 최근 거래가. */
  snkrPriceJpy: number;
  /** 콜렉터 번호 (예: "059"). */
  cardNumber?: string | null;
  /** 세트 코드 (예: "SV2A"). */
  setCode?: string | null;
  /** 등급 토큰 (예: "SAR"). */
  rarity?: string | null;
}

export function KreamCompare({ query, snkrPriceJpy, cardNumber, setCode, rarity }: Props) {
  const { rate, mode, format } = useCurrency();
  // 비교 계산은 JPY 단일 기준 — 표시만 통화 설정(format)에 따른다. KREAM price 는 원화 원본.
  const fmt = (jpy: number) => (!jpy || jpy <= 0 ? '—' : format(jpy));
  const [state, setState] = useState<'loading' | 'done'>('loading');
  const [items, setItems] = useState<KreamItem[]>([]);
  // 코드(setCode+번호) 검색으로 받은 결과인지 — 선별 로직이 갈린다.
  const [viaCode, setViaCode] = useState(false);

  // 코드 우선 검색 → 빈결과면 카드명으로 폴백.
  const { q: searchKw, byCode } = useMemo(
    () => kreamSearchQuery({ cardNumber, setCode, rarity }, query),
    [cardNumber, setCode, rarity, query],
  );

  useEffect(() => {
    let alive = true;
    setState('loading');
    const getItems = async (kw: string): Promise<KreamItem[]> => {
      try {
        const r = await fetch(`/api/kream/search?q=${encodeURIComponent(kw)}`);
        const j = (await r.json()) as { items?: KreamItem[] };
        return j.items ?? [];
      } catch {
        return [];
      }
    };
    (async () => {
      let its = await getItems(searchKw);
      let code = byCode;
      if (byCode && its.length === 0) {
        its = await getItems(query); // 코드 검색 빈결과 → 이름 폴백
        code = false;
      }
      if (!alive) return;
      setItems(its);
      setViaCode(code);
      setState('done');
    })();
    return () => {
      alive = false;
    };
  }, [searchKw, byCode, query]);

  const item = useMemo(
    () =>
      viaCode
        ? pickKreamByCode(items, { cardNumber, setCode, rarity })
        : bestKreamMatch(items, query, { cardNumber, setCode, rarity }),
    [items, viaCode, query, cardNumber, setCode, rarity],
  );

  const searchUrl = `https://kream.co.kr/search?keyword=${encodeURIComponent(searchKw)}`;
  const snkrJpy = snkrPriceJpy > 0 ? snkrPriceJpy : 0;
  // KREAM price 는 원화 → 환율로 엔화 환산해 동일 기준으로 비교.
  const kreamJpy = item?.price && rate > 0 ? item.price / rate : 0;

  const cmp = useMemo(() => {
    if (snkrJpy <= 0 || kreamJpy <= 0) return null;
    const diff = kreamJpy - snkrJpy;
    const cheaper = diff > 0 ? 'snkr' : diff < 0 ? 'kream' : 'same';
    const pct = Math.abs(diff) / Math.min(snkrJpy, kreamJpy) * 100;
    return { diff, cheaper, pct };
  }, [snkrJpy, kreamJpy]);

  return (
    <div className="sect">
      <div className="sect-hd">
        <h2>시세 비교</h2>
        <span className="more">SNKRDUNK vs 크림</span>
      </div>
      <Panel style={{ padding: 16 }}>
        {/* 비교 기준 — 양쪽 모두 RAW(비등급) 동일 기준. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <span
            style={{
              fontFamily: 'var(--f1)', fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
              color: 'var(--grn)', background: 'var(--pap2)', padding: '4px 11px', borderRadius: 'var(--r-pill)',
            }}
          >
            RAW · 비등급 기준 비교
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
          {/* SNKRDUNK */}
          <Col
            name="SNKRDUNK"
            sub={mode === 'krw' ? 'RAW 최근거래가 · 원화환산' : 'RAW 최근거래가'}
            price={fmt(snkrJpy)}
            highlight={cmp?.cheaper === 'snkr'}
          />
          <div style={{ width: 1, background: 'var(--pap3)', flex: 'none' }} />
          {/* KREAM */}
          <Col
            name="크림 KREAM"
            sub={mode === 'jpy' ? 'RAW 즉시판매가 · 엔화환산' : 'RAW 즉시판매가'}
            price={state === 'loading' ? '조회 중…' : fmt(kreamJpy)}
            highlight={cmp?.cheaper === 'kream'}
            href={item?.productUrl}
          />
        </div>

        {/* 차이 요약 */}
        {cmp && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 'var(--r-sm)',
              background: 'var(--pap2)',
              fontFamily: 'var(--f1)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--ink)',
              textAlign: 'center',
              letterSpacing: 0.3,
            }}
          >
            {cmp.cheaper === 'same' ? (
              '두 플랫폼 시세가 비슷해요'
            ) : (
              <>
                <span style={{ color: cmp.cheaper === 'snkr' ? 'var(--blu)' : 'var(--red)' }}>
                  {cmp.cheaper === 'snkr' ? 'SNKRDUNK' : '크림'}
                </span>
                {' 이 '}
                <span style={{ color: 'var(--red)' }}>{fmt(Math.abs(cmp.diff))}</span>
                {` 저렴 (${cmp.pct.toFixed(1)}%)`}
              </>
            )}
          </div>
        )}

        {/* 매칭 정보 / 폴백 */}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {state === 'loading'
              ? '크림 시세 조회 중…'
              : item
                ? `크림 매칭: ${item.name}`
                : '크림에서 일치하는 상품을 찾지 못했어요'}
          </span>
          <a
            href={item?.productUrl ?? searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 'none', fontFamily: 'var(--f1)', fontSize: 10, fontWeight: 700, color: 'var(--blu)', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            크림에서 보기 ↗
          </a>
        </div>
        <div style={{ marginTop: 8, fontFamily: 'var(--f1)', fontSize: 8.5, color: 'var(--ink3)', letterSpacing: 0.2, lineHeight: 1.5 }}>
        </div>
      </Panel>
    </div>
  );
}

function Col({
  name,
  sub,
  price,
  highlight,
  href,
}: {
  name: string;
  sub: string;
  price: string;
  highlight?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800, color: 'var(--ink)' }}>{name}</div>
      <div style={{ fontFamily: 'var(--f1)', fontSize: 9, color: 'var(--ink3)', marginTop: 3 }}>{sub}</div>
      <div
        style={{
          fontFamily: 'var(--f1)',
          fontSize: 17,
          fontWeight: 900,
          color: highlight ? 'var(--red)' : 'var(--ink)',
          marginTop: 8,
          letterSpacing: 0.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {price}
      </div>
      {highlight && (
        <div style={{ marginTop: 5, display: 'inline-block', fontFamily: 'var(--f1)', fontSize: 8, fontWeight: 800, color: 'var(--white)', background: 'var(--red)', padding: '2px 6px', borderRadius: 'var(--r-sm)' }}>
          최저
        </div>
      )}
    </>
  );
  const style = { flex: 1, minWidth: 0 } as const;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...style, textDecoration: 'none', color: 'inherit' }}>
      {inner}
    </a>
  ) : (
    <div style={style}>{inner}</div>
  );
}
