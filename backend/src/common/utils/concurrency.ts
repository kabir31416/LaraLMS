/**
 * Runs `fn` over `items` with at most `concurrency` in flight at once —
 * never an unbounded `Promise.all` (which could burst-hit an external
 * gateway with the whole list at once) and never a fully sequential loop
 * (which multiplies each call's latency by the item count). No new
 * dependency: a small worker-pool over a shared cursor index, safe under
 * Node's single-threaded event loop since each worker only touches the
 * shared `next` counter synchronously between `await` points.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}
