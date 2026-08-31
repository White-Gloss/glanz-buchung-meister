import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { site } from "../../data/site.ts";
import {
  previewOAuthFallbackAllowed,
  productionSiteOrigins,
  resolveBetterAuthBaseURL,
  uniqueOrigins,
} from "./public-origin.ts";

describe("production auth origins", () => {
  it("trusts the public site origin and www", () => {
    const origins = productionSiteOrigins();
    assert.ok(origins.includes(site.origin));
    assert.ok(origins.includes("https://www.white-gloss.de"));
    assert.equal(
      origins.some((origin) => origin.includes("localhost")),
      false,
    );
  });

  it("uses the public site as Better Auth base URL in production when env is empty", () => {
    assert.equal(resolveBetterAuthBaseURL(undefined, "production"), site.origin);
    assert.equal(resolveBetterAuthBaseURL("  ", "production"), site.origin);
    assert.equal(resolveBetterAuthBaseURL(undefined, "development"), undefined);
    assert.equal(
      resolveBetterAuthBaseURL("https://auth-override.example", "production"),
      "https://auth-override.example",
    );
  });

  it("does not use the Grok preview OAuth client in production", () => {
    assert.equal(previewOAuthFallbackAllowed("production"), false);
    assert.equal(previewOAuthFallbackAllowed("development"), true);
    assert.equal(previewOAuthFallbackAllowed("test"), true);
  });

  it("deduplicates origins", () => {
    assert.deepEqual(uniqueOrigins([site.origin, `${site.origin}/`, site.origin, ""]), [
      site.origin,
    ]);
  });
});
