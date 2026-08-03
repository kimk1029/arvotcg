/**
 * 홈 '인기 박스' 캐러셀 선별 — 웹 CleanHome · 앱 CleanHomeScreen 공통 정본.
 *
 * 설정에서 켠 게임별로 그룹ID 확인된(apparelGroupId > 0) 최신 팩을 게임당
 * perGame 개 뽑아 셔플 후 라운드로빈으로 8개 선별한다. 각 팩의 대표 박스는
 * 호출부가 `/api/snkrdunk/apparel-groups/{id}?apparelCategoryId=14&perPage=1`
 * 로 조회해 행으로 변환한다 (양쪽 동일한 NAS 엔드포인트).
 */
import type { CardPackMeta } from './data/cardPacks';

export function shuffleList<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 게임별 목록을 라운드로빈으로 섞어 한 캐러셀에 고르게 배치. */
export function interleavePools<T>(pools: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...pools.map((p) => p.length));
  for (let i = 0; i < max; i++) {
    for (const p of pools) {
      if (i < p.length) out.push(p[i]);
    }
  }
  return out;
}

export function pickHomeBoxPacks(
  packs: readonly CardPackMeta[],
  enabledGames: readonly string[],
): CardPackMeta[] {
  const games = enabledGames.length > 0 ? enabledGames : ['pokemon'];
  // 게임당 뽑는 개수 — 섞어도 캐러셀이 과하게 길어지지 않게 켠 게임 수로 나눔.
  const perGame = Math.max(3, Math.ceil(12 / games.length));
  const pools = games.map((g) =>
    shuffleList(
      packs
        .filter((p) => (p.game ?? 'pokemon') === g && p.apparelGroupId > 0)
        .sort((a, b) => (b.releasedAt ?? '').localeCompare(a.releasedAt ?? ''))
        .slice(0, perGame),
    ),
  );
  return interleavePools(pools).slice(0, 8);
}
