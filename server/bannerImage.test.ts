import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

test('banner derivatives preserve originals, resize, reuse cache and exclude foreign hosts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'banner-test-'));
  const previous = process.env.CARD_CDN_DIR;
  process.env.CARD_CDN_DIR = dir;
  try {
    const { optimizedBannerUrl } = await import('./lib/bannerImage');
    const uploads = join(dir, 'uploads', 'banner');
    await mkdir(uploads, { recursive: true });
    const input = await sharp({ create: { width: 2400, height: 1000, channels: 3, background: '#aa3344' } }).png().toBuffer();
    await writeFile(join(uploads, 'sample.png'), input);
    const url = 'https://www.arvotcg.com/api/cdn/uploads/banner/sample.png';
    const [first, second] = await Promise.all([optimizedBannerUrl(url), optimizedBannerUrl(url)]);
    assert.equal(first, second);
    assert.match(first, /\.webp$/);
    const output = await readFile(join(uploads, first.split('/').pop()!));
    assert.ok(output.length < input.length);
    assert.equal((await sharp(output).metadata()).width, 1440);
    assert.deepEqual(await readFile(join(uploads, 'sample.png')), input);
    assert.equal(await optimizedBannerUrl(url), first);
    const foreign = url.replace('www.arvotcg.com', 'example.com');
    assert.equal(await optimizedBannerUrl(foreign), foreign);
    await assert.rejects(optimizedBannerUrl(url.replace('sample.png', 'missing.png')));
  } finally {
    if (previous === undefined) delete process.env.CARD_CDN_DIR;
    else process.env.CARD_CDN_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
