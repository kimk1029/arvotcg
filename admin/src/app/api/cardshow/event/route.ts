import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/cardshow/event — 날짜별 카드쇼 행사 정보 저장(upsert).
 * body: { date, title?, venue?, hours?, badges?, note? }
 * 슬롯(CardShowSlot)과 별개로 날짜 하나당 1건. 비운 필드는 빈 문자열로 저장되고,
 * 웹은 빈 값이면 기본 문구/슬롯 파생값으로 대체한다.
 */
const LIMITS: Record<string, number> = { title: 80, venue: 120, hours: 40, badges: 80, note: 200 };

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = String(body?.date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '날짜는 YYYY-MM-DD' }, { status: 400 });
  }

  const data: Record<string, string> = {};
  for (const key of ['title', 'venue', 'hours', 'badges', 'note'] as const) {
    if (body?.[key] === undefined) continue;
    const v = String(body[key]).trim();
    if (v.length > LIMITS[key]) {
      return NextResponse.json({ error: `${key} 은 ${LIMITS[key]}자 이내` }, { status: 400 });
    }
    data[key] = v;
  }

  try {
    const row = await prisma.cardShowEvent.upsert({
      where: { date },
      update: data,
      create: { date, ...data },
    });
    return NextResponse.json({ ok: true, event: row });
  } catch (e) {
    console.error('[admin.cardshow.event.PUT]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

/** DELETE /api/cardshow/event?date=YYYY-MM-DD — 행사 정보 삭제(웹은 기본 문구로 돌아감). */
export async function DELETE(req: Request) {
  const date = new URL(req.url).searchParams.get('date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '날짜는 YYYY-MM-DD' }, { status: 400 });
  }
  try {
    await prisma.cardShowEvent.deleteMany({ where: { date } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin.cardshow.event.DELETE]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
