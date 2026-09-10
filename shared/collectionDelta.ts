/** Full reload only follows a successful delta proving collection membership changed.
 * A timeout, 5xx, rate limit or malformed delta must not trigger a heavier request.
 */
export async function loadCollectionDelta<C extends { id: number }, P extends { id: number }>(options: {
  cached: C[];
  loadPrices: () => Promise<P[]>;
  loadFull: () => Promise<C[]>;
  merge: (cached: C[], prices: P[]) => C[];
}): Promise<C[]> {
  try {
    const prices = await options.loadPrices();
    if (!Array.isArray(prices) || prices.some(p => !p || !Number.isInteger(p.id))) {
      throw new Error('Invalid collection price response');
    }
    const ids = new Set(prices.map(p => p.id));
    if (ids.size !== prices.length) throw new Error('Duplicate collection price IDs');
    if (prices.length !== options.cached.length || options.cached.some(c => !ids.has(c.id))) {
      return await options.loadFull();
    }
    return options.merge(options.cached, prices);
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    // Never mask expired credentials by returning another account's cached data.
    if (status === 401 || status === 403) throw error;
    return options.cached;
  }
}
