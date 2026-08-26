/**
 * 포인트 원장(PointLog) 기록 헬퍼.
 *
 * User.points 는 파괴적 카운터라 과거 적립/회수·레벨업 시점을 복원할 수 없다 —
 * 모든 증감 지점에서 원장을 남겨 알림 피드(/api/me/notifications)의 데이터 소스로
 * 쓴다. 레벨업은 balanceAfter/delta 로 파생 계산하므로 별도 기록이 필요 없다.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

interface PointRef {
  type?: string;
  id?: string;
}

/** 증감 + 원장 기록 (원자성이 필요하면 $transaction 안에서 호출). 증감 후 잔액 반환. */
export async function adjustPoints(
  db: Db,
  userId: string,
  delta: number,
  reason: string,
  ref?: PointRef,
): Promise<number> {
  const u = await db.user.update({
    where: { id: userId },
    data: { points: { increment: delta } },
    select: { points: true },
  });
  await db.pointLog.create({
    data: { userId, delta, reason, balanceAfter: u.points, refType: ref?.type, refId: ref?.id },
  });
  return u.points;
}

/**
 * 증감이 이미 끝난 뒤 원장만 기록 — 조건부 updateMany(잔액 확인+차감 한 쿼리) 경로용.
 * 현재 잔액을 읽어 balanceAfter 로 남긴다.
 */
export async function logPointChange(
  db: Db,
  userId: string,
  delta: number,
  reason: string,
  ref?: PointRef,
): Promise<void> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { points: true } });
  await db.pointLog.create({
    data: {
      userId,
      delta,
      reason,
      balanceAfter: u?.points ?? 0,
      refType: ref?.type,
      refId: ref?.id,
    },
  });
}
