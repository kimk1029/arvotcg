import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseShopInput } from '@/lib/shops';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const shops = await prisma.cardShop.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return NextResponse.json({ shops });
  } catch (err) {
    console.error('[admin.shops.GET]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const v = parseShopInput(body, false);
  if (v.ok === false) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const shop = await prisma.cardShop.create({
      data: {
        name: v.data.name!,
        addr: v.data.addr!,
        official: v.data.official ?? false,
        lat: v.data.lat ?? null,
        lng: v.data.lng ?? null,
        emoji: v.data.emoji ?? '🏪',
        gradFrom: v.data.gradFrom ?? '#ffb347',
        gradTo: v.data.gradTo ?? '#ff7a1f',
        tileColor: v.data.tileColor ?? '#ff9a33',
        oripaPct: v.data.oripaPct ?? 0,
        singleText: v.data.singleText ?? '',
        priceLevel: v.data.priceLevel ?? '보통',
        rating: v.data.rating ?? 0,
        reviewCount: v.data.reviewCount ?? 0,
        dist: v.data.dist ?? '',
        sortOrder: v.data.sortOrder ?? 50,
        active: v.data.active ?? true,
      },
    });
    return NextResponse.json({ shop }, { status: 201 });
  } catch (err) {
    console.error('[admin.shops.POST]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
