type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  now?: () => number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

/**
 * Kleine In-Memory-Drosselung für öffentliche Buchungsversuche.
 * Die DB bleibt die verbindliche fachliche Instanz; dieser Schutz reduziert
 * nur automatisierte Anfragen pro App-Instanz. Bei mehreren Instanzen sollte
 * zusätzlich ein vorgelagerter IONOS/WAF- oder Redis-Rate-Limiter greifen.
 */
export function createBookingRateLimiter({
  limit,
  windowMs,
  now = () => Date.now(),
}: RateLimiterOptions) {
  const buckets = new Map<string, RateLimitBucket>();

  return {
    check(key: string): RateLimitResult {
      const timestamp = now();
      const current = buckets.get(key);
      if (!current || timestamp >= current.resetAt) {
        buckets.set(key, { count: 1, resetAt: timestamp + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (current.count >= limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - timestamp) / 1_000)),
        };
      }

      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

export function clientAddress(headers: Headers | undefined): string {
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers?.get("x-real-ip")?.trim() || "unbekannt";
}
