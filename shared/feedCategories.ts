/**
 * 커뮤니티 피드 글 카테고리 — 웹·앱 글쓰기 픽커/피드 필터와 서버 검증의 단일 소스.
 * '전체'는 필터 전용 가상 탭, '거래/나눔'은 마켓(거래글) 탭 전용이라 여기 포함하지 않는다.
 */
export const FEED_CATEGORIES = ['자유', '시세/정보', '자랑'] as const;

export type FeedCategory = (typeof FEED_CATEGORIES)[number];

export const DEFAULT_FEED_CATEGORY: FeedCategory = '자유';

export function isFeedCategory(v: unknown): v is FeedCategory {
  return typeof v === 'string' && (FEED_CATEGORIES as readonly string[]).includes(v);
}
