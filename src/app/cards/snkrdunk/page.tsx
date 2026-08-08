import { SnkrdunkLandingScreen } from '@/components/SnkrdunkLandingScreen';

/**
 * /cards/snkrdunk — 스니덩크 시세 랜딩.
 * 서버 조회(브라우즈+상세 13회)로 응답이 느리던 것을 클라이언트 화면으로 교체 —
 * 홈 HOT 목록 공유 캐시(homeHotCache)를 그대로 재사용해 홈과 같은 목록이 즉시 뜬다.
 * 'SNKRDUNK 일본시세' 히어로 배너는 제거(2026-08-09 사용자 요청).
 */
export default function Page() {
  return <SnkrdunkLandingScreen />;
}
