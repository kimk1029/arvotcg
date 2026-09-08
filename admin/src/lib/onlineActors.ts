export interface OnlineRow {
  actor: string;
  userId: string | null;
  anonId: string | null;
  source: string;
  path: string;
  ua: string | null;
  ip: string | null;
  lastAt: Date;
  events: bigint;
}

/** 같은 출처·익명 ID의 로그인 전후 기록을 합친다. IP만으로 회원을 연결하지 않는다. */
export function mergeOnlineActors(rows: OnlineRow[]): OnlineRow[] {
  const keyOf = (r: OnlineRow) => r.anonId && r.anonId !== 'anon'
    ? JSON.stringify([r.source, r.anonId]) : null;
  const memberByAnon = new Map<string, OnlineRow>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key && row.userId) {
      const prev = memberByAnon.get(key);
      if (!prev || row.lastAt > prev.lastAt) memberByAnon.set(key, row);
    }
  }
  const merged = new Map<string, OnlineRow>();
  for (const row of rows) {
    const key = keyOf(row);
    const userId = row.userId ?? (key ? memberByAnon.get(key)?.userId : null) ?? null;
    const actor = userId ? `user:${userId}` : row.actor;
    const prev = merged.get(actor);
    const latest = !prev || row.lastAt > prev.lastAt ? row : prev;
    merged.set(actor, { ...latest, actor, userId, events: (prev?.events ?? 0n) + row.events });
  }
  return [...merged.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}
