/** A timed-out probe keeps its slot until the DB operation actually settles.
 * Promise.race alone would let repeated health checks exhaust the same pool.
 */
export function createReadinessProbe(check: () => Promise<unknown>, timeoutMs = 2500, ttlMs = 5000) {
  let running: Promise<boolean> | undefined;
  let cached: { ok: boolean; until: number } | undefined;
  return async (): Promise<boolean> => {
    if (cached && Date.now() < cached.until) return cached.ok;
    if (!running) {
      running = Promise.resolve().then(check).then(() => true, () => false)
        .finally(() => { running = undefined; });
    }
    let timer: ReturnType<typeof setTimeout>;
    const ok = await Promise.race([
      running,
      new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
    clearTimeout(timer!);
    cached = { ok, until: Date.now() + ttlMs };
    return ok;
  };
}
