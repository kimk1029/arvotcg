import type { Metadata } from 'next';
import { EventReserveScreen } from '@/components/event/EventReserveScreen';

export const metadata: Metadata = {
  title: '트레이드 데이 사전예약',
  description: '제 1회 ARVOTCG 트레이드 데이 — 1부/2부 회차를 예약하세요.',
  robots: { index: false },
};

/** 트레이드 데이 사전예약 — 카드쇼와 같은 화면(EventReserveScreen)에 night 테마·1부/2부 회차·운영 안내 박스. */
export default function Page() {
  return <EventReserveScreen eventKey="tradeday" />;
}
