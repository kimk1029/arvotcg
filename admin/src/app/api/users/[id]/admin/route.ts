import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 회원 관리 — 어드민 권한 부여/해제 (User.isAdmin).
 * 권한이 있으면 admin.arvotcg.com 에서 소셜 로그인으로 접근할 수 있다.
 * 이 라우트 자체는 미들웨어의 어드민 세션 검사를 통과해야 도달한다.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = (await req.json().catch(() => null)) as { isAdmin?: unknown } | null;
  if (typeof body?.isAdmin !== 'boolean') {
    return NextResponse.json({ error: 'isAdmin(boolean) required' }, { status: 400 });
  }
  try {
    const u = await prisma.user.update({
      where: { id },
      data: { isAdmin: body.isAdmin },
      select: { id: true, isAdmin: true },
    });
    return NextResponse.json({ ok: true, user: u });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
