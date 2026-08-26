import { LoginRequired } from '@/components/LoginRequired';
import { MyScreen } from '@/components/screens/MyScreen';
import { getServerUser, serverFetch } from '@/lib/apiServer';
import type { LevelInfo } from '@/lib/level';
import type { InventorySnapshot } from '@/components/InventoryProvider';

interface SummaryResp {
  user: { id: string; name: string | null; email: string | null; isAdmin?: boolean };
  inventory: InventorySnapshot;
  level: LevelInfo;
  counts: { tradeCount: number; savedCount: number; cardCount: number };
}

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getServerUser();
  // 미로그인 — 컬렉션(/my/cards)과 동일한 로그인 안내 화면
  if (!user?.id) {
    return (
      <LoginRequired
        title="마이페이지"
        message="프로필 · 마이페이지는 로그인 후 이용 가능합니다"
        callbackUrl="/my"
      />
    );
  }
  const r = await serverFetch<SummaryResp>('/api/me/summary');
  const s = r.data;
  if (!s) {
    return (
      <LoginRequired
        title="마이페이지"
        message="잠시 후 다시 시도해주세요"
        callbackUrl="/my"
      />
    );
  }
  return (
    <MyScreen
      user={s.user}
      level={s.level}
      points={s.inventory?.points ?? 0}
      cardCount={s.counts.cardCount}
      tradeCount={s.counts.tradeCount}
      savedCount={s.counts.savedCount}
      isAdmin={s.user.isAdmin}
    />
  );
}
