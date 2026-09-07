import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IMMUTABLE_ASSET_CACHE_CONTROL,
  REVALIDATE_CACHE_CONTROL,
  responseCacheControl,
} from "./cache-policy.ts";

describe("responseCacheControl", () => {
  it("keeps content-hashed build assets immutable", () => {
    for (const pathname of ["/assets/index-C4qpzQj3.js", "/assets/styles-B_9ph-23.css"]) {
      assert.equal(responseCacheControl({ pathname }), IMMUTABLE_ASSET_CACHE_CONTROL);
    }
  });

  it("revalidates mutable media, fonts, icons, scripts and manifests", () => {
    for (const pathname of [
      "/media/lack-1200.avif",
      "/media/hero-loop.webm",
      "/fonts/barlow-300.woff2",
      "/favicon.svg",
      "/assets/app.js",
      "/site.webmanifest",
      "/__grok/manifest.webmanifest",
    ]) {
      assert.equal(responseCacheControl({ pathname }), REVALIDATE_CACHE_CONTROL);
    }
  });

  it("does not overwrite private or stricter cache directives", () => {
    for (const existing of [
      "private, max-age=60",
      "no-store",
      "public, no-cache",
      "Private=Set-Cookie",
    ]) {
      assert.equal(
        responseCacheControl({ pathname: "/assets/app-C4qpzQj3.js", existing }),
        undefined,
      );
    }
  });

  it("never makes a response that sets a session cookie public", () => {
    assert.equal(
      responseCacheControl({ pathname: "/", contentType: "text/html", hasSetCookie: true }),
      "private, no-store",
    );
  });

  it("does not assign asset caching to failures, redirects or writes", () => {
    for (const status of [301, 404, 500]) {
      assert.equal(responseCacheControl({ pathname: "/media/lack.avif", status }), undefined);
    }
    assert.equal(responseCacheControl({ pathname: "/media/lack.avif", method: "POST" }), undefined);
  });

  it("leaves dynamic API response caching to the endpoint", () => {
    assert.equal(
      responseCacheControl({ pathname: "/api/auth/get-session", contentType: "application/json" }),
      undefined,
    );
  });

  it("revalidates HTML even if its URL resembles an asset", () => {
    assert.equal(
      responseCacheControl({
        pathname: "/assets/missing-C4qpzQj3.js",
        contentType: "text/html; charset=utf-8",
      }),
      REVALIDATE_CACHE_CONTROL,
    );
  });
});
