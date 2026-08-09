import { redirect } from 'next/navigation';
import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { getServerUser, serverFetch } from '@/lib/apiServer';
import { BlockList, type BlockedUser } from '@/components/BlockList';

export const dynamic = 'force-dynamic';

/** /my/blocks — 차단 관리 (App Store 심사 지침 1.2). 앱 mobile/app/my/blocks.tsx 와 페어. */
export default async function Page() {
  const user = await getServerUser();
  if (!user?.id) redirect('/my');

  const r = await serverFetch<{ data: BlockedUser[] }>('/api/me/blocks');
  const blocks = r.data?.data ?? [];

  return (
    <>
      <StatusBar />
      <AppBar title="차단 관리" showBack backHref="/my" />
      <BlockList initialBlocks={blocks} />
      <div className="bggap" />
    </>
  );
}
