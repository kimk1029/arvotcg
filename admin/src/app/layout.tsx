import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SideNav } from '@/components/SideNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'ARVOTCG Admin',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="admin-shell">
          <SideNav />
          <main className="admin-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
