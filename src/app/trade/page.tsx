import type { Metadata } from 'next';
import { TradeScreen } from '@/components/screens/TradeScreen';
import { serverFetch } from '@/lib/apiServer';
import type { Trade } from '@/lib/types';

export const metadata: Metadata = {
  title: '카드 거래',
  description:
    '포켓몬 TCG 카드 직거래·택배거래 장터 — 팝니다·삽니다 글을 실시간으로 확인하세요.',
  alternates: { canonical: '/trade' },
  openGraph: {
    title: '카드 거래 · 아르보TCG',
    description: '포켓몬 TCG 카드 직거래·택배거래 장터',
    url: '/trade',
  },
};

export const revalidate = 30;

export default async function Page() {
  // 세션 쿠키 포워딩 — 차단한 작성자 글 숨김 필터 적용.
  const r = await serverFetch<{ data: Trade[] }>('/api/trades?limit=60');
  const trades = r.data?.data ?? [];
  return <TradeScreen trades={trades} />;
}
