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
  // 게임 탭 — 단일 선택(라디오, 복수 불가). 포켓몬·원피스는 항상 노출, 그 외는
  // 설정에서 켠 게임만 추가. 기본 포켓몬 (홈 게임 칩과 동일 규칙).
  const { enabledGames } = useGamePrefs();
  const tabs = GAME_TABS.filter(
    (t) => t.key === 'pokemon' || t.key === 'onepiece' || enabledGames.includes(t.key),
  );
  const [game, setGame] = useState<CardPackGame>('pokemon');
  // 박스 검색 — 이미 받아둔 목록의 클라이언트 필터라 입력 즉시(깜빡임 없이) 반영.
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = packs
    .filter((p) => (p.game ?? 'pokemon') === game)
    .filter(
      (p) =>
        !q ||
        [p.name, p.boxName, p.boxKoName, p.code, packSetCode(p) ?? ''].some((s) =>
          (s ?? '').toLowerCase().includes(q),
        ),
    );
  const label = GAME_TABS.find((t) => t.key === game)?.label ?? '카드';

  return (
    <>
      <div className="sect">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`chip${game === t.key ? ' on' : ''}`}
              onClick={() => setGame(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* 박스 검색 — 박스명·한/일 박스 이름·세트코드로 즉시 필터 */}
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--pap2)',
            border: '1px solid var(--pap3)',
            borderRadius: 'var(--r, 0px)',
            padding: '9px 12px',
          }}
        >
          <span style={{ fontSize: 13 }} aria-hidden>
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="박스명·세트코드 검색 (예: 151, sv2a, 배틀파트너즈)"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--f1)',
              fontSize: 12,
              color: 'var(--ink)',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="검색어 지우기"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', fontSize: 13, padding: 0 }}
            >
              ✕
            </button>
          )}
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
        {list.length === 0 && (
          <div
            style={{
              padding: '30px 0',
              textAlign: 'center',
              fontFamily: 'var(--f1)',
              fontSize: 11,
              color: 'var(--ink3)',
            }}
          >
            {q ? `'${query.trim()}' 검색 결과가 없습니다.` : '표시할 박스가 없습니다.'}
          </div>
        )}
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
