export function cmsEnabled(config: { enabled?: string; isolatedCi: boolean }): boolean {
  return config.enabled === "true" || config.isolatedCi;
}

export function createOptionalCmsReader(options: { enabled?: () => boolean | Promise<boolean>; budgetMs?: number; cooldownMs?: number; maxPending?: number; onFailure?: (reason: "timeout" | "unavailable") => void } = {}) {
  let retryAfter = 0;
  const pending = new Map<string, { promise: Promise<unknown>; deadline: number }>();
  const fail = (reason: "timeout" | "unavailable") => {
    const alreadyOpen = Date.now() < retryAfter;
    retryAfter = Date.now() + (options.cooldownMs ?? 10000);
    if (!alreadyOpen) options.onFailure?.(reason);
  };
  return async function read<T>(key: string, work: () => Promise<T>): Promise<T | null> {
    if (options.enabled && !(await options.enabled())) return null;
    if (Date.now() < retryAfter) return null;
    let entry = pending.get(key);
    if (!entry) {
      if (pending.size >= (options.maxPending ?? 32)) return null;
      const promise = Promise.resolve().then(work).catch(() => { fail("unavailable"); return null; });
      entry = { promise, deadline: Date.now() + (options.budgetMs ?? 750) };
      pending.set(key, entry);
      // Keep only in-flight work, never a completed publication. A hung query cannot
      // cause unbounded duplicate database work after the response budget expires.
      void promise.then(() => { pending.delete(key); });
    }
    const remaining = entry.deadline - Date.now();
    if (remaining <= 0) { fail("timeout"); return null; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        entry.promise as Promise<T | null>,
        new Promise<null>((resolve) => { timer = setTimeout(() => { fail("timeout"); resolve(null); }, remaining); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  };
}
