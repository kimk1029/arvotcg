import { ShopManager, type ShopData } from '@/components/ShopManager';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let shops: ShopData[] = [];
  try {
    const rows = await prisma.cardShop.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    shops = rows.map((s) => ({
      id: s.id,
      name: s.name,
      official: s.official,
      addr: s.addr,
      lat: s.lat,
      lng: s.lng,
      emoji: s.emoji,
      gradFrom: s.gradFrom,
      gradTo: s.gradTo,
      tileColor: s.tileColor,
      oripaPct: s.oripaPct,
      singleText: s.singleText,
      priceLevel: s.priceLevel,
      rating: s.rating,
      reviewCount: s.reviewCount,
      dist: s.dist,
      sortOrder: s.sortOrder,
      active: s.active,
    }));
  } catch (e) {
    console.error('[admin.shops.page]', e);
  }

  return (
    <>
      <h1 className="admin-h1">카드샵 관리</h1>
      <p className="admin-sub">
        커뮤니티 Shop 지도/리스트에 노출되는 오프라인 카드샵 — 주소찾기로 추가하면
        웹·앱 네이버 지도에 핀이 자동으로 찍힙니다. 비활성 샵은 노출되지 않습니다.
      </p>
      <ShopManager initialShops={shops} />
    </>
  );
}
