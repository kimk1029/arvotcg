import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** 버그 제보 처리 상태 토글 — 'open' | 'done'. 어드민 세션 미들웨어를 통과해야 도달한다. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  const status = body?.status === 'done' ? 'done' : body?.status === 'open' ? 'open' : null;
  if (!status) return NextResponse.json({ error: "status must be 'open' | 'done'" }, { status: 400 });
  try {
    const row = await prisma.bugReport.update({ where: { id }, data: { status }, select: { id: true, status: true } });
    return NextResponse.json({ ok: true, report: row });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
