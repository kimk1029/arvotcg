import type { Metadata } from 'next';
import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { JsonLd } from '@/components/JsonLd';
import { absUrl } from '@/lib/seo';
import { serverFetch } from '@/lib/apiServer';
import { SNKRDUNK_GAME_KEYWORD } from '../../../../../shared/gameKeyword';
import { BrowseList, type BrowseItem } from './BrowseList';

export const revalidate = 600;

export const metadata: Metadata = {
  title: '스니덩크 전체 시세',
  description:
    '포켓몬 TCG 카드 전체 시세를 한 곳에서 — snkrdunk 기준 실시간 카드 가격 목록을 둘러보세요.',
  alternates: { canonical: '/cards/snkrdunk/all' },
  openGraph: {
    title: '스니덩크 전체 시세 · 아르보TCG',
    description: '포켓몬 TCG 카드 전체 시세 목록 (snkrdunk 기준)',
    url: '/cards/snkrdunk/all',
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  // 홈에서 선택한 게임(IP)이 ?game= 으로 이어진다 — 포켓몬은 브라우즈, 그 외는 키워드 검색.
  const sp = await searchParams;
  const game = sp?.game ?? 'pokemon';
  const kw = SNKRDUNK_GAME_KEYWORD[game];
  // 첫 페이지는 서버에서 받아 SSR — 검색엔진 인덱싱·초기 페인트용. 이후는 클라이언트 무한스크롤.
  const r = await serverFetch<{ page?: number; results: BrowseItem[] }>(
    kw ? `/api/snkrdunk/search?q=${encodeURIComponent(kw)}` : '/api/snkrdunk/browse?page=1',
    { auth: false },
  );
  const initialItems = r.data?.results ?? [];

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '카드', item: absUrl('/cards') },
            { '@type': 'ListItem', position: 2, name: '스니덩크 시세', item: absUrl('/cards/snkrdunk') },
            { '@type': 'ListItem', position: 3, name: '전체 시세', item: absUrl('/cards/snkrdunk/all') },
          ],
        }}
      />
      <StatusBar />
      <AppBar title="스니덩크 전체 시세" showBack backHref="/cards/snkrdunk" />

      <div style={{ height: 14 }} />

      <BrowseList initialItems={initialItems} game={game} />

      <div style={{ height: 80 }} />
    </>
  );
}
