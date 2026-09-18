import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hubAuthorized, hubRequestSchema, hubSecretConfigured } from "./hub-sync-auth.ts";

describe("hubAuthorized", () => {
  it("requires a strong bearer secret", () => {
    const secret = "a".repeat(32);
    assert.equal(hubSecretConfigured(secret), true);
    assert.equal(hubAuthorized(`Bearer ${secret}`, secret), true);
    assert.equal(hubAuthorized(secret, secret), false);
    assert.equal(hubAuthorized(`Bearer ${"b".repeat(32)}`, secret), false);
    assert.equal(hubAuthorized(`Bearer ${secret}`, ""), false);
    assert.equal(hubSecretConfigured("short"), false);
  });
});

describe("hubRequestSchema", () => {
  it("accepts list, confirm, status, qonto", () => {
    assert.equal(hubRequestSchema.parse({ action: "list" }).action, "list");
    assert.equal(hubRequestSchema.parse({ action: "confirm", id: 12, expectedVersion: 1 }).action, "confirm");
    assert.equal(
      hubRequestSchema.parse({ action: "status", id: 12, expectedVersion: 1, status: "erledigt" }).action,
      "status",
    );
    assert.equal(hubRequestSchema.parse({ action: "qonto_send", id: 12 }).action, "qonto_send");
  });

  it("rejects confirming through the generic status action", () => {
    const parsed = hubRequestSchema.safeParse({
      action: "status",
      id: 1,
      expectedVersion: 1,
      status: "bestaetigt",
    });
    assert.equal(parsed.success, false);
  });
});
