/**
 * 오리파 — 서버 공유 상태.
 *
 * 정책:
 *   - packId 별 100칸. 첫 조회 시 테이블에 없으면 53칸 mock drawn 으로 시드(기존 UX 유지).
 *   - pull 은 updateMany({where: {packId, index, drawn:false}}) 원자 업데이트 → 경쟁 시 한 명만 성공.
 *   - 클라이언트는 8초 폴링으로 타 유저 pull 반영.
 */
import { randomInt } from 'node:crypto';
import { prisma } from './prisma.js';
import { logPointChange } from './pointLog.js';
import type { OripaBox, OripaBoxPrize, OripaGrade, OripaTier, OripaTicket } from '@/lib/types';

/**
 * 어드민이 관리하는 OripaPack 테이블에서 active=true 인 박스만 가져옴.
 * 사용자 화면 (OripaScreen) + 구매 모달 미리보기에 사용.
 * tier 'premium' 은 CSS 호환 위해 'legend' 로 매핑.
 */
export async function getActiveOripaBoxes(): Promise<OripaBox[]> {
  try {
    const rows = await prisma.oripaPack.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });
    if (rows.length === 0) return [];

    // 등급별 뽑힘 카운트 — packId×grade groupBy
    const ids = rows.map((r) => r.id);
    const drawnRows = await prisma.oripaTicket.findMany({
      where: { packId: { in: ids }, drawn: true },
      select: { packId: true, grade: true },
    });
    const statsByPack = new Map<
      string,
      { total: number; remaining: number; drawn: { S: number; A: number; B: number; C: number } }
    >();
    for (const r of rows) {
      statsByPack.set(r.id, {
        total: r.ticketsCount,
        remaining: r.ticketsCount, // 아래에서 차감
        drawn: { S: 0, A: 0, B: 0, C: 0 },
      });
    }
    for (const t of drawnRows) {
      const s = statsByPack.get(t.packId);
      if (!s) continue;
      s.remaining = Math.max(0, s.remaining - 1);
      const g = t.grade as 'S' | 'A' | 'B' | 'C' | null;
      if (g === 'S' || g === 'A' || g === 'B' || g === 'C') s.drawn[g] += 1;
    }

    return rows.map((r): OripaBox => {
      const prizes = Array.isArray(r.prizes)
        ? (r.prizes as unknown as OripaBoxPrize[])
        : [];
      const odds = computeOdds(prizes);
      const tier: OripaTier =
        r.tier === 'premium'
          ? 'legend'
          : r.tier === 'rare'
            ? 'rare'
            : r.tier === 'legend'
              ? 'legend'
              : 'normal';
      return {
        id: r.id,
        tier,
        emoji: r.emoji,
        name: r.name,
        desc: r.desc,
        price: r.price,
        odds,
        prizes,
        stats: statsByPack.get(r.id),
      };
    });
  } catch (err) {
    console.error('[getActiveOripaBoxes]', err);
    return [];
  }
}

/** prizes 의 가중치 → "S 3% · A 12% · B 25% · C 60%" 같은 odds 문자열 */
function computeOdds(prizes: OripaBoxPrize[]): string {
  if (prizes.length === 0) return '';
  const total = prizes.reduce((s, p) => s + (p.weight > 0 ? p.weight : 0), 0);
  if (total <= 0) return '';
  const byGrade = new Map<string, number>();
  for (const p of prizes) {
    byGrade.set(p.grade, (byGrade.get(p.grade) ?? 0) + p.weight);
  }
  const order: Array<'S' | 'A' | 'B' | 'C'> = ['S', 'A', 'B', 'C'];
  return order
    .filter((g) => byGrade.has(g))
    .map((g) => `${g} ${Math.round(((byGrade.get(g) ?? 0) / total) * 100)}%`)
    .join(' · ');
}

export interface PullResult {
  index: number;
  grade: OripaGrade;
  prizeName: string;
  prizeEmoji: string;
  prizeImageUrl?: string;
}

const FALLBACK_PRIZES: OripaBoxPrize[] = [
  { grade: 'C', name: '스티커 팩',          emoji: '🌟', weight: 60 },
  { grade: 'B', name: '몬스터볼 스킨',      emoji: '⚪', weight: 25 },
  { grade: 'A', name: '프리미엄 뱃지',      emoji: '🏅', weight: 12 },
  { grade: 'S', name: '홀로 프레임', emoji: '🖼', weight: 3 },
];

function normalizePrizes(raw: unknown): OripaBoxPrize[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    if (!p || typeof p !== 'object') return [];
    const q = p as Partial<OripaBoxPrize>;
    if (q.grade !== 'S' && q.grade !== 'A' && q.grade !== 'B' && q.grade !== 'C') return [];
    const weight = Number(q.weight);
    if (!q.name || !Number.isFinite(weight) || weight <= 0) return [];
    return [{
      grade: q.grade,
      name: q.name,
      emoji: q.emoji || '🎁',
      weight,
      bg: q.bg,
      imageUrl: q.imageUrl,
    }];
  });
}

function pickPrize(prizes: OripaBoxPrize[], seed: number): OripaBoxPrize {
  const pool = prizes.length > 0 ? prizes : FALLBACK_PRIZES;
  const total = pool.reduce((s, p) => s + (p.weight > 0 ? p.weight : 0), 0);
  if (total <= 0) return FALLBACK_PRIZES[0];
  let r = ((((seed % 1_000_000) + 1_000_000) % 1_000_000) / 1_000_000) * total;
  for (const prize of pool) {
    r -= Math.max(0, prize.weight);
    if (r <= 0) return prize;
  }
  return pool[pool.length - 1] ?? FALLBACK_PRIZES[0];
}

/** pull 실패 사유를 라우터에서 HTTP 응답으로 매핑하기 위한 에러 */
export class OripaPullError extends Error {
  constructor(
    public code: 'pack_not_found' | 'insufficient_points',
    message: string,
  ) {
    super(message);
    this.name = 'OripaPullError';
  }
}

/**
 * 구매 모달(OripaPurchaseModal PACKS)과 동일한 세트 할인 규칙.
 * 10장 이상 10%, 5장 이상 5%. 규칙 변경 시 양쪽 동시 수정 필요.
 */
function costFor(unitPrice: number, count: number): number {
  const subtotal = unitPrice * count;
  const rate = count >= 10 ? 0.1 : count >= 5 ? 0.05 : 0;
  return subtotal - Math.floor(subtotal * rate);
}

/**
 * 패키지의 100칸을 "전부 미오픈" 상태로 시드.
 * (이전엔 첫 진입 UI 가 비어보이지 않게 53칸을 mock-drawn 으로 채웠지만,
 *  어드민 reset 후에도 가짜 뽑힌 티켓이 다시 나타나 reset 의미가 사라졌음 →
 *  진짜 새 판으로 시작하도록 변경.)
 */
function buildSeed(packId: string) {
  return Array.from({ length: 100 }, (_, i) => ({
    packId,
    index: i,
    drawn: false,
  }));
}

type DbRow = Awaited<ReturnType<typeof prisma.oripaTicket.findMany>>[number];

function toClient(r: DbRow): OripaTicket {
  return {
    index: r.index,
    drawn: r.drawn,
    grade: (r.grade ?? undefined) as OripaGrade | undefined,
    prizeName: r.prizeName ?? undefined,
    prizeEmoji: r.prizeEmoji ?? undefined,
    prizeImageUrl: r.prizeImageUrl ?? undefined,
    drawnBy: r.drawnByName ?? undefined,
    drawnAt: r.drawnAt ? relTime(r.drawnAt) : undefined,
  };
}

function relTime(d: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60_000));
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/** 패키지 별 100칸 조회. 없으면 시드 후 재조회. */
export async function getOripaTickets(packId: string): Promise<OripaTicket[]> {
  const existing = await prisma.oripaTicket.findMany({
    where: { packId },
    orderBy: { index: 'asc' },
  });
  if (existing.length >= 100) return existing.map(toClient);

  // 시드 — 이미 일부만 있어도 단순히 전부 createMany(skipDuplicates:true) 로 채움
  await prisma.oripaTicket.createMany({
    data: buildSeed(packId),
    skipDuplicates: true,
  });
  const seeded = await prisma.oripaTicket.findMany({
    where: { packId },
    orderBy: { index: 'asc' },
  });
  return seeded.map(toClient);
}

export interface PullOutcome {
  results: PullResult[];
  /** 다른 유저가 먼저 뽑아서 실패한 인덱스들 */
  alreadyDrawn: number[];
  /** 이번 pull 에서 실제 차감된 포인트 (성공한 티켓 수 기준) */
  charged: number;
}

/**
 * 여러 인덱스를 서버에서 순차 원자 업데이트 + 포인트 차감을 한 트랜잭션으로.
 * - 티켓: updateMany({where: {drawn:false}}) count>0 인 경우만 성공 처리 → 경쟁 안전.
 * - 결제: 성공한 티켓 수만큼 조건부 차감(points >= cost). 부족하면 전체 롤백 →
 *   클라이언트가 선결제하던 기존 구조는 /pull 직접 호출로 무료 뽑기가 가능했음.
 */
export async function pullOripaTickets(
  packId: string,
  indices: number[],
  user: { id: string; name: string },
): Promise<PullOutcome> {
  const uniq = Array.from(new Set(indices)).filter(
    (n) => Number.isInteger(n) && n >= 0 && n < 100,
  );
  const pack = await prisma.oripaPack.findUnique({
    where: { id: packId },
    select: { prizes: true, price: true },
  });
  if (!pack) throw new OripaPullError('pack_not_found', '존재하지 않는 팩입니다');
  const prizes = normalizePrizes(pack.prizes);
  const unitPrice = Math.max(0, pack.price);

  return prisma.$transaction(async (tx) => {
    const results: PullResult[] = [];
    const alreadyDrawn: number[] = [];

    for (const idx of uniq) {
      const prize = pickPrize(prizes, randomInt(1_000_000));
      const res = await tx.oripaTicket.updateMany({
        where: { packId, index: idx, drawn: false },
        data: {
          drawn: true,
          grade: prize.grade,
          prizeName: prize.name,
          prizeEmoji: prize.emoji,
          prizeImageUrl: prize.imageUrl ?? null,
          drawnById: user.id,
          drawnByName: user.name,
          drawnAt: new Date(),
        },
      });
      if (res.count === 0) {
        alreadyDrawn.push(idx);
      } else {
        results.push({
          index: idx,
          grade: prize.grade,
          prizeName: prize.name,
          prizeEmoji: prize.emoji,
          prizeImageUrl: prize.imageUrl,
        });
      }
    }

    const cost = costFor(unitPrice, results.length);
    if (cost > 0) {
      const charged = await tx.user.updateMany({
        where: { id: user.id, points: { gte: cost } },
        data: { points: { decrement: cost } },
      });
      if (charged.count === 0) {
        throw new OripaPullError('insufficient_points', '포인트가 부족합니다');
      }
      await logPointChange(tx, user.id, -cost, 'oripa_pull', { type: 'oripa' });
    }

    return { results, alreadyDrawn, charged: cost };
  });
}
