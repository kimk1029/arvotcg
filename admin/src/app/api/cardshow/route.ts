import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** POST /api/cardshow — 슬롯 일괄 생성 { date, times: ["10:00",...], capacity } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    date?: string;
    times?: string[];
    capacity?: number;
  } | null;
  const date = (body?.date ?? '').trim();
  const times = (body?.times ?? []).map((t) => t.trim()).filter((t) => /^\d{2}:\d{2}$/.test(t));
  const capacity = Number(body?.capacity);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: '날짜는 YYYY-MM-DD' }, { status: 400 });
  if (times.length === 0) return NextResponse.json({ error: '시간(HH:mm)을 1개 이상 입력' }, { status: 400 });
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 999) {
    return NextResponse.json({ error: '정원은 1~999' }, { status: 400 });
  }
  try {
    const created = await prisma.$transaction(
      times.map((time) =>
        prisma.cardShowSlot.upsert({
          where: { date_time: { date, time } },
          update: { capacity, active: true },
          create: { date, time, capacity },
        }),
      ),
    );
    return NextResponse.json({ ok: true, count: created.length });
  } catch (e) {
    console.error('[admin.cardshow.POST]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
