import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_NOTICES } from '@/lib/notices';

export const dynamic = 'force-dynamic';

/** DB 가 비어있을 때만, 예전에 웹·앱에 하드코딩돼 있던 공지를 옮겨 넣는다. */
export async function POST() {
  try {
    const existing = await prisma.notice.count();
    if (existing > 0) return NextResponse.json({ created: 0, existing });
    const result = await prisma.notice.createMany({ data: DEFAULT_NOTICES.map((n) => ({ ...n })) });
    return NextResponse.json({ created: result.count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin.notices.seed]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
