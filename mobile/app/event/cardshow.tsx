/** /event/cardshow — 카드쇼 사전예약 웹뷰 (공용 EventWebView, 설정 shared/eventPages.ts). */
import { EventWebView } from '@/components/EventWebView';

export default function CardShowScreen() {
  return <EventWebView eventKey="cardshow" />;
}
