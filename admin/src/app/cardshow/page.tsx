import { CardShowManager } from '@/components/CardShowManager';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** 카드쇼 예약 관리 — 슬롯(날짜/시간/정원) CRUD + 시간대별 예약자 리스팅. */
export default async function Page() {
  const events = await prisma.cardShowEvent.findMany({ orderBy: { date: 'asc' } });
  const slots = await prisma.cardShowSlot.findMany({
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    include: {
      reservations: {
        orderBy: { createdAt: 'asc' },
        // 회원정보 모달에 바로 띄울 만큼만 — 목록 조회 한 번으로 끝내고 추가 fetch 를 없앤다.
        include: {
          user: {
            select: {
              id: true, name: true, email: true, avatarId: true, points: true,
              signupPlatform: true, isAdmin: true, createdAt: true,
              _count: { select: { userCards: true, trades: true, feeds: true } },
            },
          },
        },
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
      checkedInAt: r.checkedInAt?.toISOString() ?? null,
      user: r.user
        ? {
            avatarId: r.user.avatarId,
            points: r.user.points,
            signupPlatform: r.user.signupPlatform,
            isAdmin: r.user.isAdmin,
            joinedAt: r.user.createdAt.toISOString(),
            cards: r.user._count.userCards,
            trades: r.user._count.trades,
            feeds: r.user._count.feeds,
          }
        : null,
    })),
  }));

  const totalReserved = rows.reduce((a, s) => a + s.reservations.length, 0);
  const totalCapacity = rows.filter((s) => s.active).reduce((a, s) => a + s.capacity, 0);
  const totalCheckedIn = rows.reduce((a, s) => a + s.reservations.filter((r) => r.checkedInAt).length, 0);

  return (
    <>
      <h1 className="admin-h1">🎪 카드쇼 예약 관리</h1>
      <p className="admin-sub">
        날짜별 행사 정보(행사명·장소·시간)와 시간대 슬롯·정원을 관리하고 예약자를 확인합니다 · 총 예약 <b>{totalReserved}</b>명 / 정원 {totalCapacity}석 · 입장 완료 <b>{totalCheckedIn}</b>명
        {' · '}이벤트 페이지 <a href="https://arvotcg.com/event/cardshow" target="_blank" rel="noreferrer">arvotcg.com/event/cardshow</a>
      </p>
      <CardShowManager
        initialSlots={rows}
        initialEvents={events.map((e) => ({
          date: e.date, title: e.title, venue: e.venue, hours: e.hours, badges: e.badges, note: e.note,
        }))}
      />
    </>
  );
}
