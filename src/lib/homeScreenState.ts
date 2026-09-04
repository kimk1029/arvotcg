/**
 * 홈 화면 상태 스냅샷 — 뒤로가기 복귀 시 "보던 자리" 복원용 (앱 mobile/src/lib/homeScreenState.ts 페어).
 *
 * App Router 는 페이지 세그먼트를 언마운트하고 돌아오면 새로 마운트하며, 스크롤 컨테이너가
 * window 가 아니라 PhoneShell 의 `.screen` div 라 Next 기본 스크롤 복원도 동작하지 않는다.
 * 그래서 스크롤 위치·게임 칩·하단 랭킹 탭·랭킹 행을 모듈 메모리 + sessionStorage 에 보관했다가
 * 다음 마운트에서 시드로 쓴다. 섹션 데이터(HOT/박스)는 CleanHome 의 세션 캐시가 담당.
 */

export interface HomeScreenSnapshot {
  homeGame: string;
  moverTab: string;
  scrollY: number;
  rankRows: Record<string, unknown[]>;
}

const SS_KEY = 'pf30:home-state:v1';
/** 이보다 오래된 스냅샷은 버린다 — 한참 뒤 복귀는 새 홈으로. */
const TTL_MS = 15 * 60_000;

let snap: Partial<HomeScreenSnapshot> | null = null;
let savedAt = 0;
let loaded = false;

function loadOnce(): void {
  if (loaded || typeof sessionStorage === 'undefined') return;
  loaded = true;
  try {
    const j = JSON.parse(sessionStorage.getItem(SS_KEY) ?? 'null') as
      | { at?: number; snap?: Partial<HomeScreenSnapshot> }
      | null;
    if (j?.snap && typeof j.at === 'number') {
      snap = j.snap;
      savedAt = j.at;
    }
  } catch {
    /* 손상 캐시 무시 */
  }
}

/** 유효한 스냅샷(없거나 만료면 null). */
export function peekHomeState(): Partial<HomeScreenSnapshot> | null {
  loadOnce();
  if (!snap) return null;
  if (Date.now() - savedAt > TTL_MS) {
    snap = null;
    return null;
  }
  return snap;
}

/** 일부 필드만 갱신(얕은 병합). 스크롤처럼 잦은 호출은 호출측에서 스로틀할 것. */
export function patchHomeState(patch: Partial<HomeScreenSnapshot>): void {
  loadOnce();
  snap = { ...(snap ?? {}), ...patch };
  savedAt = Date.now();
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ at: savedAt, snap }));
  } catch {
    /* 용량/프라이빗 모드 — 메모리 복원만으로도 충분 */
  }
}
