import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getServerUser } from '@/lib/apiServer';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser();
  // 미로그인 → 로그인으로. 로그인했지만 관리자 아님 → 홈으로.
  // (관리자 아님을 /login 으로 보내면 로그인 페이지가 다시 /admin 으로 돌려보내
  //  무한 리다이렉트 루프가 됐다.)
  if (!user) {
    redirect('/login?callbackUrl=/admin');
  }
  const email = user.email?.toLowerCase();
  if (!email || !ADMIN_EMAILS.has(email)) {
    redirect('/');
  }
  return <>{children}</>;
}
