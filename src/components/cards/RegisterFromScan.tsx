'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CardRegisterSheet, type RegisterCardInput } from '@/components/cards/CardRegisterSheet';

/** 스캔 → 등록 페이지로 카드 정보를 넘기는 sessionStorage 키. */
export const REGISTER_CARD_STORAGE_KEY = 'pf30.registerCard';

/**
 * /cards/register 본문 — 그레이딩 스캔에서 선택한 카드(sessionStorage)를 읽어
 * 등록 시트를 띄운다. 직접 진입(데이터 없음)이면 스캔/직접입력으로 안내.
 */
export function RegisterFromScan() {
  // undefined = 아직 읽는 중 (SSR/첫 렌더), null = 데이터 없음
  const [card, setCard] = useState<RegisterCardInput | null | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REGISTER_CARD_STORAGE_KEY);
      setCard(raw ? (JSON.parse(raw) as RegisterCardInput) : null);
    } catch {
      setCard(null);
    }
  }, []);

  if (card === undefined) return null;

  if (card === null) {
    return (
      <div style={{ padding: '0 var(--gap)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            padding: '24px 16px',
            background: 'var(--pap2)',
            fontFamily: 'var(--f1)',
            fontSize: 11,
            color: 'var(--ink2)',
            letterSpacing: 0.3,
            lineHeight: 1.7,
            textAlign: 'center',
            boxShadow:
              '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
          }}
        >
          등록할 카드 정보가 없어요.
          <br />
          카드 스캔에서 카드를 선택한 뒤 등록으로 넘어오세요.
        </div>
        <Link
          href="/cards/grading"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '14px 16px',
            fontFamily: 'var(--f1)',
            fontSize: 12,
            letterSpacing: 0.5,
            color: 'var(--white)',
            background: 'var(--blu)',
            textDecoration: 'none',
            boxShadow:
              '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),4px 4px 0 var(--ink)',
          }}
        >
          📷 카드 스캔으로 등록하기
        </Link>
        <Link
          href="/cards/add"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '12px 16px',
            fontFamily: 'var(--f1)',
            fontSize: 11,
            letterSpacing: 0.5,
            color: 'var(--ink)',
            background: 'var(--white)',
            textDecoration: 'none',
            boxShadow:
              '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
          }}
        >
          ✏️ 직접 입력으로 등록하기
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 var(--gap)' }}>
      <CardRegisterSheet card={card} />
    </div>
  );
}
