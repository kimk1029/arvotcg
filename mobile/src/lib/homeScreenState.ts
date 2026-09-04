/**
 * 홈 화면 상태 스냅샷 — 뒤로가기 복귀 시 "보던 자리" 복원용 (웹 src/lib/homeScreenState.ts 페어).
 *
 * expo-router 루트가 `<Slot/>` 이라 홈은 상세로 나갈 때 언마운트되고 돌아오면 새로 마운트된다
 * (_layout.tsx 주석 참조 — 네이티브 Stack 은 터치 버그로 제외). 그래서 스크롤 위치·게임 칩·
 * 하단 랭킹 탭·점진 채움된 대표가/등락률처럼 컴포넌트 useState 에만 있던 값을 모듈 메모리에
 * 보관했다가 다음 마운트에서 시드로 쓴다. 섹션 데이터 자체(HOT/박스 행)는 swr 캐시가 담당.
 *
 * 메모리 전용(디스크 X) — 앱 재시작 후엔 항상 맨 위에서 시작하는 게 맞다.
 */

export interface HomeScreenSnapshot {
  homeGame: string;
  moverTab: string;
  scrollY: number;
  rankRows: Record<string, unknown[]>;
  priceById: Record<number, number>;
  changeById: Record<number, number>;
  basisById: Record<number, string>;
}

/** 이보다 오래된 스냅샷은 버린다 — 한참 뒤 복귀는 새 홈으로. */
const TTL_MS = 15 * 60_000;

let snap: Partial<HomeScreenSnapshot> | null = null;
let savedAt = 0;

/** 유효한 스냅샷(없거나 만료면 null). */
export function peekHomeState(): Partial<HomeScreenSnapshot> | null {
  if (!snap) return null;
  if (Date.now() - savedAt > TTL_MS) {
    snap = null;
    return null;
  }
  return snap;
}

/** 일부 필드만 갱신 — 값이 바뀔 때마다 호출해도 싸다(얕은 병합). */
export function patchHomeState(patch: Partial<HomeScreenSnapshot>): void {
  snap = { ...(snap ?? {}), ...patch };
  savedAt = Date.now();
}
