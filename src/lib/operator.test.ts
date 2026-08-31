import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOperatorEmail, operatorEmails, operatorEnforcementEnabled } from "./operator.ts";

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
