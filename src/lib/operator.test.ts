import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isOperatorEmail,
  isOperatorProviderAccount,
  operatorEmails,
  operatorEnforcementEnabled,
} from "./operator.ts";

describe("operator allowlist", () => {
  it("always includes the public business address", () => {
    assert.ok(operatorEmails().includes("info@white-gloss.de"));
  });

  it("accepts white-gloss.de mailboxes and rejects consumer accounts", () => {
    assert.equal(isOperatorEmail("info@white-gloss.de"), true);
    assert.equal(isOperatorEmail("lars@white-gloss.de"), true);
    assert.equal(isOperatorEmail("someone@gmail.com"), false);
    assert.equal(isOperatorEmail(""), false);
    assert.equal(isOperatorEmail(null), false);
  });

  it("honours ADMIN_EMAILS and OWNER_EMAIL", () => {
    const prevAdmin = process.env.ADMIN_EMAILS;
    const prevOwner = process.env.OWNER_EMAIL;
    process.env.ADMIN_EMAILS = "chef@example.com, team@example.org";
    process.env.OWNER_EMAIL = "inhaber@example.net";
    try {
      assert.equal(isOperatorEmail("chef@example.com"), true);
      assert.equal(isOperatorEmail("team@example.org"), true);
      assert.equal(isOperatorEmail("inhaber@example.net"), true);
    } finally {
      if (prevAdmin === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = prevAdmin;
      if (prevOwner === undefined) delete process.env.OWNER_EMAIL;
      else process.env.OWNER_EMAIL = prevOwner;
    }
  });

  it("honours explicit provider/account allowlist entries", () => {
    const prevMapped = process.env.ADMIN_PROVIDER_ACCOUNTS;
    const prevX = process.env.ADMIN_X_ACCOUNT_IDS;
    const prevOwnerX = process.env.OWNER_X_ACCOUNT_ID;
    process.env.ADMIN_PROVIDER_ACCOUNTS = "grok-google:google-sub-1, grok-x:x-sub-2";
    process.env.ADMIN_X_ACCOUNT_IDS = "x-sub-3";
    process.env.OWNER_X_ACCOUNT_ID = "x-owner";
    try {
      assert.equal(isOperatorProviderAccount("grok-google", "google-sub-1"), true);
      assert.equal(isOperatorProviderAccount("grok-x", "x-sub-2"), true);
      assert.equal(isOperatorProviderAccount("grok-x", "x-sub-3"), true);
      assert.equal(isOperatorProviderAccount("grok-x", "x-owner"), true);
      assert.equal(isOperatorProviderAccount("grok-x", "not-allowed"), false);
    } finally {
      if (prevMapped === undefined) delete process.env.ADMIN_PROVIDER_ACCOUNTS;
      else process.env.ADMIN_PROVIDER_ACCOUNTS = prevMapped;
      if (prevX === undefined) delete process.env.ADMIN_X_ACCOUNT_IDS;
      else process.env.ADMIN_X_ACCOUNT_IDS = prevX;
      if (prevOwnerX === undefined) delete process.env.OWNER_X_ACCOUNT_ID;
      else process.env.OWNER_X_ACCOUNT_ID = prevOwnerX;
    }
  });

  it("defaults enforcement to production only", () => {
    const prev = process.env.OPERATOR_ENFORCE;
    delete process.env.OPERATOR_ENFORCE;
    try {
      assert.equal(operatorEnforcementEnabled(), process.env.NODE_ENV === "production");
    } finally {
      if (prev === undefined) delete process.env.OPERATOR_ENFORCE;
      else process.env.OPERATOR_ENFORCE = prev;
    }
  });
});
