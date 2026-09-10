/** 컬렉션 목록 행 배지 — 언어판 라벨. 웹 CollectionScreen ↔ 앱 my/cards 공통. */
export function regionBadge(region: string | null | undefined): string | null {
  if (region === 'jp') return '일판';
  if (region === 'kr') return '한판';
  if (region === 'en') return '영판';
  return null;
}
