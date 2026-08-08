import { HomeRouter } from '@/components/dashboard/HomeRouter';
import { getServerUser, serverFetch } from '@/lib/apiServer';
import type { HeroSlideData } from '@/components/HeroSlider';

export const dynamic = 'force-dynamic';

/**
 * 홈 — 서버는 세션·배너만 준비한다 (2026-08 진입속도 개선).
 * HOT 카드·인기 박스는 CleanHome 이 클라이언트에서 직접 조회 (앱 CleanHomeScreen 동일 컨셉).
 * 이전의 서버측 browse+상세 40여 회 조회가 홈 TTFB 를 수 초 지연시키던 것을 제거.
 * (cards/mvcAuctions prop 은 CleanHome 이 사용하지 않는 레거시 입력이라 빈 값으로 전달.)
 */
export default async function Page() {
  const [user, bannersResp] = await Promise.all([
    getServerUser(),
    serverFetch<{ data: HeroSlideData[] }>('/api/banners', { auth: false }),
  ]);

  return (
    <HomeRouter
      cards={[]}
      heroBanners={bannersResp.data?.data ?? []}
      isLoggedIn={Boolean(user?.id)}
      snkrdunkRows={[]}
      snkrdunkBoxRows={[]}
      mvcAuctions={[]}
    />
  );
}
