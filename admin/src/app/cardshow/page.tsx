import { CardShowManager } from '@/components/CardShowManager';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** 카드쇼 예약 관리 — 슬롯(날짜/시간/정원) CRUD + 시간대별 예약자 리스팅. */
export default async function Page() {
  const slots = await prisma.cardShowSlot.findMany({
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    include: {
      reservations: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  const rows = slots.map((s) => ({
    id: s.id,
    date: s.date,
    time: s.time,
    capacity: s.capacity,
    active: s.active,
    reservations: s.reservations.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.user?.name ?? '(탈퇴)',
      email: r.user?.email ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  }));

  const totalReserved = rows.reduce((a, s) => a + s.reservations.length, 0);
  const totalCapacity = rows.filter((s) => s.active).reduce((a, s) => a + s.capacity, 0);

  return (
    <>
      <h1 className="admin-h1">🎪 카드쇼 예약 관리</h1>
      <p className="admin-sub">
        시간대 슬롯과 정원을 관리하고 예약자를 확인합니다 · 총 예약 <b>{totalReserved}</b>명 / 정원 {totalCapacity}석
        {' · '}이벤트 페이지 <a href="https://arvotcg.com/event/cardshow" target="_blank" rel="noreferrer">arvotcg.com/event/cardshow</a>
      </p>
      <CardShowManager initialSlots={rows} />
    </>
  );
}
