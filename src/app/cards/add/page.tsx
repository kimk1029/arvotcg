import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '내 카드 등록 · ARVOTCG',
  description: '카드를 검색하거나 스캔해 내 컬렉션에 등록합니다.',
};

export default function Page() {
  redirect('/cards/add/manual');
}
