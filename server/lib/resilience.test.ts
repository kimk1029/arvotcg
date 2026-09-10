import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadinessProbe } from './readiness';
import { DailyCache, DAY_MS, WorkQueue } from './dailyCache';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
};

test('DB outage returns unhealthy and recovers without leaking rejection', async () => {
  let healthy = false;
  const probe = createReadinessProbe(async () => { if (!healthy) throw Error('DB down'); }, 20, 0);
  assert.equal(await probe(), false);
  healthy = true;
  assert.equal(await probe(), true);
});

test('hung DB probe remains single-flight across repeated timeouts', async () => {
  const db = deferred();
  let calls = 0;
  const probe = createReadinessProbe(() => { calls++; return db.promise; }, 10, 0);
  assert.deepEqual(await Promise.all(Array.from({ length: 50 }, () => probe())), Array(50).fill(false));
  assert.equal(await probe(), false);
  assert.equal(calls, 1);
  db.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await probe(), true);
});

test('healthy readiness probes are cached', async () => {
  let calls = 0;
  const probe = createReadinessProbe(async () => { calls++; });
  for (let i = 0; i < 50; i++) assert.equal(await probe(), true);
  assert.equal(calls, 1);
});

test('refresh burst is bounded and foreground work need not wait on optional work', async () => {
  const queue = new WorkQueue(1, 2);
  const work = deferred();
  let calls = 0;
  const first = queue.run(async () => { calls++; await work.promise; });
  const second = queue.run(async () => { calls++; throw Error('refresh failed'); });
  const failed = assert.rejects(second, /refresh failed/);
  const third = queue.run(async () => { calls++; });
  await assert.rejects(queue.run(async () => { calls++; }), /queue full/);
  assert.equal(calls, 1);
  work.resolve();
  await Promise.all([first, failed, third]);
  assert.equal(calls, 3);
});

test('concurrent cold cache misses share a query; stale prices survive DB failure', async () => {
  const cache = new DailyCache<number>(-1);
  const db = deferred();
  let calls = 0;
  const load = async () => { calls++; await db.promise; return 42; };
  const requests = Array.from({ length: 50 }, () => cache.get('price', load));
  db.resolve();
  assert.deepEqual(await Promise.all(requests), Array(50).fill(42));
  assert.equal(calls, 1);
  const fail = async () => { calls++; throw Error('DB down'); };
  assert.equal(await cache.get('price', fail), 42);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await cache.get('price', fail), 42);
  assert.equal(calls, 2);
});

import { loadCollectionDelta } from '../../shared/collectionDelta';
import { processPriceBatch, nextPriceBatchDelay, PRICE_BATCH_INTERVAL_MS } from '../../shared/priceRefreshPolicy';

test('source timestamp expires 23-hour-old prices in one hour, not another day', async t => {
  let now = 10 * DAY_MS;
  t.mock.method(Date, 'now', () => now);
  const cache = new DailyCache<{ at: number }>(DAY_MS, 10, undefined, p => p.at);
  let calls = 0;
  const load = async () => { calls++; return { at: now - 23 * 3600_000 }; };
  await cache.get('price', load, { waitForFresh: true });
  now += 30 * 60_000;
  await cache.get('price', load, { waitForFresh: true });
  assert.equal(calls, 1);
  now += 31 * 60_000;
  await cache.get('price', load, { waitForFresh: true });
  assert.equal(calls, 2);
});

test('background worker awaits actual refresh and does not count stale fallback as success', async () => {
  const cache = new DailyCache<number>(-1);
  cache.set('p', 1);
  const db = deferred();
  let settled = false;
  const request = cache.get('p', async () => { await db.promise; return 2; }, { waitForFresh: true });
  void request.then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  db.resolve();
  assert.equal(await request, 2);
  await assert.rejects(cache.get('p', async () => { throw Error('DB down'); }, { waitForFresh: true }), /DB down/);
  await assert.rejects(cache.get('p', async () => 3, { waitForFresh: true }), /temporarily unavailable/);
  assert.equal(await cache.get('p', async () => 3), 2);
});

test('forced DB read bypasses fresh cache and shares concurrent reads', async () => {
  const cache = new DailyCache<number>();
  cache.set('p', 1);
  const db = deferred();
  let calls = 0;
  const load = async () => { calls++; await db.promise; return 2; };
  const requests = Array.from({ length: 20 }, () => cache.get('p', load, { forceRefresh: true, waitForFresh: true }));
  db.resolve();
  assert.deepEqual(await Promise.all(requests), Array(20).fill(2));
  assert.equal(calls, 1);
});

test('rolling batch caps work at 50 and respects deadlines', async () => {
  let now = 0;
  let calls = 0;
  const options = { ids: Array.from({ length: 100 }, (_, i) => i),
    refresh: async () => { calls++; return true; }, sleep: async (ms: number) => { now += ms; },
    now: () => now, deadline: 300_000, delayMs: 2000, onResult: () => {} };
  assert.equal(await processPriceBatch(options), 50);
  assert.equal(calls, 50);
  now = 0; calls = 0;
  assert.equal(await processPriceBatch({ ...options, deadline: 5000 }), 3);
  assert.equal(calls, 3);
  assert.equal(nextPriceBatchDelay(PRICE_BATCH_INTERVAL_MS + 1000), PRICE_BATCH_INTERVAL_MS - 1000);
});

test('batch stops after three consecutive failures', async () => {
  let calls = 0;
  const done = await processPriceBatch({ ids: [1,2,3,4,5], refresh: async () => { calls++; throw Error('DB down'); },
    sleep: async () => {}, now: () => 0, deadline: 10000, delayMs: 2000, onResult: () => {} });
  assert.equal(done, 3);
  assert.equal(calls, 3);
});

test('delta failures never trigger full collection reload; authentication errors propagate', async () => {
  const cached = [{ id: 1, price: 42 }];
  let fullCalls = 0;
  const base = { cached, loadFull: async () => { fullCalls++; return []; }, merge: () => cached };
  for (const status of [429, 500, 502, 503, 504, undefined]) {
    assert.equal(await loadCollectionDelta({ ...base, loadPrices: async () => { throw { status }; } }), cached);
  }
  assert.equal(await loadCollectionDelta({ ...base, loadPrices: async () => null as any }), cached);
  assert.equal(fullCalls, 0);
  for (const status of [401, 403]) {
    await assert.rejects(loadCollectionDelta({ ...base, loadPrices: async () => { throw { status }; } }), e => (e as any).status === status);
  }
  assert.equal(fullCalls, 0);
  await loadCollectionDelta({ ...base, loadPrices: async () => [{ id: 2 }] });
  assert.equal(fullCalls, 1);
});
