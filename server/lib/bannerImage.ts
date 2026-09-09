import sharp from 'sharp';
import { access, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CARD_CDN_DIR } from './cardImageCache.js';

export function encodeBanner(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 40_000_000 }).rotate()
    .resize({ width: 1440, withoutEnlargement: true })
    .webp({ quality: 85 }).toBuffer();
}

const pending = new Map<string, Promise<string>>();

/** 로컬 업로드만 파생 파일로 제공한다. 외부 URL은 가져오지 않는다. */
export async function optimizedBannerUrl(value: string): Promise<string> {
  const url = new URL(value, 'https://www.arvotcg.com');
  const hosts = new Set(['arvotcg.com', 'www.arvotcg.com', 'poke-30.com', 'www.poke-30.com']);
  for (const origin of [process.env.UPLOADS_PUBLIC_ORIGIN, process.env.WEB_BASE_URL]) {
    if (origin) hosts.add(new URL(origin).hostname);
  }
  const match = url.pathname.match(/^\/api\/cdn\/uploads\/banner\/([a-zA-Z0-9_-]+\.(?:png|jpe?g))$/i);
  if (!hosts.has(url.hostname) || !match) return value;
  const filename = match[1];
  const existing = pending.get(filename);
  if (existing) return existing.then((path) => value.replace(url.pathname, path));
  const task = (async () => {
    const dir = join(CARD_CDN_DIR, 'uploads', 'banner');
    const output = `${filename}.w1440-q85-v1.webp`;
    const target = join(dir, output);
    try {
      await access(target);
    } catch {
      const input = await readFile(join(dir, filename));
      const encoded = await encodeBanner(input);
      if (encoded.length >= input.length) return url.pathname;
      const temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, encoded);
      await rename(temporary, target);
    }
    return `/api/cdn/uploads/banner/${output}`;
  })();
  pending.set(filename, task);
  try { return value.replace(url.pathname, await task); }
  finally { pending.delete(filename); }
}
