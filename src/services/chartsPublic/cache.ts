/**
 * Public Charts Cache Layer
 *
 * In-memory cache for public chart data to avoid repeated fetches
 * on navigation. Runtime public chart data is local/fixture-backed until the
 * new non-WordPress public API is implemented.
 */

export type PublicChartCacheSource = "local" | "api" | "legacy_import";

export interface CachedChart<T> {
  data: T;
  source: PublicChartCacheSource;
  fetchedAt: number;
  isStale: boolean;
}

const cache = new Map<string, CachedChart<unknown>>();
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

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

export function setCachedChart<T>(
  key: string,
  value: T,
  source: PublicChartCacheSource,
  _ttlMs?: number
): void {
  cache.set(key, {
    data: value as unknown,
    source,
    fetchedAt: Date.now(),
    isStale: false,
  });
}

export function clearChartCache(): void {
  cache.clear();
}

export function invalidateChartCache(key: string): void {
  cache.delete(key);
}

export function hasCachedChart(key: string): boolean {
  return cache.has(key);
}
