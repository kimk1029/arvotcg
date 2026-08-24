'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { PackGridCard } from '@/components/PackGridCard';
import type { PackHitCard } from '@/lib/cardPackHits';
import { filterRarityOf, rarityMetaOf, sortRarityIds, type RarityGame, type RarityId } from '@/lib/cardRarity';

type SortKey = 'price-desc' | 'recent-sale' | 'listing-desc';

interface Props {
  cards: PackHitCard[];
  boxes: PackHitCard[];
  /** 등급 사다리는 게임마다 다르다 — 팩의 게임(포켓몬/원피스/유희왕/스포츠). */
  game: RarityGame;
  showBoxes?: boolean;
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'price-desc', label: '가격 높은순' },
  { key: 'recent-sale', label: '최근 거래순' },
  { key: 'listing-desc', label: '매물 많은순' },
];

function sortItems(items: PackHitCard[], sort: SortKey): PackHitCard[] {
  return [...items].sort((a, b) => {
    if (sort === 'recent-sale') return b.lastSaleSort - a.lastSaleSort || b.minPrice - a.minPrice;
    if (sort === 'listing-desc') return b.listingCount - a.listingCount || b.minPrice - a.minPrice;
    return b.minPrice - a.minPrice || b.lastSaleSort - a.lastSaleSort;
  });
}

export function PackMarketSections({ cards, boxes, game, showBoxes = false }: Props) {
  const [cardSort, setCardSort] = useState<SortKey>('price-desc');
  // 빈 배열 = 전체. 등급(레어도)은 상품명에서 뽑는다 (shared/cardRarity 단일 소스).
  // 다중 선택 — 'SAR + UR' 처럼 여러 등급을 함께 볼 수 있다.
  const [selected, setSelected] = useState<RarityId[]>([]);

  // 카드별 등급 + 등급별 개수 — 이 팩에 실제로 있는 고등급만 칩으로 노출(높은 등급 먼저).
  const { rarityOf, rarityCounts } = useMemo(() => {
    const map = new Map<number, RarityId>();
    const counts = new Map<RarityId, number>();
    for (const hit of cards) {
      const id = filterRarityOf(game, hit.name, hit.koName);
      if (!id) continue;
      map.set(hit.apparelId, id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return {
      rarityOf: map,
      rarityCounts: sortRarityIds(game, [...counts.keys()]).map((id) => ({
        id,
        count: counts.get(id) ?? 0,
      })),
    };
  }, [cards, game]);

  const visibleCards = useMemo(() => {
    if (selected.length === 0) return cards;
    return cards.filter((hit) => {
      const id = rarityOf.get(hit.apparelId);
      return !!id && selected.includes(id);
    });
  }, [cards, rarityOf, selected]);
  const sortedCards = useMemo(() => sortItems(visibleCards, cardSort), [visibleCards, cardSort]);
  const sortedBoxes = useMemo(() => sortItems(boxes, 'price-desc'), [boxes]);

  return (
    <>
      <MarketSection
        title="싱글카드 시세"
        count={cards.length}
        filteredCount={selected.length > 0 ? visibleCards.length : null}
        items={sortedCards}
        sort={cardSort}
        onSort={setCardSort}
        chips={
          // 고등급이 하나도 없으면(스포츠 카드 등) 필터가 의미 없어 숨긴다.
          rarityCounts.length > 0 ? (
            <RarityChips
              options={rarityCounts}
              total={cards.length}
              selected={selected}
              onToggle={(id) =>
                setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
              }
              onClear={() => setSelected([])}
            />
          ) : null
        }
        emptyText="이 팩의 싱글카드 매물을 가져오지 못했어요."
      />

      {showBoxes ? (
        <MarketSection
          title="상자/팩 매물"
          count={boxes.length}
          items={sortedBoxes}
          emptyText="상자/팩 매물을 가져오지 못했어요."
        />
      ) : null}
    </>
  );
}

/**
 * 등급 필터 칩 — 작은 라벨. 여러 개를 눌러 함께 볼 수 있다(SAR + UR).
 * 선택된 칩만 등급색(RARITY_META), 나머지는 무채색으로 죽여 비활성으로 보이게 한다.
 */
function RarityChips({
  options,
  total,
  selected,
  onToggle,
  onClear,
}: {
  options: Array<{ id: RarityId; count: number }>;
  total: number;
  selected: RarityId[];
  onToggle: (id: RarityId) => void;
  onClear: () => void;
}) {
  const allOn = selected.length === 0;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }} role="group" aria-label="등급 필터 (중복 선택 가능)">
      <button
        type="button"
        className={`rar-chip${allOn ? ' on' : ''}`}
        aria-pressed={allOn}
        style={
          allOn
            ? { background: 'var(--ink)', color: 'var(--white)' }
            : { background: 'var(--pap2)', color: 'var(--ink3)' }
        }
        onClick={onClear}
      >
        전체<span className="rar-chip-n">{total}</span>
      </button>
      {options.map((opt) => {
        const meta = rarityMetaOf(opt.id);
        const on = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            className={`rar-chip${on ? ' on' : ''}`}
            title={meta.name}
            aria-label={`${meta.label} ${meta.name} ${opt.count}개`}
            aria-pressed={on}
            // 선택 = 등급색 그대로(MUR 은 황금색), 비선택 = 무채색 비활성.
            style={
              on
                ? { background: meta.bg, color: meta.fg }
                : { background: 'var(--pap2)', color: 'var(--ink3)' }
            }
            onClick={() => onToggle(opt.id)}
          >
            {meta.label}<span className="rar-chip-n">{opt.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function MarketSection({
  title,
  count,
  filteredCount = null,
  items,
  sort,
  onSort,
  chips = null,
  emptyText,
}: {
  title: string;
  count: number;
  filteredCount?: number | null;
  items: PackHitCard[];
  sort?: SortKey;
  onSort?: (sort: SortKey) => void;
  chips?: ReactNode;
  emptyText: string;
}) {
  return (
    <div className="sect">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 15, letterSpacing: 0.4 }}>{title}</div>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)', marginTop: 4 }}>
            {filteredCount === null ? `${count}개 매물` : `${filteredCount}개 매물 · 전체 ${count}개`}
          </div>
        </div>
        {sort && onSort ? (
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            aria-label="정렬"
            style={{
              fontFamily: 'var(--f1)',
              fontSize: 10,
              height: 32,
              padding: '0 8px',
              background: 'var(--white)',
              color: 'var(--ink)',
              border: 0,
              boxShadow: '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),inset 0 2px 0 rgba(255,255,255,.8),3px 3px 0 var(--ink)',
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        ) : null}
      </div>

      {chips}

      {items.length === 0 ? (
        <div
          style={{
            padding: 30, textAlign: 'center', background: 'var(--white)',
            fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)',
            boxShadow:
              '-3px 0 0 var(--ink),3px 0 0 var(--ink),0 -3px 0 var(--ink),0 3px 0 var(--ink),5px 5px 0 var(--ink)',
          }}
        >
          {emptyText}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          {items.map((hit) => (
            <MarketCard key={hit.apparelId} hit={hit} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketCard({ hit }: { hit: PackHitCard }) {
  // 번역된 koName 이 비어있거나 원문과 동일하면 일본어 별도 표기 생략 (중복 라인 방지).
  const koTitle = hit.koName || hit.shortName;
  const jpTitle = hit.name && hit.name !== koTitle ? hit.name : null;
  return (
    <PackGridCard
      href={`/cards/snkrdunk/${hit.apparelId}`}
      image={hit.imageUrl}
      title={koTitle}
      subtitle={jpTitle}
      priceJpy={hit.minPrice}
      footer={
        hit.lastSaleText ? `최근 ${hit.lastSaleText}` : hit.listingCountText ? `매물 ${hit.listingCountText}건` : '매물 없음'
      }
    />
  );
}
