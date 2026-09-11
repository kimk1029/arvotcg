import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Router, type Request, type Response } from 'express';
import sharp from 'sharp';
import { CARD_CDN_DIR } from '../lib/cardImageCache.js';

/**
 * 외부 이미지 리사이즈 프록시 + 디스크 캐시 — 카드샵 대표 이미지(네이버 플레이스·인스타 CDN)용.
 *   GET /api/img?u=<https url>&w=<96|200|400|800>
 * 원본을 1회 받아 webp(width w)로 CARD_CDN_DIR/img/<sha1>.webp 에 저장하고 이후엔 디스크에서 바로 준다.
 * Cache-Control 7d 라 브라우저/앱(Fresco·NSURLCache)도 다시 안 받는다. 리스트 썸네일(42px)이
 * 원본(수백 KB)을 통째로 받던 부담을 줄이는 게 목적 (2026-09-12).
 *
 * 허용 호스트 밖이거나 실패하면 원본으로 302 — 그림이 안 나오는 것보단 낫다(SSRF 방지 겸).
 */
const ALLOW = [/\.pstatic\.net$/i, /\.cdninstagram\.com$/i, /\.fbcdn\.net$/i, /\.naver\.com$/i, /\.kakaocdn\.net$/i, /\.googleusercontent\.com$/i, /\.arvotcg\.com$/i];
const WIDTHS = new Set([96, 200, 400, 800]);
const IMG_DIR = join(CARD_CDN_DIR, 'img');

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const u = String(req.query.u ?? '');
  const w = Number(req.query.w ?? 400);
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    res.status(400).json({ error: 'bad url' });
    return;
  }
  if (!/^https?:$/.test(url.protocol) || !WIDTHS.has(w) || !ALLOW.some((re) => re.test(url.hostname))) {
    res.redirect(302, u);
    return;
  }
  const key = createHash('sha1').update(`${u}|${w}`).digest('hex');
  const file = join(IMG_DIR, `${key}.webp`);
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  res.setHeader('Content-Type', 'image/webp');
  try {
    res.send(await readFile(file));
    return;
  } catch {
    /* miss */
  }
  try {
    const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 ARVOTCG-img' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const webp = await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await mkdir(IMG_DIR, { recursive: true });
    await writeFile(file, webp);
    res.send(webp);
  } catch (err) {
    console.warn('[img]', url.hostname, err instanceof Error ? err.message : err);
    res.removeHeader('Content-Type');
    res.redirect(302, u);
  }
});

export default router;
