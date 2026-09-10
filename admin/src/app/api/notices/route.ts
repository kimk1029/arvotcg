import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseNoticeInput } from '@/lib/notices';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const notices = await prisma.notice.findMany({
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
    });
    return NextResponse.json({ notices });
  } catch (err) {
    console.error('[admin.notices.GET]', err);
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
  const v = parseNoticeInput(body, false);
  if (v.ok === false) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const notice = await prisma.notice.create({
      data: {
        title: v.data.title!,
        body: v.data.body ?? '',
        tag: v.data.tag ?? null,
        pinned: v.data.pinned ?? false,
        published: v.data.published ?? true,
        publishedAt: v.data.publishedAt!,
      },
    });
    return NextResponse.json({ notice }, { status: 201 });
  } catch (err) {
    console.error('[admin.notices.POST]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
