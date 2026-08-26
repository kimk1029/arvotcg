import { LoginRequired } from '@/components/LoginRequired';
import { PortfolioScreen } from '@/components/screens/PortfolioScreen';
import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { getServerUser } from '@/lib/apiServer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '포트폴리오 · ARVOTCG',
  description: '내 컬렉션을 주식처럼 — 평가액·등락률·일별 차트로 봅니다.',
};

export default async function Page() {
  const user = await getServerUser();
  if (!user?.id) {
    return (
      <LoginRequired
        title="포트폴리오"
        message="내 포트폴리오를 보려면 로그인해주세요"
        callbackUrl="/my/portfolio"
      />
    );
  }

  return (
    <>
      <StatusBar />
      <AppBar title="포트폴리오" showBack backHref="/my" />
      <PortfolioScreen />
      <div className="bggap" />
    </>
  );
}
