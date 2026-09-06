import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lookupAvatar, lookupBackground, lookupFrame } from '@/lib/prices';

export const dynamic = 'force-dynamic';

async function one<T>(p: Promise<T>, fb: T): Promise<T> {
  try { return await p; } catch (e) { console.error('[admin.user.api]', e); return fb; }
}

export interface SpendItem {
  kind: 'oripa' | 'avatar' | 'background' | 'frame';
  label: string;
  amount: number;
  /** ISO 문자열. 오리파 뽑기는 drawnAt, 인벤토리 구매는 시각 미기록 — null. */
  at: string | null;
  /** 디버그/링크용 부가 식별자 */
  ref?: string;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, avatar: true, avatarId: true, backgroundId: true, frameId: true,
      rating: true, points: true, signupPlatform: true, signupProvider: true,
      ownedAvatars: true, ownedBackgrounds: true, ownedFrames: true,
      createdAt: true, updatedAt: true,
      _count: {
        select: {
          feeds: true, trades: true, bookmarks: true,
          sentMessages: true, receivedMessages: true, oripaTickets: true,
          userCards: true, favoriteCards: true, searchLogs: true,
        },
      },
    },
  }).catch(() => null);
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const [feeds, trades, pulls, lastViews, allPulls, packs, userCards] = await Promise.all([
    one(prisma.feed.findMany({
      where: { authorId: id }, orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, text: true, createdAt: true },
    }), [] as Array<{ id: number; text: string; createdAt: Date }>),
    one(prisma.trade.findMany({
      where: { authorId: id }, orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, type: true, status: true, title: true, price: true, createdAt: true },
    }), [] as Array<{ id: number; type: string; status: string; title: string; price: string | null; createdAt: Date }>),
    one(prisma.oripaTicket.findMany({
      where: { drawnById: id }, orderBy: { drawnAt: 'desc' }, take: 10,
      select: { id: true, packId: true, index: true, grade: true, prizeName: true, drawnAt: true },
    }), [] as Array<{ id: number; packId: string; index: number; grade: string | null; prizeName: string | null; drawnAt: Date | null }>),
    one(prisma.pageView.findMany({
      where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, path: true, ip: true, country: true, createdAt: true },
    }), [] as Array<{ id: number; path: string; ip: string | null; country: string | null; createdAt: Date }>),
    one(prisma.oripaTicket.findMany({
      where: { drawnById: id, drawn: true },
      select: { id: true, packId: true, index: true, grade: true, prizeName: true, drawnAt: true },
    }), [] as Array<{ id: number; packId: string; index: number; grade: string | null; prizeName: string | null; drawnAt: Date | null }>),
    one(prisma.oripaPack.findMany({
      select: { id: true, name: true, price: true },
    }), [] as Array<{ id: string; name: string; price: number }>),
    one(prisma.userCard.findMany({
      where: { userId: id }, orderBy: { createdAt: 'desc' },
      select: {
        id: true, cardId: true, nickname: true, memo: true,
        ocrSetCode: true, ocrCardNumber: true, snkrdunkApparelId: true,
        gradeEstimate: true, centeringScore: true, photoUrl: true, createdAt: true,
      },
    }), [] as Array<{
      id: number; cardId: string | null; nickname: string | null; memo: string | null;
      ocrSetCode: string | null; ocrCardNumber: string | null; snkrdunkApparelId: number | null;
      gradeEstimate: string | null; centeringScore: number | null; photoUrl: string | null; createdAt: Date;
    }>),
  ]);

  const packById = new Map(packs.map((p) => [p.id, p]));
  const spending: SpendItem[] = [];

  // 오리파 뽑기 — 진짜 시각이 있는 사용 내역
  for (const t of allPulls) {
    const pk = packById.get(t.packId);
    spending.push({
      kind: 'oripa',
      label: `${pk?.name ?? t.packId} 뽑기 #${t.index}${t.prizeName ? ` → ${t.prizeName}` : ''}`,
      amount: pk?.price ?? 0,
      at: t.drawnAt ? t.drawnAt.toISOString() : null,
      ref: `${t.packId}/${t.index}`,
    });
  }

  // 인벤토리 — 보유한 유료 아이템에서 가격 합산. 시각은 알 수 없음.
  for (const aId of user.ownedAvatars) {
    const meta = lookupAvatar(aId);
    if (!meta || meta.price <= 0) continue;
    spending.push({ kind: 'avatar', label: `아바타: ${meta.name}`, amount: meta.price, at: null, ref: aId });
  }
  for (const bId of user.ownedBackgrounds) {
    const meta = lookupBackground(bId);
    if (!meta || meta.price <= 0) continue;
    spending.push({ kind: 'background', label: `배경: ${meta.name}`, amount: meta.price, at: null, ref: bId });
  }
  for (const fId of user.ownedFrames) {
    const meta = lookupFrame(fId);
    if (!meta || meta.price <= 0) continue;
    spending.push({ kind: 'frame', label: `테두리: ${meta.name}`, amount: meta.price, at: null, ref: fId });
  }

  // 시각 있는 항목은 최신순, 없는 항목은 뒤에 묶어서 표시
  spending.sort((a, b) => {
    if (a.at && b.at) return a.at < b.at ? 1 : -1;
    if (a.at) return -1;
    if (b.at) return 1;
    return a.kind === b.kind ? b.amount - a.amount : a.kind.localeCompare(b.kind);
  });

  const totalSpent = spending.reduce((s, x) => s + x.amount, 0);
  const oripaSpent = spending
    .filter((x) => x.kind === 'oripa')
    .reduce((s, x) => s + x.amount, 0);
  const inventorySpent = totalSpent - oripaSpent;

  return NextResponse.json({
    user, feeds, trades, pulls, lastViews, userCards,
    spending, totalSpent, oripaSpent, inventorySpent,
  });
}
