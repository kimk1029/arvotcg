import { AVATARS, isAvatarId } from '@/lib/avatars';
import { BACKGROUNDS, FRAMES, isBackgroundId, isFrameId } from '@/lib/shop';
import { getMyInventory, type InventorySnapshot } from './queries.js';
import { defaultNameFor } from './defaultName.js';
import { prisma } from './prisma.js';
import { logPointChange } from './pointLog.js';

type Result =
  | { ok: true; inv: InventorySnapshot }
  | { ok: false; error: string };

async function ensureUserRow(userId: string) {
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, name: defaultNameFor(userId) },
  });
}

export async function pickAvatar(userId: string, id: string): Promise<Result> {
  if (!isAvatarId(id)) return { ok: false, error: 'invalid avatar' };
  await ensureUserRow(userId);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u?.ownedAvatars.includes(id)) return { ok: false, error: '보유하지 않은 아바타' };
  await prisma.user.update({ where: { id: userId }, data: { avatarId: id } });
  return { ok: true, inv: await getMyInventory(userId) };
}

export async function pickBackground(userId: string, id: string): Promise<Result> {
  if (!isBackgroundId(id)) return { ok: false, error: 'invalid background' };
  await ensureUserRow(userId);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u?.ownedBackgrounds.includes(id)) return { ok: false, error: '보유하지 않은 배경' };
  await prisma.user.update({ where: { id: userId }, data: { backgroundId: id } });
  return { ok: true, inv: await getMyInventory(userId) };
}

export async function pickFrame(userId: string, id: string): Promise<Result> {
  if (!isFrameId(id)) return { ok: false, error: 'invalid frame' };
  await ensureUserRow(userId);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u?.ownedFrames.includes(id)) return { ok: false, error: '보유하지 않은 테두리' };
  await prisma.user.update({ where: { id: userId }, data: { frameId: id } });
  return { ok: true, inv: await getMyInventory(userId) };
}

async function genericBuy(
  userId: string,
  kind: 'avatar' | 'bg' | 'frame',
  id: string,
  expectedPrice: number,
): Promise<Result> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return { ok: false, error: 'user not found' };

  const ownedField =
    kind === 'avatar' ? 'ownedAvatars' : kind === 'bg' ? 'ownedBackgrounds' : 'ownedFrames';
  const currentField = kind === 'avatar' ? 'avatarId' : kind === 'bg' ? 'backgroundId' : 'frameId';
  const owned = (u as Record<string, unknown>)[ownedField] as string[];

  if (owned.includes(id)) {
    await prisma.user.update({ where: { id: userId }, data: { [currentField]: id } });
    return { ok: true, inv: await getMyInventory(userId) };
  }

  // 잔액 확인·미보유 확인·차감을 한 쿼리로 — check-then-write 경쟁으로 인한
  // 이중 차감/중복 push 방지
  const charged = await prisma.user.updateMany({
    where: {
      id: userId,
      points: { gte: expectedPrice },
      NOT: { [ownedField]: { has: id } },
    },
    data: {
      points: { decrement: expectedPrice },
      [currentField]: id,
      [ownedField]: { push: id },
    },
  });
  if (charged.count === 0) {
    // 동시 요청이 먼저 구매를 끝낸 경우 — 보유 중이면 장착으로 처리
    const fresh = await prisma.user.findUnique({ where: { id: userId } });
    const freshOwned = ((fresh as Record<string, unknown> | null)?.[ownedField] ?? []) as string[];
    if (freshOwned.includes(id)) {
      await prisma.user.update({ where: { id: userId }, data: { [currentField]: id } });
      return { ok: true, inv: await getMyInventory(userId) };
    }
    return { ok: false, error: '포인트 부족' };
  }
  if (expectedPrice > 0) {
    await logPointChange(prisma, userId, -expectedPrice, 'shop_buy', { type: kind, id });
  }
  return { ok: true, inv: await getMyInventory(userId) };
}

export async function buyAvatar(userId: string, id: string, expectedPrice: number): Promise<Result> {
  if (!isAvatarId(id)) return { ok: false, error: 'invalid avatar' };
  const meta = AVATARS.find((a) => a.id === id);
  if (!meta) return { ok: false, error: 'invalid avatar' };
  await ensureUserRow(userId);

  if (meta.mode === 'level') return genericBuy(userId, 'avatar', id, 0);
  if (meta.mode === 'shop' && meta.price !== expectedPrice) {
    return { ok: false, error: 'price mismatch' };
  }
  if (meta.mode === 'free') return genericBuy(userId, 'avatar', id, 0);
  return genericBuy(userId, 'avatar', id, expectedPrice);
}

export async function buyBackground(
  userId: string,
  id: string,
  expectedPrice: number,
): Promise<Result> {
  if (!isBackgroundId(id)) return { ok: false, error: 'invalid background' };
  const meta = BACKGROUNDS.find((b) => b.id === id);
  if (!meta || meta.price !== expectedPrice) return { ok: false, error: 'price mismatch' };
  await ensureUserRow(userId);
  return genericBuy(userId, 'bg', id, expectedPrice);
}

export async function buyFrame(userId: string, id: string, expectedPrice: number): Promise<Result> {
  if (!isFrameId(id)) return { ok: false, error: 'invalid frame' };
  const meta = FRAMES.find((f) => f.id === id);
  if (!meta || meta.price !== expectedPrice) return { ok: false, error: 'price mismatch' };
  await ensureUserRow(userId);
  return genericBuy(userId, 'frame', id, expectedPrice);
}
