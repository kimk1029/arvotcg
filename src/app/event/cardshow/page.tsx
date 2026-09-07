import type { Metadata } from 'next';
import { EventReserveScreen } from '@/components/event/EventReserveScreen';

export const metadata: Metadata = {
  title: '카드쇼 사전예약',
  description: 'ARVOTCG 카드쇼 방문 시간대를 예약하세요.',
  robots: { index: false },
};

/** 카드쇼 사전예약 — 화면은 트레이드 데이와 공용(EventReserveScreen), 설정은 shared/eventPages.ts. */
export default function Page() {
  return <EventReserveScreen eventKey="cardshow" />;
}
