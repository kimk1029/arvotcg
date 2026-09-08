/**
 * 일러스트레이터 검색 결과(TCGdex 카드) → 스니덩크 시세상세 연결 규칙 (웹 IllustratorCardTile ↔ 앱 IllustratorPanel).
 *
 * TCGdex 카드는 세트코드('SV9')·번호('039')만 있고 apparelId 가 없다. 탭하면
 * /api/snkrdunk/by-code 로 apparelId 를 찾아 시세상세로 가고, 못 찾으면 코드 검색 목록으로 보낸다.
 */
export interface IllustratorCardCode {
  setCode?: string | null;
  number?: string | null;
}

/** by-code 조회 파라미터. 세트코드나 번호가 없으면 null(연결 불가 → 검색 목록 폴백도 불가). */
export function illustratorCardCode(c: IllustratorCardCode): { setCode: string; number: string } | null {
  const setCode = (c.setCode ?? '').trim();
  const number = (c.number ?? '').trim().split('/')[0];
  return setCode && number ? { setCode, number } : null;
}

/** 스니덩크 코드 검색어 — 직접입력·스캔과 같은 "세트코드 번호" 형식. */
export function illustratorSearchQuery(c: IllustratorCardCode): string {
  const code = illustratorCardCode(c);
  return code ? `${code.setCode} ${code.number}` : '';
}

/** by-code 응답에서 시세상세로 보낼 apparelId — 서버가 코드 일치만 돌려주므로 첫 건. */
export function pickApparelIdByCode(cards: ReadonlyArray<{ apparelId: number }>): number | null {
  const id = cards[0]?.apparelId;
  return typeof id === 'number' && id > 0 ? id : null;
}
