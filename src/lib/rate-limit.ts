import { getRequest } from "@tanstack/react-start/server";

type Bucket = { stamps: number[]; windowMs: number };

// IP-bezogene Zähler liegen nur im Arbeitsspeicher. Abgelaufene Einträge
// werden spätestens eine Minute nach Ablauf ihres Fensters entfernt, damit
// keine IP-Adressen über die Lebensdauer des Prozesses angesammelt werden.
const hits = new Map<string, Bucket>();
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

export function resetRateLimitForTests() {
  hits.clear();
  lastSweep = 0;
}

export function rateLimitEntryCountForTests() {
  return hits.size;
}

function sweepExpired(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of hits) {
    if (!bucket.stamps.some((stamp) => now - stamp < bucket.windowMs)) hits.delete(key);
  }
}

export function clientIp(request?: Request | null): string {
  const headers = request?.headers;
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 64);
  const real = headers?.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

export function assertRateLimit(
  scope: string,
  ip: string,
  limit = 8,
  windowMs = 10 * 60 * 1000,
  now = Date.now(),
) {
  sweepExpired(now);
  const key = `${scope}:${ip}`;
  const recent = (hits.get(key)?.stamps ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    hits.set(key, { stamps: recent, windowMs });
    throw new Error("Zu viele Anfragen. Bitte in ein paar Minuten erneut versuchen.");
  }
  recent.push(now);
  hits.set(key, { stamps: recent, windowMs });
}

export function assertPublicPostLimit(scope: string, limit = 8, windowMs = 10 * 60 * 1000) {
  let request: Request | null = null;
  try {
    request = getRequest() ?? null;
  } catch {
    request = null;
  }
  assertRateLimit(scope, clientIp(request), limit, windowMs);
}
