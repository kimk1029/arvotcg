import type { Metadata } from 'next';
import { CardShowScreen } from './CardShowScreen';

export const metadata: Metadata = {
  title: '카드쇼 사전예약',
  description: 'ARVOTCG 카드쇼 방문 시간대를 예약하세요.',
  robots: { index: false },
};

export default function Page() {
  return <CardShowScreen />;
}
