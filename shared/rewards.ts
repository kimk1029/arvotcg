/** 활동별 포인트 보상 — 웹·모바일 공유 단일 소스. 클라이언트에서 사용 (mock). */

export const REWARDS = {
  /** 커뮤니티 글 작성 */
  feed_general: 10,
  /** 거래글 등록 */
  trade_post: 10,
  /** 거래 완료 처리 (판매자 기준) */
  trade_done: 50,
  /** 오리파 뽑기 실패 위로금 (S/A 외) */
  oripa_consol: 0,
  /** 하루 1회 출석 보상 (KST 기준 일자 변경 시) */
  login_daily: 10,
  /** 3일 연속 출석마다 추가 보너스 (3,6,9,...일 차) */
  login_streak3_bonus: 50,
} as const;

/** PointLog.reason → 알림 목록에 보여줄 한글 라벨 (웹·앱 공용). */
export const POINT_REASON_LABELS: Record<string, string> = {
  feed_general: '커뮤니티 글 작성',
  trade_post: '거래글 등록',
  trade_done: '거래 완료',
  login_daily: '출석 체크',
  login_streak3_bonus: '3일 연속 출석 보너스',
  oripa_consol: '오리파 위로금',
  oripa_pull: '오리파 뽑기',
  shop_buy: '상점 아이템 구매',
  manual_spend: '포인트 사용',
};

/** PointLog.reason → 알림 아이콘 이모지 (웹·앱 공용). */
export const POINT_REASON_EMOJI: Record<string, string> = {
  feed_general: '💬',
  trade_post: '🤝',
  trade_done: '🎉',
  login_daily: '📅',
  login_streak3_bonus: '🔥',
  oripa_consol: '🎁',
  oripa_pull: '🎰',
  shop_buy: '🛍️',
  manual_spend: '🪙',
};
