import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** PATCH /api/cardshow/:id — { capacity?, active? } */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { capacity?: number; active?: boolean } | null;
  const data: { capacity?: number; active?: boolean } = {};
  if (body?.capacity !== undefined) {
    if (!Number.isInteger(body.capacity) || body.capacity < 1 || body.capacity > 999) {
      return NextResponse.json({ error: '정원은 1~999' }, { status: 400 });
    }
    data.capacity = body.capacity;
  }
  if (typeof body?.active === 'boolean') data.active = body.active;
  try {
    const row = await prisma.cardShowSlot.update({ where: { id }, data });
    return NextResponse.json({ ok: true, slot: row });
  } catch (e) {
    console.error('[admin.cardshow.PATCH]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

/** DELETE /api/cardshow/:id — 슬롯 삭제 (예약도 함께 삭제됨) */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  try {
    await prisma.cardShowSlot.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin.cardshow.DELETE]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
