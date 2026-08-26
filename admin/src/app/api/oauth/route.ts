import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, createSessionToken } from '@/lib/adminSession';
import { prisma } from '@/lib/prisma';

/**
 * 소셜 로그인 세션 교환 — API 서버가 OAuth 성공 후
 * `/api/oauth?token=<세션 JWT>` 로 리다이렉트해 온다.
 *
 * 토큰만 믿지 않고 여기서 다시 확인한다:
 *   1) API 서버 /auth/me 로 토큰 → 사용자 신원 확인
 *   2) DB 에서 해당 사용자의 어드민 권한 재확인 (User.isAdmin ∪ ADMIN_EMAILS)
 * 둘 다 통과해야 어드민 세션 쿠키를 발급한다.
 */
const API_ORIGIN = process.env.ADMIN_API_ORIGIN ?? 'https://api.arvotcg.com';

function adminEmailSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));

  if (!token) return fail('notoken');

  let userId: string | null = null;
  try {
    const r = await fetch(`${API_ORIGIN}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!r.ok) return fail('invalid');
    const j = (await r.json()) as { user?: { id?: string } | null };
    userId = j.user?.id ?? null;
  } catch {
    return fail('apidown');
  }
  if (!userId) return fail('invalid');

  const u = await prisma.user
    .findUnique({ where: { id: userId }, select: { name: true, email: true, isAdmin: true } })
    .catch(() => null);
  if (!u) return fail('invalid');
  if (!u.isAdmin && !(u.email && adminEmailSet().has(u.email.toLowerCase()))) {
    return fail('forbidden');
  }

  const res = NextResponse.redirect(new URL('/', url.origin));
  res.cookies.set(ADMIN_COOKIE, await createSessionToken(u.email ?? u.name ?? userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
