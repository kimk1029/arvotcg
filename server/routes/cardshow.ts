import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/requireAuth.js';
import { defaultNameFor } from '../lib/defaultName.js';

/**
 * 카드쇼 예약 이벤트 API — 웹 /event/cardshow (브라우저 쿠키 또는 앱 웹뷰의
 * Bearer 토큰)에서 사용. 슬롯/정원은 어드민(admin.arvotcg.com)에서 관리.
 * 정책: 유저당 예약 1건 — 다른 슬롯을 예약하면 기존 예약이 이동한다.
 */
const router = Router();

/** GET /api/cardshow/slots — 활성 슬롯 + 잔여석, 로그인 시 내 예약 포함. */
router.get('/slots', optionalAuth, async (req: Request, res: Response) => {
  try {
    const [slots, events] = await Promise.all([
      prisma.cardShowSlot.findMany({
        where: { active: true },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        include: { _count: { select: { reservations: true } } },
      }),
      // 날짜별 행사 정보(행사명·장소·시간 등) — 어드민에서 관리. 없는 날짜는 웹이 기본값.
      prisma.cardShowEvent.findMany({ orderBy: { date: 'asc' } }),
    ]);
    const userId = req.user?.userId ?? null;
    const mine = userId
      ? await prisma.cardShowReservation.findUnique({
          where: { userId },
          select: {
            slotId: true,
            createdAt: true,
            checkedInAt: true,
            slot: { select: { id: true, date: true, time: true, capacity: true } },
          },
        })
      : null;
    res.json({
      loggedIn: Boolean(userId),
      mySlotId: mine?.slotId ?? null,
      myReservation: mine
        ? {
            slotId: mine.slotId,
            reservedAt: mine.createdAt.toISOString(),
            checkedInAt: mine.checkedInAt?.toISOString() ?? null,
            slot: mine.slot,
          }
        : null,
      slots: slots.map((s) => ({
        id: s.id,
        date: s.date,
        time: s.time,
        capacity: s.capacity,
        reserved: s._count.reservations,
        remaining: Math.max(0, s.capacity - s._count.reservations),
      })),
      events: events.map((e) => ({
        date: e.date,
        title: e.title,
        venue: e.venue,
        hours: e.hours,
        // 쉼표 구분 문자열 → 배열. 빈 값은 버린다.
        badges: e.badges.split(',').map((b) => b.trim()).filter(Boolean),
        note: e.note,
      })),
    });
  } catch (err) {
    console.error('[cardshow.slots]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** POST /api/cardshow/reserve { slotId } — 예약(기존 예약은 이동). */
router.post('/reserve', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const slotId = Number((req.body as { slotId?: unknown } | null)?.slotId);
  if (!Number.isInteger(slotId) || slotId <= 0) {
    return res.status(400).json({ error: 'slotId 필요' });
  }
  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: defaultNameFor(userId) },
    });
    const result = await prisma.$transaction(async (tx) => {
      const slot = await tx.cardShowSlot.findUnique({
        where: { id: slotId },
        include: { _count: { select: { reservations: true } } },
      });
      if (!slot || !slot.active) return { status: 404 as const, error: '존재하지 않는 시간대예요' };
      const existing = await tx.cardShowReservation.findUnique({ where: { userId } });
      if (existing?.checkedInAt) {
        return { status: 409 as const, error: '이미 입장 완료된 예약은 변경할 수 없어요' };
      }
      if (existing?.slotId === slotId) return { status: 200 as const, slotId };
      // 정원 체크 (내 기존 예약이 같은 슬롯이 아닐 때만 잔여 필요)
      if (slot._count.reservations >= slot.capacity) {
        return { status: 409 as const, error: '해당 시간대는 마감되었어요' };
      }
      await tx.cardShowReservation.upsert({
        where: { userId },
        update: { slotId, createdAt: new Date() },
        create: { userId, slotId },
      });
      return { status: 201 as const, slotId, moved: Boolean(existing) };
    });
    if ('error' in result) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json({ ok: true, slotId: result.slotId, moved: (result as { moved?: boolean }).moved ?? false });
  } catch (err) {
    console.error('[cardshow.reserve]', userId, slotId, err);
    res.status(500).json({ error: 'internal' });
  }
});

/** DELETE /api/cardshow/reserve — 내 예약 취소. */
router.delete('/reserve', requireAuth, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.cardShowReservation.findUnique({ where: { userId: req.user!.userId } });
    if (existing?.checkedInAt) {
      return res.status(409).json({ error: '이미 입장 완료된 예약은 취소할 수 없어요' });
    }
    await prisma.cardShowReservation.deleteMany({ where: { userId: req.user!.userId } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[cardshow.cancel]', err);
    res.status(500).json({ error: 'internal' });
  }
});

/** POST /api/cardshow/check-in — 현장에서 내 예약 화면을 담당자가 확인한 뒤 입장 완료 처리. */
router.post('/check-in', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    const reservation = await prisma.cardShowReservation.findUnique({ where: { userId } });
    if (!reservation) return res.status(404).json({ error: '예약 내역이 없어요' });
    if (reservation.checkedInAt) {
      return res.json({ ok: true, checkedInAt: reservation.checkedInAt.toISOString(), alreadyCheckedIn: true });
    }
    const updated = await prisma.cardShowReservation.update({
      where: { userId },
      data: { checkedInAt: new Date() },
      select: { checkedInAt: true },
    });
    res.json({ ok: true, checkedInAt: updated.checkedInAt!.toISOString() });
  } catch (err) {
    console.error('[cardshow.check-in]', userId, err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
