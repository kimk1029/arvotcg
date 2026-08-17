import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { put } from '@vercel/blob';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requireAuth } from '../middleware/requireAuth.js';
import { CARD_CDN_DIR } from '../lib/cardImageCache.js';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

function extFor(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

// Blob 토큰이 없으면 NAS 디스크에 저장 (카드 self-CDN 과 같은 트리, /api/cdn static 으로 서빙).
// 모바일 RN Image 는 상대경로를 못 읽으므로 항상 절대 URL 로 반환한다.
const UPLOADS_DIR = join(CARD_CDN_DIR, 'uploads');
function publicOrigin(): string {
  const raw = process.env.UPLOADS_PUBLIC_ORIGIN || process.env.WEB_BASE_URL || '';
  return raw.replace(/\/+$/, '');
}

function makeHandler(prefix: 'feed' | 'trade', maxFiles: number) {
  return async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) return res.status(400).json({ error: 'no files' });
    if (files.length > maxFiles) {
      return res.status(400).json({ error: `최대 ${maxFiles}장까지 업로드 가능` });
    }
    const userId = req.user!.userId;
    const urls: string[] = [];
    try {
      for (const file of files) {
        if (!ALLOWED_TYPES.has(file.mimetype)) {
          return res.status(400).json({ error: `지원하지 않는 형식: ${file.mimetype}` });
        }
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFor(file.mimetype)}`;
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const { url } = await put(`${prefix}/${userId}/${filename}`, file.buffer, {
            access: 'public',
            contentType: file.mimetype,
          });
          urls.push(url);
        } else {
          const dir = join(UPLOADS_DIR, prefix, String(userId));
          await mkdir(dir, { recursive: true });
          await writeFile(join(dir, filename), file.buffer);
          urls.push(`${publicOrigin()}/api/cdn/uploads/${prefix}/${userId}/${filename}`);
        }
      }
      res.json({ urls });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[upload.${prefix}-images]`, msg);
      res.status(500).json({ error: msg });
    }
  };
}

const router = Router();

router.post(
  '/feed-images',
  requireAuth,
  upload.array('files', 3),
  makeHandler('feed', 3),
);

router.post(
  '/trade-images',
  requireAuth,
  upload.array('files', 5),
  makeHandler('trade', 5),
);

export default router;
