import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { qontoAuthHeader, qontoConfigured } from "./qonto-mail.ts";

describe("qontoConfigured", () => {
  it("is true only when QONTO_LOGIN, QONTO_SECRET_KEY and QONTO_IBAN are set", () => {
    const prevLogin = process.env.QONTO_LOGIN;
    const prevKey = process.env.QONTO_SECRET_KEY;
    const prevIban = process.env.QONTO_IBAN;
    try {
      delete process.env.QONTO_LOGIN;
      delete process.env.QONTO_SECRET_KEY;
      delete process.env.QONTO_IBAN;
      assert.equal(qontoConfigured(), false);

      process.env.QONTO_LOGIN = "login";
      process.env.QONTO_SECRET_KEY = "secret";
      delete process.env.QONTO_IBAN;
      assert.equal(qontoConfigured(), false);

      delete process.env.QONTO_LOGIN;
      process.env.QONTO_SECRET_KEY = "secret";
      process.env.QONTO_IBAN = "DE89370400440532013000";
      assert.equal(qontoConfigured(), false);

      process.env.QONTO_LOGIN = "login";
      delete process.env.QONTO_SECRET_KEY;
      process.env.QONTO_IBAN = "DE89370400440532013000";
      assert.equal(qontoConfigured(), false);

      process.env.QONTO_LOGIN = "login";
      process.env.QONTO_SECRET_KEY = "secret";
      process.env.QONTO_IBAN = "DE89370400440532013000";
      assert.equal(qontoConfigured(), true);

      process.env.QONTO_LOGIN = "  ";
      process.env.QONTO_SECRET_KEY = "secret";
      process.env.QONTO_IBAN = "DE89370400440532013000";
      assert.equal(qontoConfigured(), false);
    } finally {
      if (prevLogin === undefined) delete process.env.QONTO_LOGIN;
      else process.env.QONTO_LOGIN = prevLogin;
      if (prevKey === undefined) delete process.env.QONTO_SECRET_KEY;
      else process.env.QONTO_SECRET_KEY = prevKey;
      if (prevIban === undefined) delete process.env.QONTO_IBAN;
      else process.env.QONTO_IBAN = prevIban;
    }
  });
});

describe("qontoAuthHeader", () => {
  it("builds login:secret without Bearer or base64", () => {
    const prevLogin = process.env.QONTO_LOGIN;
    const prevKey = process.env.QONTO_SECRET_KEY;
    try {
      process.env.QONTO_LOGIN = "org-login";
      process.env.QONTO_SECRET_KEY = "org-secret";
      assert.equal(qontoAuthHeader(), "org-login:org-secret");
      assert.ok(!qontoAuthHeader().startsWith("Bearer"));
      assert.ok(!qontoAuthHeader().startsWith("Basic"));
    } finally {
      if (prevLogin === undefined) delete process.env.QONTO_LOGIN;
      else process.env.QONTO_LOGIN = prevLogin;
      if (prevKey === undefined) delete process.env.QONTO_SECRET_KEY;
      else process.env.QONTO_SECRET_KEY = prevKey;
    }
  });
});
