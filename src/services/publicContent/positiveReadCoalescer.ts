/**
 * Coalesce identical public reads within a browser session.
 *
 * This does not cache failures or empty results, impose a time-based stale
 * cache, or introduce a second publication authority. An explicit invalidation
 * ensures an older in-flight response cannot repopulate the cache.
 */
export class PositiveReadCoalescer<K, V> {
  private readonly accepted = new Map<K, V>();
  private readonly inFlight = new Map<K, Promise<V>>();

  constructor(private readonly isCacheable: (value: V) => boolean) {}

  read(key: K, request: () => Promise<V>): Promise<V> {
    if (this.accepted.has(key)) {
      return Promise.resolve(this.accepted.get(key)!);
    }

    const active = this.inFlight.get(key);
    if (active) return active;

    const current = Promise.resolve()
      .then(request)
      .then((value) => {
        if (this.inFlight.get(key) === current && this.isCacheable(value)) {
          this.accepted.set(key, value);
        }
        return value;
      })
      .finally(() => {
        if (this.inFlight.get(key) === current) this.inFlight.delete(key);
      });

    this.inFlight.set(key, current);
    return current;
  }

  clear(key?: K): void {
    if (key !== undefined) {
      this.accepted.delete(key);
      this.inFlight.delete(key);
      return;
    }
    this.accepted.clear();
    this.inFlight.clear();
  }
}
