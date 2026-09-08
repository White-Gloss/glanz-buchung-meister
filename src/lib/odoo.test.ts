import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ODOO_DEFAULT_BASE_URL,
  ODOO_DEFAULT_DATABASE,
  normalizeOdooBaseUrl,
  odooCredentialsFromEnv,
  odooWritesEnabled,
  probeOdoo,
  sanitizeOdooError,
} from "./odoo.ts";

describe("Odoo connection helpers", () => {
  it("only allows the White-Gloss Odoo host over https", () => {
    assert.equal(normalizeOdooBaseUrl(""), ODOO_DEFAULT_BASE_URL);
    assert.equal(normalizeOdooBaseUrl(`${ODOO_DEFAULT_BASE_URL}/`), ODOO_DEFAULT_BASE_URL);
    assert.equal(normalizeOdooBaseUrl("http://white-gloss-detailing-1.odoo.com"), null);
    assert.equal(normalizeOdooBaseUrl("https://evil.example"), null);
    assert.equal(normalizeOdooBaseUrl(`${ODOO_DEFAULT_BASE_URL}/web/login`), null);
    assert.equal(normalizeOdooBaseUrl(`${ODOO_DEFAULT_BASE_URL}:8443`), null);
    assert.equal(normalizeOdooBaseUrl(`${ODOO_DEFAULT_BASE_URL}?api_key=secret`), null);
    assert.equal(normalizeOdooBaseUrl(`${ODOO_DEFAULT_BASE_URL}#secret`), null);
  });

  it("keeps Odoo write switches default-deny", () => {
    assert.equal(odooWritesEnabled(undefined), false);
    assert.equal(odooWritesEnabled("1"), false);
    assert.equal(odooWritesEnabled("true"), true);
  });

  it("requires an API key", () => {
    const previous = process.env.ODOO_API_KEY;
    delete process.env.ODOO_API_KEY;
    assert.equal(odooCredentialsFromEnv(null), null);
    if (previous === undefined) delete process.env.ODOO_API_KEY;
    else process.env.ODOO_API_KEY = previous;
  });

  it("redacts bearer credentials", () => {
    const cleaned = sanitizeOdooError("Authorization Bearer secret-value api_key=other-secret");
    assert.equal(cleaned.includes("secret-value"), false);
    assert.equal(cleaned.includes("other-secret"), false);
  });

  it("probes the Odoo 19 JSON-2 context endpoint", async () => {
    let calledUrl = "";
    const probe = await probeOdoo(
      {
        baseUrl: ODOO_DEFAULT_BASE_URL,
        database: ODOO_DEFAULT_DATABASE,
        apiKey: "test-api-key-value",
      },
      async (input, init) => {
        calledUrl = String(input);
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-api-key-value");
        assert.equal(new Headers(init?.headers).get("X-Odoo-Database"), ODOO_DEFAULT_DATABASE);
        return new Response(JSON.stringify({ uid: 7, lang: "de_DE", tz: "Europe/Berlin" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );
    assert.equal(calledUrl, `${ODOO_DEFAULT_BASE_URL}/json/2/res.users/context_get`);
    assert.equal(probe.ok, true);
    assert.equal(probe.uid, 7);
  });

  it("rejects HTML and unauthorized responses", async () => {
    const probe = await probeOdoo(
      {
        baseUrl: ODOO_DEFAULT_BASE_URL,
        database: ODOO_DEFAULT_DATABASE,
        apiKey: "invalid-api-key-value",
      },
      async () =>
        new Response("<html>Login</html>", {
          status: 401,
          headers: { "content-type": "text/html" },
        }),
    );
    assert.equal(probe.ok, false);
    assert.equal(probe.error, "odoo_auth_failed");
  });

  it("never returns transport exception contents to the browser", async () => {
    const probe = await probeOdoo(
      { baseUrl: ODOO_DEFAULT_BASE_URL, database: ODOO_DEFAULT_DATABASE, apiKey: "private-key" },
      async () => {
        throw new Error('request headers {"Authorization":"private-key"}');
      },
    );
    assert.equal(probe.ok, false);
    assert.equal(probe.error, "odoo_unreachable");
    assert.equal(JSON.stringify(probe).includes("private-key"), false);
  });
});
