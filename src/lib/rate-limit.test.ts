import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertRateLimit, clientIp, resetRateLimitForTests } from "./rate-limit.ts";

describe("public form rate limit", () => {
  it("blocks a fourth burst from the same IP in the window", () => {
    resetRateLimitForTests();
    assertRateLimit("t", "1.1.1.1", 3, 60_000);
    assertRateLimit("t", "1.1.1.1", 3, 60_000);
    assertRateLimit("t", "1.1.1.1", 3, 60_000);
    assert.throws(() => assertRateLimit("t", "1.1.1.1", 3, 60_000), /Zu viele Anfragen/);
    assert.doesNotThrow(() => assertRateLimit("t", "8.8.8.8", 3, 60_000));
  });

  it("reads the leftmost forwarded IP", () => {
    const request = new Request("https://white-gloss.de/x", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    assert.equal(clientIp(request), "203.0.113.9");
  });
});
