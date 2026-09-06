import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createUploadCapability,
  UPLOAD_CAPABILITY_TTL_SECONDS,
  uploadCapabilityCookieName,
  verifyUploadCapability,
} from "./booking-upload-capability.ts";

const issuedAt = new Date("2026-09-06T10:00:00.000Z");

describe("private booking upload capability", () => {
  it("generates independent tokens and stores a hash with exactly seven days of validity", () => {
    const first = createUploadCapability(issuedAt);
    const second = createUploadCapability(issuedAt);
    assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
    assert.match(first.hash, /^[a-f0-9]{64}$/);
    assert.notEqual(first.token, second.token);
    assert.notEqual(first.hash, second.hash);
    assert.equal(Date.parse(first.expiresAt) - issuedAt.getTime(), UPLOAD_CAPABILITY_TTL_SECONDS * 1000);
    assert.equal(verifyUploadCapability(first.token, first.hash, first.expiresAt, issuedAt), true);
  });

  it("rejects another booking's token and does not accept the persisted hash as a token", () => {
    const first = createUploadCapability(issuedAt);
    const second = createUploadCapability(issuedAt);
    assert.equal(verifyUploadCapability(second.token, first.hash, first.expiresAt, issuedAt), false);
    assert.equal(verifyUploadCapability(first.hash, first.hash, first.expiresAt, issuedAt), false);
  });

  it("expires at the exact deadline for both PostgreSQL Date and text representations", () => {
    const capability = createUploadCapability(issuedAt);
    const expiry = new Date(capability.expiresAt);
    const before = new Date(expiry.getTime() - 1);
    assert.equal(verifyUploadCapability(capability.token, capability.hash, expiry, before), true);
    assert.equal(verifyUploadCapability(capability.token, capability.hash, capability.expiresAt, expiry), false);
    assert.equal(verifyUploadCapability(capability.token, capability.hash, expiry, expiry), false);
  });

  it("denies missing, legacy, malformed and expired credentials without throwing", () => {
    const capability = createUploadCapability(issuedAt);
    for (const token of [undefined, "", "WG-1", "x".repeat(44), "!".repeat(43)]) {
      assert.equal(verifyUploadCapability(token, capability.hash, capability.expiresAt, issuedAt), false);
    }
    for (const hash of [null, "", "0".repeat(63), "g".repeat(64)]) {
      assert.equal(verifyUploadCapability(capability.token, hash, capability.expiresAt, issuedAt), false);
    }
    for (const expiry of [null, "", "invalid-date", "2026-09-01T00:00:00Z", new Date(NaN)]) {
      assert.equal(verifyUploadCapability(capability.token, capability.hash, expiry, issuedAt), false);
    }
  });

  it("scopes cookies to a booking and uses host-only secure names on HTTPS", () => {
    assert.equal(uploadCapabilityCookieName(42, true), "__Host-wg-upload-42");
    assert.equal(uploadCapabilityCookieName(42, false), "wg-upload-42");
    assert.notEqual(uploadCapabilityCookieName(42, true), uploadCapabilityCookieName(43, true));
  });
});
