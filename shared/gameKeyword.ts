/**
 * 게임(IP)별 스니덩크 목록 검색 키워드 — 정본.
 * 홈 HOT/랜딩/전체시세가 같은 키워드로 조회해 게임 선택이 화면 간 일관되게 이어진다.
 * 포켓몬은 브라우즈 기본 풀(SNKRDUNK_BROWSE_KEYWORD)이라 키가 없다.
 * 사용처: 웹 CleanHome·SnkrdunkLandingScreen·BrowseList, 앱 CleanHomeScreen·snkrdunk index/all.
 */
export const SNKRDUNK_GAME_KEYWORD: Partial<Record<string, string>> = {
  onepiece: 'ワンピースカード',
  yugioh: '遊戯王',
};
