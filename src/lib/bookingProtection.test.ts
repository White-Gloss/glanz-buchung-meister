import { describe, expect, it } from "vitest";

import { clientAddress, createBookingRateLimiter } from "./bookingProtection";

describe("createBookingRateLimiter", () => {
  it("allows the configured number of booking attempts in one time window", () => {
    const limiter = createBookingRateLimiter({ limit: 2, windowMs: 60_000, now: () => 1_000 });

    expect(limiter.check("198.51.100.7")).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.check("198.51.100.7")).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("rejects further attempts from the same visitor until the time window expires", () => {
    let now = 1_000;
    const limiter = createBookingRateLimiter({ limit: 2, windowMs: 60_000, now: () => now });

    limiter.check("198.51.100.7");
    limiter.check("198.51.100.7");

    expect(limiter.check("198.51.100.7")).toEqual({ allowed: false, retryAfterSeconds: 60 });

    now += 60_000;
    expect(limiter.check("198.51.100.7")).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("keeps visitors separate", () => {
    const limiter = createBookingRateLimiter({ limit: 1, windowMs: 60_000, now: () => 1_000 });

    expect(limiter.check("198.51.100.7").allowed).toBe(true);
    expect(limiter.check("203.0.113.8").allowed).toBe(true);
  });

  it("forgets expired visitors instead of growing without bound", () => {
    let now = 0;
    const limiter = createBookingRateLimiter({
      limit: 1,
      windowMs: 1_000,
      maxKeys: 3,
      now: () => now,
    });

    limiter.check("203.0.113.1");
    limiter.check("203.0.113.2");
    limiter.check("203.0.113.3");
    expect(limiter.size()).toBe(3);

    // Alle Fenster sind abgelaufen: der nächste Absender räumt sie ab.
    now = 1_000;
    limiter.check("203.0.113.4");
    expect(limiter.size()).toBe(1);
  });

  it("stays bounded even while every window is still running", () => {
    const limiter = createBookingRateLimiter({
      limit: 5,
      windowMs: 60_000,
      maxKeys: 3,
      now: () => 1_000,
    });

    for (let index = 0; index < 50; index += 1) {
      expect(limiter.check(`203.0.113.${index}`).allowed).toBe(true);
    }

    expect(limiter.size()).toBeLessThanOrEqual(3);
  });

  it("keeps counting a visitor that stays within the retained set", () => {
    const limiter = createBookingRateLimiter({
      limit: 2,
      windowMs: 60_000,
      maxKeys: 2,
      now: () => 1_000,
    });

    expect(limiter.check("203.0.113.9").allowed).toBe(true);
    expect(limiter.check("203.0.113.9").allowed).toBe(true);
    expect(limiter.check("203.0.113.9").allowed).toBe(false);
  });

  it("allows a new attempt after the time window elapsed", () => {
    let now = 0;
    const limiter = createBookingRateLimiter({ limit: 1, windowMs: 1_000, now: () => now });
    expect(limiter.check("203.0.113.3").allowed).toBe(true);
    expect(limiter.check("203.0.113.3").allowed).toBe(false);
    now = 1_000;
    expect(limiter.check("203.0.113.3").allowed).toBe(true);
  });
});

describe("clientAddress", () => {
  it("takes the entry the own proxy appended, not the one the caller sent", () => {
    // Der eigene Proxy hängt hinten an. Der vorderste Eintrag stammt vom
    // Absender selbst und ist damit frei wählbar.
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.4, 10.0.0.1" }))).toBe(
      "10.0.0.1",
    );
  });

  it("cannot be shaken off by a forged chain", () => {
    const erste = clientAddress(new Headers({ "x-forwarded-for": "1.1.1.1, 198.51.100.7" }));
    const zweite = clientAddress(new Headers({ "x-forwarded-for": "2.2.2.2, 198.51.100.7" }));
    const dritte = clientAddress(
      new Headers({ "x-forwarded-for": "3.3.3.3, 4.4.4.4, 198.51.100.7" }),
    );

    // Trotz wechselnder Fantasieadressen immer derselbe Zähler.
    expect(erste).toBe("198.51.100.7");
    expect(zweite).toBe("198.51.100.7");
    expect(dritte).toBe("198.51.100.7");
  });

  it("works the same when the proxy replaces the header instead of appending", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("ignores empty entries in the chain", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "1.1.1.1, , " }))).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip and a safe default", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5");
    expect(clientAddress(undefined)).toBe("unbekannt");
  });
});
