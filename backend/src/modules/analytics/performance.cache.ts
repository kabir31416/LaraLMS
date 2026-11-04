/**
 * In-process cache for computed performance analytics (performance.service.ts).
 * Entries live for 60 s at most; anything that writes marks, attendance or the
 * analytics rules calls invalidatePerformanceCache() so a change shows up on
 * the next request on this instance. On multi-instance hosting another
 * instance may serve a result up to 60 s old — the UI's refresh (fresh=1)
 * always recomputes.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 40;
const store = new Map<string, { at: number; value: unknown }>();

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) { store.delete(key); return null; }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown): void {
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
  store.set(key, { at: Date.now(), value });
}

export function invalidatePerformanceCache(): void {
  store.clear();
}
