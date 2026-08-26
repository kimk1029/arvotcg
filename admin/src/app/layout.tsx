import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { SideNav } from '@/components/SideNav';
import { ADMIN_COOKIE, sessionWho } from '@/lib/adminSession';
import './globals.css';

export const metadata: Metadata = {
  title: 'ARVOTCG Admin',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // 소셜 로그인 세션이면 누구로 로그인했는지 사이드바에 표시.
  const who = await sessionWho(cookies().get(ADMIN_COOKIE)?.value);
  return (
    <html lang="ko">
      <body>
        <div className="admin-shell">
          <SideNav who={who} />
          <main className="admin-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
