'use client';

import { useMemo, useState } from 'react';
import { PackGridCard } from '@/components/PackGridCard';
import type { PackHitCard } from '@/lib/cardPackHits';

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
  const sortedCards = useMemo(() => sortItems(cards, cardSort), [cards, cardSort]);
  const sortedBoxes = useMemo(() => sortItems(boxes, 'price-desc'), [boxes]);

  return (
    <>
      <MarketSection
        title="싱글카드 시세"
        count={cards.length}
        items={sortedCards}
        sort={cardSort}
        onSort={setCardSort}
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

function MarketSection({
  title,
  count,
  items,
  sort,
  onSort,
  emptyText,
}: {
  title: string;
  count: number;
  items: PackHitCard[];
  sort?: SortKey;
  onSort?: (sort: SortKey) => void;
  emptyText: string;
}) {
  return (
    <div className="sect">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 15, letterSpacing: 0.4 }}>{title}</div>
          <div style={{ fontFamily: 'var(--f1)', fontSize: 10, color: 'var(--ink3)', marginTop: 4 }}>{count}개 매물</div>
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
