'use client';

import { useEffect, useMemo, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { useCurrency } from '@/components/CurrencyProvider';
import { fetchKoPrices, type KoPriceRow, type KoPriceQuery } from '@/lib/koreaPrice';

/**
 * 한국판 멀티소스 시세 — KREAM·TCGBox·네이버카페 등 국내 소스의 체결/판매가를
 * 카드 코드+번호+등급으로 매칭해 한 줄씩 보여준다. (현재 KREAM 활성, 나머지 순차 추가)
 */
export function MultiSourceKoPrice(props: KoPriceQuery) {
  const { name, setCode, cardNumber, rarity } = props;
  // 국내 소스 가격은 KRW 원본 — 통화 설정이 엔화면 환율로 엔화 환산해 표시.
  const { mode, rate } = useCurrency();
  const fmt = (krw: number) =>
    mode === 'jpy' && rate > 0
      ? `¥${Math.round(krw / rate).toLocaleString('ja-JP')}`
      : `₩${Math.round(krw).toLocaleString('ko-KR')}`;
  const [state, setState] = useState<'loading' | 'done'>('loading');
  const [rows, setRows] = useState<KoPriceRow[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    setState('loading');
    fetchKoPrices({ name, setCode, cardNumber, rarity }, ctrl.signal)
      .then((r) => {
        setRows(r);
        setState('done');
      })
      .catch(() => setState('done'));
    return () => ctrl.abort();
  }, [name, setCode, cardNumber, rarity]);

  const low = useMemo(
    () => (rows.length ? Math.min(...rows.map((r) => r.price)) : 0),
    [rows],
  );

  return (
    <div className="sect">
      <div className="sect-hd">
        <h2>한국 시세</h2>
        {rows.length > 0 && <span className="more">{rows.length}개 소스</span>}
      </div>

      <Panel style={{ padding: '6px 14px' }}>
        {state === 'loading' ? (
          <div style={ph}>국내 시세 조회 중…</div>
        ) : rows.length === 0 ? (
          <div style={ph}>매칭되는 국내 시세가 아직 없어요</div>
        ) : (
          rows.map((r, i) => {
            const isLow = r.price === low;
            const sold = r.kind === '체결';
            return (
              <a
                key={`${r.source}-${i}`}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', textDecoration: 'none',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--pap3)' : 'none',
                }}
              >
                <span
                  style={{
                    flex: 'none', minWidth: 64, textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 11, fontWeight: 800,
                    padding: '5px 8px', borderRadius: 'var(--r-sm)', background: 'var(--pap2)', color: 'var(--ink)',
                  }}
                >
                  {r.label}
                </span>
                <span
                  style={{
                    flex: 'none', fontFamily: 'var(--f1)', fontSize: 9, fontWeight: 700, padding: '3px 6px', borderRadius: 'var(--r-sm)',
                    background: sold ? 'var(--red-soft,var(--pap2))' : 'var(--pap2)',
                    color: sold ? 'var(--red)' : 'var(--ink3)',
                  }}
                >
                  {sold ? '체결가' : '판매가'}
                </span>
                <span style={{ flex: 1, minWidth: 0 }} />
                <span
                  style={{
                    flex: 'none', fontFamily: 'var(--f1)', fontSize: 15, fontWeight: 900,
                    color: isLow ? 'var(--red)' : 'var(--ink)',
                  }}
                >
                  {fmt(r.price)}
                </span>
              </a>
            );
          })
        )}
      </Panel>

      <div style={{ marginTop: 8, fontFamily: 'var(--f1)', fontSize: 8.5, color: 'var(--ink3)', letterSpacing: 0.2, lineHeight: 1.5 }}>
        · 카드 코드·번호·등급으로 매칭한 국내 소스 시세예요. TCGBox·네이버카페 경매(체결가)는 순차 추가 중.
      </div>
    </div>
  );
}

const ph: React.CSSProperties = {
  padding: '24px 0', textAlign: 'center', fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)',
};
