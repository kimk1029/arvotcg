'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { PackGridCard } from '@/components/PackGridCard';
import type { PackHitCard } from '@/lib/cardPackHits';
import { rarityLabelOf, sortRarityLabels } from '@/lib/cardRarity';

type SortKey = 'price-desc' | 'recent-sale' | 'listing-desc';

interface Props {
  cards: PackHitCard[];
  boxes: PackHitCard[];
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

export function PackMarketSections({ cards, boxes, showBoxes = false }: Props) {
  const [cardSort, setCardSort] = useState<SortKey>('price-desc');
  // null = 전체. 등급(레어도) 라벨은 상품명에서 뽑는다 (shared/cardRarity 단일 소스).
  const [rarity, setRarity] = useState<string | null>(null);

  // 카드별 등급 라벨 + 라벨별 개수 — 실제로 존재하는 등급만 칩으로 노출한다.
  const { labelOf, rarityCounts } = useMemo(() => {
    const map = new Map<number, string>();
    const counts = new Map<string, number>();
    for (const hit of cards) {
      const label = rarityLabelOf(hit.name, hit.koName);
      map.set(hit.apparelId, label);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return {
      labelOf: map,
      rarityCounts: sortRarityLabels([...counts.keys()]).map((label) => ({
        label,
        count: counts.get(label) ?? 0,
      })),
    };
  }, [cards]);

  const visibleCards = useMemo(
    () => (rarity ? cards.filter((hit) => labelOf.get(hit.apparelId) === rarity) : cards),
    [cards, labelOf, rarity],
  );
  const sortedCards = useMemo(() => sortItems(visibleCards, cardSort), [visibleCards, cardSort]);
  const sortedBoxes = useMemo(() => sortItems(boxes, 'price-desc'), [boxes]);

  return (
    <>
      <MarketSection
        title="싱글카드 시세"
        count={cards.length}
        filteredCount={rarity ? visibleCards.length : null}
        items={sortedCards}
        sort={cardSort}
        onSort={setCardSort}
        chips={
          // 등급이 한 종류뿐이면(스포츠 카드 등) 필터가 의미 없어 숨긴다.
          rarityCounts.length > 1 ? (
            <RarityChips options={rarityCounts} total={cards.length} value={rarity} onChange={setRarity} />
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

/** 등급 필터 칩 — 작은 라벨, 누르면 그 등급 카드만 남는다. */
function RarityChips({
  options,
  total,
  value,
  onChange,
}: {
  options: Array<{ label: string; count: number }>;
  total: number;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }} role="group" aria-label="등급 필터">
      <button
        type="button"
        className={`cv-chip${value === null ? ' on' : ''}`}
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        전체 {total}
      </button>
      {options.map((opt) => {
        const on = value === opt.label;
        return (
          <button
            key={opt.label}
            type="button"
            className={`cv-chip${on ? ' on' : ''}`}
                aria-pressed={on}
            onClick={() => onChange(on ? null : opt.label)}
          >
            {opt.label} {opt.count}
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
