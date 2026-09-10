/** Small recurring price batches; caller supplies I/O and time for deterministic tests. */
export const PRICE_BATCH_INTERVAL_MS = 30 * 60_000;
export const PRICE_BATCH_LIMIT = 50;
export const PRICE_BATCH_MAX_MS = 5 * 60_000;
export const PRICE_BATCH_GAP_MS = 2000;

export function nextPriceBatchDelay(now: number): number {
  return PRICE_BATCH_INTERVAL_MS - (now % PRICE_BATCH_INTERVAL_MS);
}

export async function processPriceBatch<T>(options: {
  ids: number[];
  refresh: (id: number) => Promise<T | null>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  deadline: number;
  delayMs: number;
  onResult: (id: number, result: T | null, error?: unknown) => void;
}): Promise<number> {
  let done = 0;
  let consecutiveFailures = 0;
  for (const id of options.ids.slice(0, PRICE_BATCH_LIMIT)) {
    if (options.now() >= options.deadline) break;
    let result: T | null = null;
    let error: unknown;
    try { result = await options.refresh(id); } catch (err) { error = err; }
    done++;
    options.onResult(id, result, error);
    consecutiveFailures = result ? 0 : consecutiveFailures + 1;
    // Avoid spending the entire batch retrying a failing database/upstream.
    if (consecutiveFailures >= 3 || done === options.ids.length) break;
    if (options.now() + options.delayMs >= options.deadline) break;
    await options.sleep(options.delayMs);
  }
  return done;
}
