import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  HERO_AUTOPLAY_MAX_MS,
  HERO_AUTOPLAY_MIN_MS,
  HERO_AUTOPLAY_SETTING_KEY,
  clampHeroAutoplayMs,
} from '../../../../../../shared/heroBanner';

export const dynamic = 'force-dynamic';

/**
 * 히어로 배너 표시 설정 — 슬라이드 자동 전환 간격(ms).
 * SiteSetting `hero.autoplayMs` 하나를 읽고 쓴다 (server/routes/admin.ts /banners/settings 와 동일 규칙,
 * 정본 shared/heroBanner.ts). 홈 웹·앱은 /api/banners 응답의 autoplayMs 로 받는다.
 */
export async function GET() {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: HERO_AUTOPLAY_SETTING_KEY } });
    return NextResponse.json({ autoplayMs: clampHeroAutoplayMs(row?.value) });
  } catch (err) {
    console.error('[admin.banners.settings.GET]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const raw = (await req.json().catch(() => ({}))) as { autoplayMs?: unknown };
  const n = typeof raw.autoplayMs === 'string' ? Number(raw.autoplayMs) : raw.autoplayMs;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    return NextResponse.json({ error: '전환 간격(ms)이 숫자가 아닙니다' }, { status: 400 });
  }
  if (n < HERO_AUTOPLAY_MIN_MS || n > HERO_AUTOPLAY_MAX_MS) {
    return NextResponse.json(
      { error: `전환 간격은 ${HERO_AUTOPLAY_MIN_MS / 1000}~${HERO_AUTOPLAY_MAX_MS / 1000}초 사이여야 합니다` },
      { status: 400 },
    );
  }
  const ms = clampHeroAutoplayMs(n);
  try {
    await prisma.siteSetting.upsert({
      where: { key: HERO_AUTOPLAY_SETTING_KEY },
      create: { key: HERO_AUTOPLAY_SETTING_KEY, value: String(ms) },
      update: { value: String(ms) },
    });
    return NextResponse.json({ autoplayMs: ms });
  } catch (err) {
    console.error('[admin.banners.settings.PUT]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
