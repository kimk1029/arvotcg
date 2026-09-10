import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const DAY_MS = 86_400_000;

/** Shared bounded queue: optional refreshes never accumulate without a limit. */
export class WorkQueue {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private concurrency = 1, private capacity = 500) {}
  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.waiting.length >= this.capacity) return Promise.reject(new Error('Refresh queue full'));
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.active++;
        Promise.resolve().then(work).then(resolve, reject).finally(() => {
          this.active--;
          this.waiting.shift()?.();
        });
      };
      if (this.active < this.concurrency) start(); else this.waiting.push(start);
    });
  }
}

/** Bounded stale-while-revalidate cache. Concurrent misses share one request; failures back off. */
export class DailyCache<T> {
  private values = new Map<string, { at: number; value: T }>();
  private pending = new Map<string, Promise<T>>();
  private retryAt = new Map<string, number>();
  private loaded: Promise<void>;
  private saving = Promise.resolve();
  constructor(private ttl = DAY_MS, private max = 1000, private file?: string,
    private timestamp?: (value: T) => number) {
    this.loaded = file ? readFile(file, 'utf8').then(text => {
      const entries = JSON.parse(text);
      if (Array.isArray(entries)) for (const [k, v] of entries.slice(-max)) {
        if (typeof k === 'string' && Number.isFinite(v?.at) && 'value' in v) this.values.set(k, v);
      }
    }).catch(() => {}) : Promise.resolve();
  }
  async get(key: string, load: () => Promise<T>, options: { waitForFresh?: boolean; forceRefresh?: boolean } = {}): Promise<T> {
    await this.loaded;
    const old = this.values.get(key);
    if (!options.forceRefresh && old && Date.now() - old.at < this.ttl) return old.value;
    if ((this.retryAt.get(key) ?? 0) > Date.now()) {
      if (old && !options.waitForFresh) return old.value;
      throw new Error('Refresh temporarily unavailable');
    }
    let task = this.pending.get(key);
    if (!task) {
      if (this.pending.size >= this.max) throw new Error('Cache refresh capacity exceeded');
      task = Promise.resolve().then(load).then(value => {
        this.set(key, value);
        return value;
      }).catch(err => {
        this.retryAt.set(key, Date.now() + 60_000);
        if (this.retryAt.size > this.max) this.retryAt.delete(this.retryAt.keys().next().value!);
        throw err;
      }).finally(() => this.pending.delete(key));
      this.pending.set(key, task);
    }
    if (old && !options.waitForFresh) { void task.catch(() => {}); return old.value; }
    return task;
  }
  invalidate(predicate: (key: string) => boolean) {
    for (const key of this.values.keys()) if (predicate(key)) this.values.delete(key);
  }
  set(key: string, value: T) {
    this.values.delete(key);
    const sourceAt = this.timestamp ? this.timestamp(value) : Date.now();
    this.values.set(key, { at: Number.isFinite(sourceAt) ? Math.min(sourceAt, Date.now()) : 0, value });
    this.retryAt.delete(key);
    while (this.values.size > this.max) this.values.delete(this.values.keys().next().value!);
    if (this.file) this.saving = this.saving.then(async () => {
      await mkdir(dirname(this.file!), { recursive: true });
      await writeFile(this.file! + '.tmp', JSON.stringify([...this.values]));
      await rename(this.file! + '.tmp', this.file!);
    }).catch(err => console.warn('[dailyCache.persist]', err.message));
  }
}

export const priceWork = new WorkQueue(1, 500);

const staticCache = new DailyCache<boolean>(DAY_MS, 25000);
export async function dailyStaticWrite(key: string, write: () => Promise<unknown>): Promise<void> {
  await staticCache.get(key, () => priceWork.run(async () => { await write(); return true; }));
}
