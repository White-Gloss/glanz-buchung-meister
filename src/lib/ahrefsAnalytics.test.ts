import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AHREFS_ANALYTICS_SRC,
  ahrefsAnalyticsKey,
  ahrefsAnalyticsScripts,
} from "./ahrefsAnalytics";

function setKey(value: string | undefined) {
  vi.stubEnv("VITE_AHREFS_ANALYTICS_KEY", value as string);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ahrefsAnalyticsKey", () => {
  it("trims the configured key", () => {
    setKey("  abc123  ");
    expect(ahrefsAnalyticsKey()).toBe("abc123");
  });

  it("treats a missing or blank key as not configured", () => {
    setKey(undefined);
    expect(ahrefsAnalyticsKey()).toBe("");
    setKey("   ");
    expect(ahrefsAnalyticsKey()).toBe("");
  });
});

describe("ahrefsAnalyticsScripts", () => {
  it("delivers no script at all without a key", () => {
    setKey("");
    expect(ahrefsAnalyticsScripts()).toEqual([]);
  });

  it("delivers exactly one async script carrying the key", () => {
    setKey("jna5AqNKJvUjKCDy2ZLWsw");
    const scripts = ahrefsAnalyticsScripts();

    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toEqual({
      src: AHREFS_ANALYTICS_SRC,
      async: true,
      "data-key": "jna5AqNKJvUjKCDy2ZLWsw",
    });
  });

  it("loads from the host the security policy allows", () => {
    setKey("abc");
    // Ändert sich die Adresse, muss src/server.ts mitgezogen werden.
    expect(new URL(ahrefsAnalyticsScripts()[0].src).origin).toBe("https://analytics.ahrefs.com");
  });
});
