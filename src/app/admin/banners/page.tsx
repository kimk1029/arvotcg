import { AdminBannerList } from '@/components/admin/AdminBannerList';
import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { serverFetch } from '@/lib/apiServer';
import { HERO_AUTOPLAY_DEFAULT_MS } from '../../../../shared/heroBanner';

export const dynamic = 'force-dynamic';

interface BannerRow {
  id: number;
  sortOrder: number;
  slideClass: string;
  badge: string;
  title: string;
  sub: string;
  ctaHint: string | null;
  visualType: string;
  visualValue: string;
  onClick: string | null;
  linkUrl: string | null;
  active: boolean;
}

export default async function AdminBannersPage() {
  const [r, st] = await Promise.all([
    serverFetch<{ banners: BannerRow[] }>('/api/admin/banners'),
    serverFetch<{ autoplayMs: number }>('/api/admin/banners/settings'),
  ]);
  const banners = r.data?.banners ?? [];
  const autoplayMs = st.data?.autoplayMs ?? HERO_AUTOPLAY_DEFAULT_MS;

  return (
    <>
      <StatusBar />
      <AppBar title="히어로 배너 관리" showBack backHref="/admin" />
      <div style={{ height: 14 }} />
      <AdminBannerList initialBanners={banners} initialAutoplayMs={autoplayMs} />
      <div className="bggap" />
    </>
  );
}
