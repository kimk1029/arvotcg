import { LoginRequired } from '@/components/LoginRequired';
import { NotificationsScreen } from '@/components/screens/NotificationsScreen';
import { getServerUser } from '@/lib/apiServer';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getServerUser();
  if (!user?.id) {
    return (
      <LoginRequired
        title="알림"
        message="알림은 로그인 후 이용 가능합니다"
        callbackUrl="/my/notifications"
      />
    );
  }
  return <NotificationsScreen />;
}
