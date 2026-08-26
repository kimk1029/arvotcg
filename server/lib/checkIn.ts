import { prisma } from './prisma.js';
import { REWARDS } from '../../shared/rewards';
import { kstDayDiff, kstDayStart } from '../../shared/kst';

export interface CheckInResult {
  granted: number;
  bonus: number;
  streak: number;
}

/**
 * 하루 1회 출석 보상.
 * - KST 기준 같은 날 재호출 시 no-op (null 반환).
 * - 어제 출석 → streak +1, 그 외 → streak = 1.
 * - streak 가 3 의 배수면 추가 보너스 지급.
 *
 * 동시 호출은 updateMany 의 lastCheckInAt 가드로 한 번만 성공.
 */
export async function runDailyCheckIn(userId: string): Promise<CheckInResult | null> {
  const now = new Date();
  const todayStart = kstDayStart(now);

  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { lastCheckInAt: true, streakCount: true },
    });
    if (!u) return null;

    if (u.lastCheckInAt && u.lastCheckInAt >= todayStart) return null;

    const diff = u.lastCheckInAt ? kstDayDiff(now, u.lastCheckInAt) : Infinity;
    const nextStreak = diff === 1 ? u.streakCount + 1 : 1;

    const bonus = nextStreak > 0 && nextStreak % 3 === 0 ? REWARDS.login_streak3_bonus : 0;
    const granted = REWARDS.login_daily;

    const result = await tx.user.updateMany({
      where: {
        id: userId,
        OR: [{ lastCheckInAt: null }, { lastCheckInAt: { lt: todayStart } }],
      },
      data: {
        lastCheckInAt: now,
        streakCount: nextStreak,
        points: { increment: granted + bonus },
      },
    });

    if (result.count === 0) return null;

    // 포인트 원장 — 출석은 lastCheckInAt 만 남아 복원 불가하므로 여기서 기록.
    const after = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
    const total = after?.points ?? 0;
    await tx.pointLog.create({
      data: { userId, delta: granted, reason: 'login_daily', balanceAfter: total - bonus },
    });
    if (bonus > 0) {
      await tx.pointLog.create({
        data: { userId, delta: bonus, reason: 'login_streak3_bonus', balanceAfter: total },
      });
    }

    return { granted, bonus, streak: nextStreak };
  });
}
