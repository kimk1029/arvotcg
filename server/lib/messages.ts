import { prisma } from './prisma.js';

export interface MessageRow {
  id: number;
  senderId: string;
  receiverId: string;
  text: string;
  tradeId: number | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface Thread {
  peerId: string;
  peerName: string;
  peerAvatar: string;        // avatar id or emoji
  peerBgId: string;
  peerFrameId: string;
  lastText: string;
  lastAt: Date;
  lastFromMe: boolean;
  unread: number;
}

/**
 * 내가 주고받은 상대별 최근 메시지 + unread 개수.
 *
 * 예전에는 내 메시지를 전부 불러와 JS 에서 그룹핑했다 — 대화가 쌓일수록(가격알림
 * 시스템 쪽지 포함) 선형으로 느려진다. 이제 상대별 마지막 1건(DISTINCT ON)과
 * 미읽음 집계만 DB 에서 가져온다.
 */
export async function getThreads(myId: string): Promise<Thread[]> {
  const [lastRows, unreadRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{ peerId: string; text: string; createdAt: Date; lastFromMe: boolean }>
    >`
      SELECT DISTINCT ON (peer)
        peer AS "peerId", "text", "createdAt", "fromMe" AS "lastFromMe"
      FROM (
        SELECT
          CASE WHEN "senderId" = ${myId} THEN "receiverId" ELSE "senderId" END AS peer,
          "text", "createdAt", ("senderId" = ${myId}) AS "fromMe"
        FROM "messages"
        WHERE "senderId" = ${myId} OR "receiverId" = ${myId}
      ) t
      ORDER BY peer, "createdAt" DESC
    `,
    prisma.message.groupBy({
      by: ['senderId'],
      where: { receiverId: myId, readAt: null },
      _count: { _all: true },
    }),
  ]);
  if (lastRows.length === 0) return [];

  const unreadByPeer = new Map<string, number>(
    unreadRows.map((r) => [r.senderId, r._count._all]),
  );
  const peers = await prisma.user.findMany({
    where: { id: { in: lastRows.map((r) => r.peerId) } },
    select: { id: true, name: true, avatarId: true, backgroundId: true, frameId: true },
  });
  type PeerRow = (typeof peers)[number];
  const peerById = new Map<string, PeerRow>(peers.map((u) => [u.id, u]));

  return lastRows
    .map((r): Thread => {
      const peer = peerById.get(r.peerId);
      return {
        peerId: r.peerId,
        peerName: peer?.name ?? '알 수 없음',
        peerAvatar: peer?.avatarId ?? '🐣',
        peerBgId: peer?.backgroundId ?? 'default',
        peerFrameId: peer?.frameId ?? 'none',
        lastText: r.text,
        lastAt: r.createdAt,
        lastFromMe: r.lastFromMe,
        unread: unreadByPeer.get(r.peerId) ?? 0,
      };
    })
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

export async function getConversation(
  myId: string,
  peerId: string,
  limit = 100,
): Promise<MessageRow[]> {
  const rows = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: myId, receiverId: peerId },
        { senderId: peerId, receiverId: myId },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    senderId: r.senderId,
    receiverId: r.receiverId,
    text: r.text,
    tradeId: r.tradeId,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

export async function markThreadRead(myId: string, peerId: string): Promise<void> {
  await prisma.message.updateMany({
    where: { senderId: peerId, receiverId: myId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function getUnreadCount(myId: string): Promise<number> {
  return prisma.message.count({
    where: { receiverId: myId, readAt: null },
  });
}
