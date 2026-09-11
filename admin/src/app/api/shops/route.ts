import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateShopsCache } from '@/lib/shopsCache';
import { parseShopInput, shopCreateData } from '@/lib/shops';

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
    const shop = await prisma.cardShop.create({ data: shopCreateData(v.data) });
    await invalidateShopsCache();
    return NextResponse.json({ shop }, { status: 201 });
  } catch (err) {
    console.error('[admin.shops.POST]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
