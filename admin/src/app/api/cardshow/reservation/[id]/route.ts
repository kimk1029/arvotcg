import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/cardshow/reservation/:id — 관리자가 예약을 취소한다.
 *
 * 사용자 본인 취소(server /api/cardshow/reserve DELETE)와 별개로, 확정·체크인된
 * 예약도 관리자가 지울 수 있어야 한다(노쇼 정리·중복 정리 등). 유저당 예약은 1건
 * (CardShowReservation.userId unique)이라 지우면 그 사용자는 다시 예약할 수 있다.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  try {
    await prisma.cardShowReservation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin.cardshow.reservation.DELETE]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

/** PATCH /api/cardshow/reservation/:id — { checkedIn: boolean } 입장 확정 토글. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { checkedIn?: boolean } | null;
  if (typeof body?.checkedIn !== 'boolean') {
    return NextResponse.json({ error: 'checkedIn(boolean) 필요' }, { status: 400 });
  }
  try {
    const row = await prisma.cardShowReservation.update({
      where: { id },
      data: { checkedInAt: body.checkedIn ? new Date() : null },
    });
    return NextResponse.json({ ok: true, checkedInAt: row.checkedInAt?.toISOString() ?? null });
  } catch (e) {
    console.error('[admin.cardshow.reservation.PATCH]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
