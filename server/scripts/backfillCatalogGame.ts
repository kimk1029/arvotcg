/**
 * 카탈로그 작품(game) 1회 백필 — 회원 컬렉션(user_cards)에 담긴 스니덩크 카드 중 game 이 비었거나 'other' 인
 * 것을 스니덩크 상품 브랜드(ONE PIECE·YU-GI-OH·Pokemon Card Game)로 다시 판정해 저장한다.
 * 이름 파싱만으로는 원피스·유희왕 대부분이 'other' 라 내 컬렉션 '자산 구성' 파이에 기타 작품으로 뭉쳤다(2026-09-08).
 *
 *   cd server && npx tsx scripts/backfillCatalogGame.ts            # 컬렉션 카드만(기본)
 *   cd server && ALL=1 npx tsx scripts/backfillCatalogGame.ts      # 카탈로그 전체(느림)
 */
import { prisma } from '../lib/prisma.js';
import { fetchSnkrdunkApparel } from '@/lib/snkrdunk';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const all = process.env.ALL === '1';
  let ids: number[];
  if (all) {
    ids = (await prisma.snkrdunkCard.findMany({ where: { OR: [{ game: '' }, { game: 'other' }] }, select: { apparelId: true } })).map((r) => r.apparelId);
  } else {
    const owned = await prisma.userCard.findMany({ where: { snkrdunkApparelId: { not: null } }, select: { snkrdunkApparelId: true }, distinct: ['snkrdunkApparelId'] });
    const ownedIds = owned.map((r) => r.snkrdunkApparelId!).filter((n) => n > 0);
    const rows = await prisma.snkrdunkCard.findMany({ where: { apparelId: { in: ownedIds } }, select: { apparelId: true, game: true } });
    const known = new Map(rows.map((r) => [r.apparelId, r.game]));
    ids = ownedIds.filter((id) => !known.has(id) || !known.get(id) || known.get(id) === 'other');
  }
  console.log(`[backfillCatalogGame] 대상 ${ids.length}건 (all=${all})`);
  let fixed = 0, unknown = 0, failed = 0;
  for (const id of ids) {
    try {
      const a = await fetchSnkrdunkApparel(id);
      if (!a) { failed++; continue; }
      if (a.game && a.game !== 'other') {
        await prisma.snkrdunkCard.updateMany({ where: { apparelId: id }, data: { game: a.game } });
        fixed++;
        console.log(`  ${id} -> ${a.game}  ${(a.localizedName || a.name).slice(0, 40)}`);
      } else unknown++;
    } catch (err) {
      failed++;
      console.warn('  실패', id, err instanceof Error ? err.message : err);
    }
    await sleep(250);
  }
  console.log(`[backfillCatalogGame] 완료 — 갱신 ${fixed} · 판정불가 ${unknown} · 실패 ${failed}`);
  await prisma.$disconnect();
}

void main();
