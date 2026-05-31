/**
 * Public Charts Cache Layer
 *
 * In-memory cache for public chart data to avoid repeated fetches
 * on navigation. Both mock and WordPress modes use the same cache.
 */

export interface CachedChart<T> {
  data: T;
  source: "mock" | "wordpress";
  fetchedAt: number;
  isStale: boolean;
}

const cache = new Map<string, CachedChart<unknown>>();
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieve a cached chart entry by key.
 * Returns null if not found.
 * Sets isStale=true if the entry has exceeded its TTL.
 */
export function getCachedChart<T>(key: string): CachedChart<T> | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.fetchedAt;
  const isStale = age > DEFAULT_CACHE_TTL;

  return {
    data: entry.data as T,
    source: entry.source,
    fetchedAt: entry.fetchedAt,
    isStale,
  };
}

/**
 * Store a chart entry in the cache.
 * @param source — whether the data came from mock or wordpress
 * @param ttlMs — optional override (default 5 minutes)
 */
export function setCachedChart<T>(
  key: string,
  value: T,
  source: "mock" | "wordpress",
  ttlMs?: number
): void {
  cache.set(key, {
    data: value as unknown,
    source,
    fetchedAt: Date.now(),
    isStale: false,
  });
}

/** Clear the entire chart cache. */
export function clearChartCache(): void {
  cache.clear();
}

/** Remove a single key from the cache. */
export function invalidateChartCache(key: string): void {
  cache.delete(key);
}

/** Check if a key exists in the cache (even if stale). */
export function hasCachedChart(key: string): boolean {
  return cache.has(key);
}