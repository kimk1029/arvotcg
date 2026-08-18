/**
 * 카드 게임(포켓몬/원피스/유희왕/스포츠) 표시 필터 설정 — 웹 src/lib/gamePrefs.ts 와 동일 컨셉.
 * 테마가 목록의 게임을 정하던 방식을 대체 — 설정에서 게임별로 켜고 끈다.
 * 기본은 포켓몬·원피스만 켜짐. 최소 1개는 켜져 있어야 한다.
 */
import { getString, setString } from '@/lib/kvStore';
import { shotText } from '@/lib/shotMode';

export type GameId = 'pokemon' | 'onepiece' | 'yugioh' | 'sports';

// 스포츠는 노출 옵션에서 제외(2026-08-09) — 타입/팩 데이터엔 남아 있지만 설정·홈 칩에 안 나옴 (웹 동일).
export const GAME_OPTIONS: Array<{ id: GameId; label: string; emoji: string }> = [
  // 라벨은 스토어 스크린샷 모드에서만 가상 명칭으로 치환된다 (제3자 상표 노출 금지).
  { id: 'pokemon', label: shotText('포켓몬'), emoji: '⚡' },
  { id: 'onepiece', label: shotText('원피스'), emoji: '🏴‍☠️' },
  { id: 'yugioh', label: shotText('유희왕'), emoji: '🎴' },
];

export const GAME_IDS: GameId[] = GAME_OPTIONS.map((g) => g.id);

export const ENABLED_GAMES_KEY = 'pf30:enabledGames';
export const DEFAULT_ENABLED_GAMES: GameId[] = ['pokemon', 'onepiece'];

function isGameId(v: unknown): v is GameId {
  return typeof v === 'string' && (GAME_IDS as string[]).includes(v);
}

export function loadEnabledGames(): GameId[] {
  const raw = getString(ENABLED_GAMES_KEY);
  if (!raw) return [...DEFAULT_ENABLED_GAMES];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [...DEFAULT_ENABLED_GAMES];
    // GAME_IDS 순서로 정규화해 저장 순서와 무관하게 동일 배열이 되도록.
    const set = new Set(arr.filter(isGameId));
    const list = GAME_IDS.filter((g) => set.has(g));
    return list.length > 0 ? list : [...DEFAULT_ENABLED_GAMES];
  } catch {
    return [...DEFAULT_ENABLED_GAMES];
  }
}

export function saveEnabledGames(games: GameId[]): void {
  setString(ENABLED_GAMES_KEY, JSON.stringify(games));
}
