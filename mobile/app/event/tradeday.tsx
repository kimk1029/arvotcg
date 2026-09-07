/** /event/tradeday — 트레이드 데이 사전예약 웹뷰 (공용 EventWebView, 설정 shared/eventPages.ts). */
import { EventWebView } from '@/components/EventWebView';

export default function TradeDayScreen() {
  return <EventWebView eventKey="tradeday" />;
}
