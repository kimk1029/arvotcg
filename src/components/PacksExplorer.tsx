'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Price } from '@/components/Price';
import { ListAdRow } from '@/components/ListAdRow';
import { useGamePrefs } from '@/components/GamePrefsProvider';
import { packSetCode, type CardPackGame } from '../../shared/data/cardPacks';

/** 서버(page.tsx)에서 박스 시세까지 채워 내려주는 행. */
export interface PackListRow {
  code: string;
  /** 공식 세트코드(원피스 OP16 등) — 포켓몬은 code 가 곧 세트코드라 생략. */
  setCode?: string;
  game: CardPackGame;
  name: string;
  emoji: string;
  bg: string;
  releasedAt?: string;
  boxName: string;
  boxKoName: string;
  boxImageUrl: string | null;
  boxPrice: number;
}

const GAME_TABS: Array<{ key: CardPackGame; label: string }> = [
  { key: 'pokemon', label: '포켓몬' },
  { key: 'onepiece', label: '원피스' },
  { key: 'yugioh', label: '유희왕' },
  { key: 'sports', label: '스포츠' },
];

export function PacksExplorer({ packs }: { packs: PackListRow[] }) {
  // 설정의 "카드 게임 표시" 토글이 노출 게임을 정한다 (테마와 무관).
  const { enabledGames } = useGamePrefs();
  const tabs = GAME_TABS.filter((t) => enabledGames.includes(t.key));
  const multi = tabs.length > 1;
  // null = 사용자가 아직 탭을 안 만짐 → 여러 게임이 켜져 있으면 전체, 1개면 그 게임.
  const [picked, setPicked] = useState<CardPackGame | 'all' | null>(null);
  const pickedValid =
    picked === 'all' ? multi : picked != null && enabledGames.includes(picked);
  const game: CardPackGame | 'all' =
    (pickedValid ? picked : null) ?? (multi ? 'all' : tabs[0]?.key ?? 'pokemon');
  const list = packs.filter((p) =>
    game === 'all' ? enabledGames.includes(p.game) : p.game === game,
  );
  const label = game === 'all' ? '전체' : GAME_TABS.find((t) => t.key === game)?.label ?? '카드';

  return (
    <>
      <div className="sect">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {multi && (
            <button
              type="button"
              className={`chip${game === 'all' ? ' on' : ''}`}
              onClick={() => setPicked('all')}
            >
              전체
            </button>
          )}
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`chip${game === t.key ? ' on' : ''}`}
              onClick={() => setPicked(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sect">
        <div className="cv-add-intro" style={{ padding: '14px 14px 12px' }}>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 15, letterSpacing: 0.4 }}>
            {label} 카드 박스
          </div>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 11, color: 'var(--ink3)', marginTop: 7, lineHeight: 1.6 }}>
            박스를 선택하면 해당 박스에 포함된 싱글카드 시세가 표시됩니다.
          </div>
        </div>
      </div>

      <div className="sect">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.flatMap((pack, i) => {
            const row = (
              <Link
                key={pack.code}
                href={`/cards/packs/${pack.code}`}
                className="pack-list-item"
              >
                <div
                  style={{
                    width: 84,
                    height: 84,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    background: pack.bg,
                    color: 'var(--white)',
                    fontSize: 23,
                    borderRadius: 'var(--r-sm, 0px)',
                    overflow: 'hidden',
                  }}
                >
                  {pack.boxImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pack.boxImageUrl} alt={pack.boxKoName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    pack.emoji
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--f1)',
                      fontSize: 13,
                      letterSpacing: 0.2,
                      whiteSpace: 'normal',
                      lineHeight: 1.45,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{pack.name}</span>
                    {/* 세트코드 라벨 — 포켓몬 SV11B/M2A, 원피스 OP16 등. 앱 packs 화면과 동일. */}
                    {packSetCode(pack) && (
                      <span
                        style={{
                          fontSize: 9,
                          letterSpacing: 0.5,
                          color: 'var(--ink3)',
                          border: '1px solid var(--ink3)',
                          borderRadius: 5,
                          padding: '1px 5px',
                          lineHeight: 1.5,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {packSetCode(pack)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)', marginTop: 5, lineHeight: 1.45 }}>
                    {pack.boxKoName}
                    <br />
                    {pack.boxName}
                  </div>
                  <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {pack.boxPrice > 0 && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 7px',
                          background: 'var(--gold-soft, var(--yel))',
                          color: 'var(--ink)',
                          fontFamily: 'var(--f1)',
                          fontSize: 10,
                          letterSpacing: 0.3,
                          borderRadius: 'var(--r-pill, 0px)',
                          border: '1px solid var(--gold-dk)',
                        }}
                      >
                        <span style={{ fontSize: 8, opacity: 0.7 }}>박스</span>
                        <b><Price jpy={pack.boxPrice} /></b>
                      </span>
                    )}
                    {/* 출시일은 항상 표시 (박스 시세 유무와 무관) */}
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        background: 'var(--pap2)',
                        color: 'var(--ink2)',
                        fontFamily: 'var(--f1)',
                        fontSize: 9,
                        letterSpacing: 0.3,
                        borderRadius: 'var(--r-pill, 0px)',
                      }}
                    >
                      {pack.releasedAt ? `${pack.releasedAt} 출시` : '출시일 확인 중'}
                    </span>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--f1)', fontSize: 15, color: 'var(--ink3)' }}>›</div>
              </Link>
            );
            // 5개마다(마지막 뒤 제외) 광고 행 1개 끼움. slotIndex 는 0,1,2…
            return (i + 1) % 5 === 0 && i < list.length - 1
              ? [row, <ListAdRow key={`ad-${pack.code}`} slotIndex={Math.floor(i / 5)} />]
              : [row];
          })}
        </div>
      </div>
    </>
  );
}
