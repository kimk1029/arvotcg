import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadinessProbe } from './readiness';
import { DailyCache, WorkQueue } from './dailyCache';

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
