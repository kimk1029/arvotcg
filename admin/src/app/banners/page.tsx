import { BannerManager, type BannerData } from '@/components/BannerManager';
import { prisma } from '@/lib/prisma';
import { HERO_AUTOPLAY_SETTING_KEY, clampHeroAutoplayMs } from '../../../../shared/heroBanner';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let banners: BannerData[] = [];
  let autoplayMs = clampHeroAutoplayMs(undefined);
  try {
    const [rows, setting] = await Promise.all([
      prisma.heroBanner.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      prisma.siteSetting.findUnique({ where: { key: HERO_AUTOPLAY_SETTING_KEY } }),
    ]);
    autoplayMs = clampHeroAutoplayMs(setting?.value);
    banners = rows.map((b) => ({
      id: b.id,
      sortOrder: b.sortOrder,
      slideClass: b.slideClass,
      badge: b.badge,
      title: b.title,
      sub: b.sub,
      ctaHint: b.ctaHint,
      visualType: b.visualType,
      visualValue: b.visualValue,
      onClick: b.onClick,
      linkUrl: b.linkUrl ?? null,
      active: b.active,
    }));
  } catch (e) {
    console.error('[admin.banners.page]', e);
  }

  return (
    <>
      <h1 className="admin-h1">히어로 배너</h1>
      <p className="admin-sub">
        홈 상단 배너 — 이미지/문구/연결 링크 관리. 비활성 배너는 홈에 노출되지 않습니다.
      </p>
      <BannerManager initialBanners={banners} initialAutoplayMs={autoplayMs} />
    </>
  );
}
