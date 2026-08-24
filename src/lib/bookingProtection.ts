type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  now?: () => number;
  /** Obergrenze der gleichzeitig verwalteten Absender. */
  maxKeys?: number;
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
 * Voreingestellte Obergrenze der verwalteten Absender. Ohne sie würde jeder
 * neue Absender dauerhaft Speicher belegen: ein Angreifer mit wechselnden
 * Adressen könnte den Prozess so allein durch Anfragen vollaufen lassen.
 */
const DEFAULT_MAX_KEYS = 10_000;

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
  maxKeys = DEFAULT_MAX_KEYS,
}: RateLimiterOptions) {
  const buckets = new Map<string, RateLimitBucket>();

  /**
   * Räumt abgelaufene Fenster ab. Reicht das nicht, weichen die ältesten
   * Einträge: deren Zähler beginnt beim nächsten Versuch von vorn, die
   * Obergrenze pro Zeitfenster bleibt für alle anderen aber verbindlich.
   */
  function prune(timestamp: number): void {
    for (const [key, bucket] of buckets) {
      if (timestamp >= bucket.resetAt) buckets.delete(key);
    }
    if (buckets.size < maxKeys) return;
    const excess = buckets.size - maxKeys + 1;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++removed >= excess) break;
    }
  }

  return {
    /** Nur für Tests und Diagnose: Anzahl der aktuell verwalteten Absender. */
    size(): number {
      return buckets.size;
    },

    check(key: string): RateLimitResult {
      const timestamp = now();
      const current = buckets.get(key);
      if (!current || timestamp >= current.resetAt) {
        if (!current && buckets.size >= maxKeys) prune(timestamp);
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
