import { LoginRequired } from '@/components/LoginRequired';
import { ManualAddForm } from '@/components/ManualAddForm';
import { StatusBar } from '@/components/ui/StatusBar';
import { getServerUser } from '@/lib/apiServer';
import { CARDS_CATALOG } from '@/lib/cardsCatalog';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '내 카드 등록 · ARVOTCG',
  description: '카드이름·세트코드·카드번호 중 하나만 있어도 검색해 내 컬렉션에 등록합니다.',
};

export default async function Page() {
  const user = await getServerUser();
  if (!user?.id) {
    return (
      <LoginRequired
        title="내 카드 등록"
        message="카드를 등록하려면 로그인해주세요"
        callbackUrl="/cards/add/manual"
      />
    );
  }

  const catalog = CARDS_CATALOG.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    grade: c.grade,
  }));

  return (
    <>
      <StatusBar />
      <ManualAddForm catalog={catalog} />
    </>
  );
}
