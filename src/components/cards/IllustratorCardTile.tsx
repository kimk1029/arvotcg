'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CardThumb } from '@/components/CardThumb';
import { Panel } from '@/components/ui/Panel';
import { illustratorCardCode, illustratorSearchQuery, pickApparelIdByCode } from '../../../shared/illustratorCard';

export interface IllustratorCard {
  id: string;
  name: string;
  setName?: string;
  setCode?: string;
  number?: string;
  totalNumber?: string | number;
  rarity?: string;
  illustrator?: string;
  imageSmall?: string | null;
  imageLarge?: string | null;
}

/**
 * 일러스트레이터 검색 결과 타일 — 탭하면 세트코드+번호로 스니덩크 apparelId 를 찾아 시세상세로,
 * 못 찾으면 코드 검색 목록으로 (앱 IllustratorPanel 동일, 규칙 shared/illustratorCard.ts).
 */
export function IllustratorCardTile({ c }: { c: IllustratorCard }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const img = c.imageSmall || c.imageLarge;
  const num = c.number && c.totalNumber ? `${c.number}/${c.totalNumber}` : c.number ?? '';
  const code = illustratorCardCode(c);

  const open = async () => {
    if (!code || busy) return;
    setBusy(true);
    let apparelId: number | null = null;
    try {
      const res = await fetch(
        `/api/snkrdunk/by-code?setCode=${encodeURIComponent(code.setCode)}&number=${encodeURIComponent(code.number)}`,
        { signal: AbortSignal.timeout(12_000) },
      );
      const data = res.ok ? ((await res.json()) as { cards?: { apparelId: number }[] }) : null;
      apparelId = pickApparelIdByCode(data?.cards ?? []);
    } catch {
      /* 조회 실패 → 검색 목록 폴백 */
    }
    if (!alive.current) return;
    setBusy(false);
    router.push(apparelId ? `/cards/snkrdunk/${apparelId}` : `/cards/snkrdunk/search?q=${encodeURIComponent(illustratorSearchQuery(c))}`);
  };

  return (
    <Panel
      onClick={open}
      ariaLabel={code ? `${c.name} 시세 보기` : undefined}
      style={{ overflow: 'hidden', position: 'relative', cursor: code ? 'pointer' : 'default' }}
      pixelShadow="-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)"
    >
      <CardThumb
        style={{
          aspectRatio: '63 / 88',
          background: 'var(--pap2)',
          overflow: 'hidden',
        }}
        src={img}
        alt={c.name}
        loading="lazy"
        emojiSize={33}
      />
      <div className="cv-card-divider" style={{ padding: '6px 8px 8px' }}>
        <div
          style={{
            fontFamily: 'var(--f1)',
            fontSize: 10,
            color: 'var(--ink)',
            letterSpacing: 0.2,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 28,
          }}
          title={c.name}
        >
          {c.name}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: 'var(--f1)',
            fontSize: 8,
            color: 'var(--ink3)',
            letterSpacing: 0.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {[c.setCode?.toUpperCase(), num, c.rarity].filter(Boolean).join(' · ')}
        </div>
      </div>
      {busy && (
        <div
          role="status"
          style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.45)', color: 'var(--white)', fontFamily: 'var(--f1)', fontSize: 9, letterSpacing: 0.5, gap: 6 }}
        >
          <span className="pf-pokeball-spinner pf-pokeball-spinner--sm" />
          시세 찾는 중…
        </div>
      )}
    </Panel>
  );
}
