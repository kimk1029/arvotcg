import { Router, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

/**
 * 앱 강제 업데이트 — 스토어 최신 빌드번호를 DB(AppRelease)에 두고, 앱이 부팅 때
 * 자기 네이티브 빌드번호를 보내 비교한다.
 *
 * 판단은 전적으로 서버가 한다(앱은 결과만 따른다). 그래야 사고가 났을 때 앱 배포
 * 없이 `enforced=false` 로 즉시 풀 수 있다.
 *
 * **fail-open 원칙**: 행이 없거나 · enforced 가 꺼졌거나 · 클라이언트가 자기 빌드번호를
 * 모르면 차단하지 않는다. 앱을 못 쓰게 만드는 쪽보다 한 번 덜 막는 쪽이 낫다.
 * (빌드번호를 못 보내는 건 expo-application 이 없는 구 바이너리뿐이다 — 그 빌드들은
 *  애초에 이 기능이 들어가기 전이라 강제할 수단 자체가 없다.)
 */
const router = Router();

type Platform = 'ios' | 'android';

function parsePlatform(v: unknown): Platform | null {
  return v === 'ios' || v === 'android' ? v : null;
}

/** 정수 빌드번호로 파싱. 모르면 null (fail-open). */
function parseBuild(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * GET /api/app-release?platform=android&build=24
 * → { latestBuild, version, storeUrl, message, updateRequired }
 * 인증 없음 — 앱이 로그인 전에도 물어본다.
 */
router.get('/', async (req: Request, res: Response) => {
  const platform = parsePlatform(req.query.platform);
  if (!platform) return res.status(400).json({ error: 'platform 은 ios 또는 android' });
  const build = parseBuild(req.query.build);
  try {
    const row = await prisma.appRelease.findUnique({ where: { platform } });
    if (!row) {
      // 아직 등록 전 — 아무도 막지 않는다.
      return res.json({ updateRequired: false, latestBuild: null, version: null, storeUrl: null, message: null });
    }
    const updateRequired = row.enforced && build != null && build < row.latestBuild;
    res.json({
      updateRequired,
      latestBuild: row.latestBuild,
      version: row.version,
      storeUrl: row.storeUrl,
      message: row.message,
    });
  } catch (err) {
    console.error('[appRelease.get]', err);
    // 서버가 흔들려도 앱은 열려야 한다.
    res.json({ updateRequired: false, latestBuild: null, version: null, storeUrl: null, message: null });
  }
});

/** 어드민 앱·빌드 스크립트용 공유 비밀 (배너 업로드와 같은 방식). */
function hasUploadSecret(req: Request): boolean {
  const expected = process.env.ADMIN_UPLOAD_SECRET ?? '';
  const got = req.header('x-admin-upload-secret') ?? '';
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/**
 * PUT /api/app-release — 스토어 최신 빌드 등록/갱신.
 * 빌드 직후 `scripts/set-app-release.mjs` 가 호출한다.
 * body: { platform, latestBuild, version, storeUrl?, message?, enforced? }
 */
router.put('/', async (req: Request, res: Response) => {
  if (!hasUploadSecret(req)) return res.status(401).json({ error: 'unauthorized' });
  const b = (req.body ?? {}) as Record<string, unknown>;
  const platform = parsePlatform(b.platform);
  const latestBuild = parseBuild(b.latestBuild);
  const version = typeof b.version === 'string' ? b.version.trim() : '';
  if (!platform) return res.status(400).json({ error: 'platform 은 ios 또는 android' });
  if (latestBuild == null) return res.status(400).json({ error: 'latestBuild 는 1 이상 정수' });
  if (!version) return res.status(400).json({ error: 'version 필요' });
  const storeUrl =
    typeof b.storeUrl === 'string' && b.storeUrl.trim() ? b.storeUrl.trim() : defaultStoreUrl(platform);
  const message = typeof b.message === 'string' && b.message.trim() ? b.message.trim() : null;
  const enforced = typeof b.enforced === 'boolean' ? b.enforced : true;
  try {
    const row = await prisma.appRelease.upsert({
      where: { platform },
      create: { platform, latestBuild, version, storeUrl, message, enforced },
      update: { latestBuild, version, storeUrl, message, enforced },
    });
    res.json({ ok: true, release: row });
  } catch (err) {
    console.error('[appRelease.put]', err);
    res.status(500).json({ error: 'internal' });
  }
});

function defaultStoreUrl(platform: Platform): string {
  return platform === 'ios'
    ? 'https://apps.apple.com/app/id6799868587'
    : 'https://play.google.com/store/apps/details?id=com.arvotcg.app';
}

export default router;
