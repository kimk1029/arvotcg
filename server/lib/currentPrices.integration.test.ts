import test from 'node:test';
import assert from 'node:assert/strict';

const url = process.env.PRICE_TEST_DATABASE_URL;
test('Postgres: skipped writes preserve source age; expiry writes new prices; partial cannot overwrite full', { skip: !url }, async t => {
  const parsed = new URL(url!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname));
  assert.equal(parsed.pathname, '/pf30_price_test');
  process.env.DATABASE_URL = url;
  process.env.APP_ENV = 'test';
  const { prisma } = await import('./prisma.js');
  const { saveCurrentPrice, readCurrentPrices } = await import('./currentPrices');
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE snkrdunk_current_prices (
      "apparelId" INTEGER PRIMARY KEY, "minPrice" INTEGER NOT NULL DEFAULT 0,
      "listingCount" INTEGER NOT NULL DEFAULT 0, "priceSingle" INTEGER NOT NULL DEFAULT 0,
      "pricePsa10" INTEGER NOT NULL DEFAULT 0, "pricePsa9" INTEGER NOT NULL DEFAULT 0,
      "pricePsa8" INTEGER NOT NULL DEFAULT 0, "headlinePrice" INTEGER NOT NULL DEFAULT 0,
      "headlineBasis" TEXT, trend JSONB, "representativePrice" INTEGER NOT NULL DEFAULT 0,
      "isFull" BOOLEAN NOT NULL DEFAULT false, "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await prisma.$executeRawUnsafe('CREATE TABLE snkrdunk_price_snapshots (LIKE snkrdunk_current_prices INCLUDING DEFAULTS)');
    await prisma.$executeRaw`INSERT INTO snkrdunk_current_prices ("apparelId", "minPrice", "priceSingle", "isFull", "fetchedAt")
      VALUES (1, 100, 100, true, NOW() - INTERVAL '23 hours')`;
    const original = (await readCurrentPrices([1], { fresh: true }))[0];
    const skippedAt = await saveCurrentPrice(1, { minPrice: 200, priceSingle: 200 });
    assert.equal(skippedAt, original.fetchedAt.getTime());
    assert.equal((await readCurrentPrices([1], { fresh: true }))[0].priceSingle, 100);
    // Simulate the next two hours and a now-expired DB row.
    const now = Date.now();
    t.mock.method(Date, 'now', () => now + 2 * 3600_000);
    await prisma.$executeRaw`UPDATE snkrdunk_current_prices SET "fetchedAt" = NOW() - INTERVAL '25 hours' WHERE "apparelId" = 1`;
    const writtenAt = await saveCurrentPrice(1, { minPrice: 200, priceSingle: 200 });
    assert.ok(writtenAt > skippedAt);
    assert.equal((await readCurrentPrices([1], { fresh: true }))[0].priceSingle, 200);
    await saveCurrentPrice(1, { minPrice: 10 });
    assert.equal((await readCurrentPrices([1], { fresh: true }))[0].minPrice, 200);
    await saveCurrentPrice(2, { minPrice: 50 });
    await saveCurrentPrice(2, { minPrice: 60, priceSingle: 60 });
    assert.equal((await readCurrentPrices([2], { fresh: true }))[0].priceSingle, 60);
    const counts = await prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM snkrdunk_price_snapshots`;
    assert.equal(counts[0].count, 3);
  } finally {
    await prisma.$disconnect();
  }
});
