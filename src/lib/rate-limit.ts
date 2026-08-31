import { getRequest } from "@tanstack/react-start/server";

const hits = new Map<string, number[]>();

export function resetRateLimitForTests() {
  hits.clear();
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
) {
  const now = Date.now();
  const key = `${scope}:${ip}`;
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    throw new Error("Zu viele Anfragen. Bitte in ein paar Minuten erneut versuchen.");
  }
  recent.push(now);
  hits.set(key, recent);
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
