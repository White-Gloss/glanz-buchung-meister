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

/**
 * Adresse des Absenders, so wie sie sich für eine Drosselung verwenden lässt.
 *
 * ES IST DER LETZTE EINTRAG, NICHT DER ERSTE.
 *
 * `X-Forwarded-For` ist eine Liste, in der jeder durchlaufene Proxy hinten
 * anhängt. Der vorderste Eintrag stammt damit von dem, der die Anfrage
 * gestellt hat — er ist frei erfunden, wenn der Absender den Header schon
 * selbst mitschickt. Genau das war hier der Fall: Wer bei jeder Anfrage eine
 * andere Fantasieadresse voranstellt, bekommt jedes Mal einen frischen
 * Zähler und läuft an der Drosselung vorbei.
 *
 * Verlässlich ist nur der Eintrag, den der eigene Proxy angehängt hat, und
 * das ist der letzte. Ersetzt der Proxy den Header stattdessen vollständig,
 * gibt es nur einen Eintrag — dann sind erster und letzter derselbe, die
 * Regel stimmt also in beiden Fällen.
 *
 * ANNAHME: Genau ein eigener Proxy vor der Anwendung (Caddy auf demselben
 * Rechner, siehe `docs/ionos-vps-bootstrap.md`). Käme später ein Dienst wie
 * ein CDN davor, wäre der letzte Eintrag dessen Adresse und alle Besucher
 * teilten sich einen Zähler; dann muss hier der vorletzte Eintrag gewählt
 * werden.
 */
export function clientAddress(headers: Headers | undefined): string {
  const kette = headers?.get("x-forwarded-for");
  if (kette) {
    const eintraege = kette
      .split(",")
      .map((teil) => teil.trim())
      .filter(Boolean);
    const letzter = eintraege.at(-1);
    if (letzter) return letzter;
  }
  return headers?.get("x-real-ip")?.trim() || "unbekannt";
}
