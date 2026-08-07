import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';

/**
 * 오프라인 카드샵 목록 — 커뮤니티 Shop 지도/리스트 (웹·앱 공통).
 * 어드민(admin/src/app/shops)에서 CRUD, 여기는 활성 샵 공개 조회만.
 * 테이블이 비어있으면 프로토타입 기본 4개를 시드한다 (places 와 같은 패턴).
 */

const DEFAULT_SHOPS = [
  { name: '포켓랩 성수점', official: true, addr: '서울 성동구 연무장길 21', lat: 37.5433, lng: 127.0512, emoji: '🎁', gradFrom: '#ffb347', gradTo: '#ff7a1f', tileColor: '#ff9a33', oripaPct: 65, singleText: '1,240종', priceLevel: '저렴', rating: 4.8, reviewCount: 214, dist: '320m', sortOrder: 10 },
  { name: '카드킹덤 홍대', official: true, addr: '서울 마포구 와우산로 105', lat: 37.5535, lng: 126.9256, emoji: '👑', gradFrom: '#6fb1e0', gradTo: '#3a6ea5', tileColor: '#5595c8', oripaPct: 40, singleText: '2,860종', priceLevel: '보통', rating: 4.6, reviewCount: 158, dist: '1.2km', sortOrder: 20 },
  { name: 'TCG스테이션', official: false, addr: '서울 성동구 왕십리로 83', lat: 37.557, lng: 127.04, emoji: '🚉', gradFrom: '#9d6bd6', gradTo: '#4568dc', tileColor: '#7169d9', oripaPct: 80, singleText: '420종', priceLevel: '높음', rating: 4.4, reviewCount: 96, dist: '850m', sortOrder: 30 },
  { name: '몬스터카드샵', official: false, addr: '서울 광진구 아차산로 200', lat: 37.5405, lng: 127.0715, emoji: '👾', gradFrom: '#11998e', gradTo: '#38ef7d', tileColor: '#25c486', oripaPct: 25, singleText: '3,150종', priceLevel: '저렴', rating: 4.2, reviewCount: 61, dist: '2.1km', sortOrder: 40 },
];

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const list = () =>
      prisma.cardShop.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
    let rows = await list();
    if (rows.length === 0) {
      // 활성 0 ≠ 테이블 빔 — 어드민이 전부 숨긴 상태에서 시드로 되살리지 않는다.
      const total = await prisma.cardShop.count();
      if (total === 0) {
        await prisma.cardShop.createMany({ data: DEFAULT_SHOPS });
        rows = await list();
      }
    }
    res.json({
      shops: rows.map((r) => ({
        id: r.id,
        name: r.name,
        official: r.official,
        addr: r.addr,
        lat: r.lat,
        lng: r.lng,
        emoji: r.emoji,
        gradFrom: r.gradFrom,
        gradTo: r.gradTo,
        tileColor: r.tileColor,
        oripaPct: r.oripaPct,
        singleText: r.singleText,
        priceLevel: r.priceLevel,
        rating: r.rating,
        reviewCount: r.reviewCount,
        dist: r.dist,
      })),
    });
  } catch (err) {
    console.error('[shops.GET]', err);
    res.json({ shops: [] });
  }
});

export default router;
