/**
 * 내 카드 등록 — 이 경로가 유일한 등록 화면이다.
 *
 * 예전엔 /cards/add 가 /cards/add/manual 로 리다이렉트했는데, 뒤로가기를 누르면
 * /cards/add 로 돌아왔다가 다시 앞으로 밀려나 이전 화면으로 못 나가는 덫이 됐다.
 * 그래서 중간 홉을 없애고 폼을 여기로 옮겼다 (2026-09-06).
 */
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
        callbackUrl="/cards/add"
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
