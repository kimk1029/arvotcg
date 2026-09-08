import { prisma } from './prisma';
import { mergeOnlineActors, type OnlineRow } from './onlineActors';

export async function getOnlineUsers(minutes = 5) {
  const rows = await prisma.$queryRaw<OnlineRow[]>`
    SELECT DISTINCT ON (actor, source, "anonId") actor, "userId", "anonId", source, path, ua, ip, "createdAt" AS "lastAt",
           count(*) OVER (PARTITION BY actor, source, "anonId") AS events
      FROM (
        SELECT COALESCE("userId", 'anon:' || COALESCE("anonId", ip, '?')) AS actor, *
          FROM action_logs
         WHERE "createdAt" > now() - ${minutes} * interval '1 minute'
      ) t
     ORDER BY actor, source, "anonId", "createdAt" DESC
  `.catch(() => [] as OnlineRow[]);
  return mergeOnlineActors(rows);
}
