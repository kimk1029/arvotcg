import Link from 'next/link';
import { AppBar } from '@/components/ui/AppBar';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatusBar } from '@/components/ui/StatusBar';

export const dynamic = 'force-dynamic';

const MENU = [
  { lb: '히어로 배너 관리', href: '/admin/banners', em: '🎏', bg: '#FFD23F' },
  { lb: '오리파 티켓 히스토리', href: '/admin/oripa-tickets', em: '🎴', bg: '#3A5BD9' },
  { lb: '신고 · 차단 관리', href: '/admin/reports', em: '🚩', bg: '#F5333F' },
];

export default function AdminHomePage() {
  return (
    <>
      <StatusBar />
      <AppBar title="어드민" showBack backHref="/my" />
      <div style={{ height: 14 }} />

      <div className="sect">
        <SectionTitle title="콘텐츠" />
        {MENU.map((it) => (
          <Link key={it.href} href={it.href} className="my-item">
            <div className="mi-icon" style={{ background: it.bg }}>
              {it.em}
            </div>
            <div className="mi-main">{it.lb}</div>
            <span className="mi-arr">▶</span>
          </Link>
        ))}
      </div>

      <div className="bggap" />
    </>
  );
}
