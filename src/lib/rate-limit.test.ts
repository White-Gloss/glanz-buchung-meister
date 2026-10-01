import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertRateLimit,
  clientIp,
  rateLimitEntryCountForTests,
  resetRateLimitForTests,
} from "./rate-limit.ts";

describe("public form rate limit", () => {
  it("blocks a fourth burst from the same IP in the window", () => {
    resetRateLimitForTests();
    assertRateLimit("t", "1.1.1.1", 3, 60_000);
    assertRateLimit("t", "1.1.1.1", 3, 60_000);
    assertRateLimit("t", "1.1.1.1", 3, 60_000);
    assert.throws(() => assertRateLimit("t", "1.1.1.1", 3, 60_000), /Zu viele Anfragen/);
    assert.doesNotThrow(() => assertRateLimit("t", "8.8.8.8", 3, 60_000));
  });

  it("drops expired IP entries instead of keeping them for the process lifetime", () => {
    resetRateLimitForTests();
    const start = 1_000_000;
    assertRateLimit("t", "1.1.1.1", 3, 60_000, start);
    assertRateLimit("u", "2.2.2.2", 3, 600_000, start);
    assert.equal(rateLimitEntryCountForTests(), 2);
    // After the short window plus one sweep interval only the long window survives.
    assertRateLimit("t", "3.3.3.3", 3, 60_000, start + 121_000);
    assert.equal(rateLimitEntryCountForTests(), 2);
    assertRateLimit("t", "3.3.3.3", 3, 60_000, start + 661_000);
    assert.equal(rateLimitEntryCountForTests(), 1);
  });

  it("reads the leftmost forwarded IP", () => {
    const request = new Request("https://white-gloss.de/x", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    assert.equal(clientIp(request), "203.0.113.9");
  });
});
