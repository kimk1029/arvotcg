'use client';

import { useState } from 'react';
import { ComposedAvatar } from '@/components/ComposedAvatar';
import { GRADE_LOGOS } from '@/components/cards/GradeMark';
import { useCurrency } from '@/components/CurrencyProvider';

export interface FlexData {
  name: string;
  nameJa: string | null;
  imageUrl: string | null;
  setCode: string | null;
  cardNumber: string | null;
  rarity: string | null;
  series: string | null;
  region: string;
  graded: boolean;
  gradeCompany: string | null;
  gradeValue: string | null;
  qty: number;
  registerPriceJpy: number | null;
  currentPriceJpy: number;
  minPriceJpy: number;
  createdAt: string;
  owner: { name: string; avatarId: string; backgroundId: string; frameId: string };
}

const REGION_LABEL: Record<string, string> = { jp: '일본판', kr: '한국판', en: '영문판' };
const REGION_FLAG: Record<string, string> = { jp: '🇯🇵', kr: '🇰🇷', en: '🇺🇸' };

function ymd(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}. ${p(d.getMonth() + 1)}. ${p(d.getDate())}`;
}

/**
 * 수익 인증 포스터 — 내 카드 한 장의 등록가 대비 현재 시세를 세로 카드로 보여준다.
 * 링크(/flex/:token)만 있으면 누구나 볼 수 있어 그대로 공유할 수 있고,
 * 앱은 이 페이지를 WebView 로 열고 링크를 공유한다.
 */
export function FlexPoster({ data: d }: { data: FlexData }) {
  const { format } = useCurrency();
  const [copied, setCopied] = useState(false);

  const basis = d.registerPriceJpy ?? 0;
  const cur = d.currentPriceJpy;
  const profit = basis > 0 && cur > 0 ? (cur - basis) * d.qty : null;
  const pct = basis > 0 && cur > 0 ? ((cur - basis) / basis) * 100 : null;
  const up = (profit ?? 0) >= 0;
  const gradeLogo = d.graded ? GRADE_LOGOS[(d.gradeCompany ?? 'PSA').toUpperCase()] : null;

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = `${d.name} 수익 인증 · ARVOTCG`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 취소 — 무시 */
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#E9F1FF 0%,#DCE9FF 45%,#EAF2FF 100%)', padding: '18px 14px 34px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', position: 'relative' }}>
        {/* 헤더 — 로고 / 날짜 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 1, color: '#1D5BFF', lineHeight: 1 }}>ARVO</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 2.4, color: '#5B7BC4', marginTop: 4 }}>TCG, MORE VALUE</div>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#3C5A9A' }}>{ymd(d.createdAt)}</div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.4, color: '#89A3D6', marginTop: 2 }}>MY COLLECTION</div>
          </div>
        </div>

        {/* 사이드 레터링 */}
        <div style={{ position: 'absolute', left: -2, top: 96, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 21, fontWeight: 700, color: 'rgba(93,134,214,.55)', transform: 'rotate(-6deg)', lineHeight: 1.1 }}>
          My<br />Card
        </div>
        <div style={{ position: 'absolute', right: 0, top: 108, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 18, fontWeight: 700, color: 'rgba(93,134,214,.5)', transform: 'rotate(-6deg)', textAlign: 'right', lineHeight: 1.1 }}>
          More<br />Value
        </div>

        {/* 카드 이미지 + 우측 배지 스택 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'center', margin: '6px 0 16px' }}>
          <div
            style={{
              width: '58%', maxWidth: 250, aspectRatio: '5 / 7', borderRadius: 16, overflow: 'hidden',
              background: '#fff', boxShadow: '0 18px 40px rgba(40,80,170,.28)', display: 'grid', placeItems: 'center',
            }}
          >
            {d.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.imageUrl} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 54 }}>🃏</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-start', paddingTop: 30 }}>
            {d.graded ? (
              <Badge>
                {gradeLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gradeLogo} alt={d.gradeCompany ?? 'PSA'} style={{ height: 13, width: 'auto' }} />
                ) : (
                  <b style={{ color: '#1D5BFF' }}>{d.gradeCompany ?? 'PSA'}</b>
                )}
                <b>{d.gradeValue ?? ''}</b>
              </Badge>
            ) : (
              <Badge muted>RAW</Badge>
            )}
            <Badge>{REGION_FLAG[d.region] ?? '🇯🇵'} {REGION_LABEL[d.region] ?? '일본판'}</Badge>
            {(d.setCode || d.cardNumber) && (
              <Badge>{[d.setCode?.toUpperCase(), d.cardNumber].filter(Boolean).join(' ')}</Badge>
            )}
            {d.rarity && <Badge>{d.rarity}</Badge>}
            {d.series && <Badge>{d.series}</Badge>}
          </div>
        </div>

        {/* 본문 패널 */}
        <div style={{ background: 'rgba(255,255,255,.92)', borderRadius: 20, padding: 16, boxShadow: '0 10px 30px rgba(40,80,170,.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <ComposedAvatar avatar={d.owner.avatarId} bg={d.owner.backgroundId} frame={d.owner.frameId} size={38} />
              <span style={{ fontSize: 14.5, fontWeight: 800, color: '#1B2A47', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d.owner.name} <span style={{ fontSize: 13 }}>👑</span>
              </span>
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8FA3C8' }}>최초 등록일</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#3C5A9A', marginTop: 2 }}>{ymd(d.createdAt)}</div>
            </div>
          </div>

          <div style={{ fontSize: 20, fontWeight: 900, color: '#111827', marginTop: 14, lineHeight: 1.3 }}>{d.name}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8FA3C8', marginTop: 4 }}>
            {[[d.setCode?.toUpperCase(), d.cardNumber].filter(Boolean).join(' '), d.series].filter(Boolean).join(' | ')}
          </div>

          {/* 등록가 · 현재 시세 · 수익 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, background: '#F7FAFF', borderRadius: 14, padding: '14px 8px', marginTop: 14 }}>
            <Cell label="최초 등록 금액" value={basis > 0 ? format(basis) : '—'} />
            <Cell label="현재 시세" value={cur > 0 ? format(cur) : '—'} divider />
            <Cell
              label="수익 금액"
              value={profit != null ? `${up ? '+' : '-'}${format(Math.abs(profit))}` : '—'}
              color={profit == null ? undefined : up ? '#F5333F' : '#2F6BFF'}
              divider
              chip={pct != null ? `${up ? '+' : ''}${pct.toFixed(2)}%` : undefined}
              chipColor={up ? '#F5333F' : '#2F6BFF'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#F7FAFF', borderRadius: 14, padding: '14px 8px', marginTop: 10 }}>
            <Cell label="보유 수량" value={`${d.qty}개`} />
            <Cell label="최저 매물가" value={d.minPriceJpy > 0 ? format(d.minPriceJpy) : '—'} divider />
          </div>
        </div>

        {/* 푸터 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.92)', borderRadius: 18, padding: '14px 16px', marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1D5BFF', lineHeight: 1 }}>ARVO</div>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.8, color: '#8FA3C8', marginTop: 3 }}>TCG, MORE VALUE</div>
          </div>
          <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.6, color: '#8FA3C8', textAlign: 'right', lineHeight: 1.7 }}>
            COLLECT<br />TRACK<br />GROW
          </div>
        </div>

        <button
          type="button"
          onClick={share}
          style={{
            width: '100%', marginTop: 14, height: 50, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: '#1D5BFF', color: '#fff', fontSize: 15, fontWeight: 800,
          }}
        >
          {copied ? '링크가 복사되었어요!' : '이 인증 공유하기'}
        </button>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#8FA3C8', marginTop: 10 }}>
          아르보TCG에서 내 카드 시세를 관리해 보세요 · arvotcg.com
        </div>
      </div>
    </div>
  );
}

function Badge({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
        background: muted ? '#E6ECF6' : '#fff', color: muted ? '#8FA3C8' : '#1B2A47',
        borderRadius: 12, padding: '8px 12px', fontSize: 12, fontWeight: 800,
        boxShadow: '0 4px 12px rgba(40,80,170,.12)',
      }}
    >
      {children}
    </span>
  );
}

function Cell({
  label, value, color, divider, chip, chipColor,
}: { label: string; value: string; color?: string; divider?: boolean; chip?: string; chipColor?: string }) {
  return (
    <div style={{ textAlign: 'center', borderLeft: divider ? '1px solid #E3EAF6' : 'none', padding: '0 6px', minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8FA3C8' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color: color ?? '#111827', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {chip && (
        <div style={{ display: 'inline-block', marginTop: 6, background: `${chipColor}1A`, color: chipColor, borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>
          {chip}
        </div>
      )}
    </div>
  );
}
