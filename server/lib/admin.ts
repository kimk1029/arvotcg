import { prisma } from './prisma.js';

/** 어드민 이메일 판별 — ADMIN_EMAILS(쉼표 구분) env 기준. */
export function adminEmailSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmailSet().has(email.toLowerCase());
}

/**
 * 최종 어드민 판정 — ADMIN_EMAILS env ∪ User.isAdmin(어드민 회원 관리에서 부여).
 * env 는 부트스트랩용(최초 관리자), 실운영 권한 부여는 DB 플래그로 한다.
 */
export async function isAdminUser(userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isAdmin: true },
    });
    if (!u) return false;
    return u.isAdmin || isAdminEmail(u.email);
  } catch {
    return false;
  }
}
