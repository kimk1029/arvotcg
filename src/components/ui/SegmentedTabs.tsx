'use client';

/**
 * 상단 전환 세그먼트 컨트롤 — Claude Design 'POKE30 커뮤니티' 시안.
 * 회색 트랙 안에서 선택된 항목만 진한 알약(아이콘+라벨)으로 떠오른다.
 * 커뮤니티(커뮤니티↔Shop)·내 자산(내 자산↔관심카드)이 공유.
 */
import type { ReactNode } from 'react';

export interface SegItem<T extends string> {
  id: T;
  label: string;
  /** 라벨 왼쪽 아이콘 — stroke 색을 받아 그린다. */
  icon: (color: string) => ReactNode;
}

interface Props<T extends string> {
  items: [SegItem<T>, SegItem<T>];
  value: T;
  onChange: (id: T) => void;
  /** 트랙(배경) 색 */
  track?: string;
  /** 선택 알약 배경 / 글자색 */
  activeBg?: string;
  activeFg?: string;
  /** 비선택 글자색 */
  inactiveFg?: string;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  track = 'var(--pap2)',
  activeBg = 'var(--ink)',
  activeFg = 'var(--paper)',
  inactiveFg = 'var(--ink3)',
}: Props<T>) {
  return (
    <div style={{ display: 'flex', background: track, borderRadius: 14, padding: 4, gap: 2 }}>
      {items.map((it) => {
        const on = it.id === value;
        const fg = on ? activeFg : inactiveFg;
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(it.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 14, fontWeight: 800, letterSpacing: '-.3px',
              padding: '8px 15px', borderRadius: 11, cursor: 'pointer',
              border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap',
              background: on ? activeBg : 'transparent',
              color: fg,
              boxShadow: on ? '0 2px 6px rgba(0,0,0,.18)' : 'none',
              transition: 'background .2s, color .2s, box-shadow .2s',
            }}
          >
            {it.icon(fg)}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* 시안에서 쓰는 아이콘들 — 각 화면이 골라 쓴다. */
export const SegIcons = {
  chat: (c: string) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  pin: (c: string) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  wallet: (c: string) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  star: (c: string) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  ),
};
