import { LoginRequired } from '@/components/LoginRequired';
import { WriteScreen } from '@/components/screens/WriteScreen';
import { getServerUser, serverFetch } from '@/lib/apiServer';
import { findCardEntry } from '@/lib/cardsCatalog';
import { isFeedCategory } from '@/lib/feedCategories';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: { cardId?: string; userCardId?: string; category?: string };
}

interface UserCardRow {
  id: number;
  userId: string;
  cardId: string | null;
  nickname: string | null;
  gradeEstimate: string | null;
  memo: string | null;
}

export default async function Page({ searchParams }: Props) {
  const user = await getServerUser();
  if (!user?.id) {
    return (
      <LoginRequired
        title="커뮤니티 글 작성"
        message="글 작성은 로그인 후 가능합니다"
        callbackUrl="/write/feed"
      />
    );
  }

  const prefill = await resolvePrefill(searchParams);
  // 피드에서 보고 있던 탭(?category=카드쇼)을 기본 카테고리로 — 앱 write/feed 동일.
  const category = isFeedCategory(searchParams.category) ? searchParams.category : undefined;
  return <WriteScreen mode="feed" prefill={prefill || category ? { ...prefill, category } : undefined} />;
}

async function resolvePrefill(
  sp: { cardId?: string; userCardId?: string },
): Promise<{ body: string } | undefined> {
  if (sp.userCardId) {
    const id = Number(sp.userCardId);
    if (!Number.isFinite(id)) return undefined;
    const r = await serverFetch<{ data: UserCardRow }>(`/api/me/cards/${id}`);
    const row = r.data?.data;
    if (!row) return undefined;
    const entry = row.cardId ? findCardEntry(row.cardId) : undefined;
    const name = row.nickname || entry?.name || '내 카드';
    const grade = row.gradeEstimate ? ` (${row.gradeEstimate})` : '';
    return { body: `${name}${grade} 자랑하러 왔어요 🃏\n` };
  }
  if (sp.cardId) {
    const entry = findCardEntry(sp.cardId);
    if (!entry) return undefined;
    return { body: `${entry.name} 관련 글\n` };
  }
  return undefined;
}
