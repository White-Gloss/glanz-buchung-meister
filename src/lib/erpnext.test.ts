import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ERPNEXT_DEFAULT_BASE_URL,
  credentialsFromEnv,
  normalizeErpnextBaseUrl,
  probeErpnext,
  sanitizeErpnextError,
  writesEnabled,
} from "./erpnext.ts";

describe("ERPNext connection helpers", () => {
  it("only allows the WHITE GLOSS OS host over https", () => {
    assert.equal(normalizeErpnextBaseUrl(""), ERPNEXT_DEFAULT_BASE_URL);
    assert.equal(
      normalizeErpnextBaseUrl("https://white-gloss-os.f.frappe.cloud/"),
      ERPNEXT_DEFAULT_BASE_URL,
    );
    assert.equal(normalizeErpnextBaseUrl("http://white-gloss-os.f.frappe.cloud"), null);
    assert.equal(normalizeErpnextBaseUrl("https://127.0.0.1"), null);
    assert.equal(normalizeErpnextBaseUrl("https://evil.example"), null);
  });

  it("keeps write switches default-deny", () => {
    assert.equal(writesEnabled(undefined), false);
    assert.equal(writesEnabled("1"), false);
    assert.equal(writesEnabled("true"), true);
  });

  it("never returns credentials when key or secret is missing", () => {
    const prevKey = process.env.ERPNEXT_API_KEY;
    const prevSecret = process.env.ERPNEXT_API_SECRET;
    delete process.env.ERPNEXT_API_KEY;
    delete process.env.ERPNEXT_API_SECRET;
    assert.equal(credentialsFromEnv(null), null);
    process.env.ERPNEXT_API_KEY = "only-key-present-here";
    assert.equal(credentialsFromEnv(null), null);
    if (prevKey === undefined) delete process.env.ERPNEXT_API_KEY;
    else process.env.ERPNEXT_API_KEY = prevKey;
    if (prevSecret === undefined) delete process.env.ERPNEXT_API_SECRET;
    else process.env.ERPNEXT_API_SECRET = prevSecret;
  });

  it("redacts tokens from error text", () => {
    const cleaned = sanitizeErpnextError("Authorization token abc.def failed api_secret=super-secret");
    assert.equal(/abc\.def/.test(cleaned), false);
    assert.equal(/super-secret/.test(cleaned), false);
  });

  it("treats HTML login pages as failed auth", async () => {
    const probe = await probeErpnext(
      {
        baseUrl: ERPNEXT_DEFAULT_BASE_URL,
        apiKey: "test-key-value",
        apiSecret: "test-secret-value",
      },
      async () =>
        new Response("<html>Login</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    );
    assert.equal(probe.ok, false);
    assert.equal(probe.error, "erpnext_auth_failed");
  });

  it("accepts a logged-in technical user and the White-Gloss company", async () => {
    const probe = await probeErpnext(
      {
        baseUrl: ERPNEXT_DEFAULT_BASE_URL,
        apiKey: "test-key-value",
        apiSecret: "test-secret-value",
      },
      async (_input) => {
        const url = String(_input);
        if (url.includes("get_logged_user")) {
          return new Response(JSON.stringify({ message: "integration@white-gloss.de" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ data: { name: "White-Gloss" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );
    assert.equal(probe.ok, true);
    assert.equal(probe.user, "integration@white-gloss.de");
    assert.equal(probe.companyFound, true);
  });
});

describe("ERPNext admin copy", () => {
  it("connects WHITE GLOSS OS and does not advertise public signup", () => {
    const src = readFileSync(fileURLToPath(new URL("../routes/admin.erpnext.tsx", import.meta.url)), "utf8");
    assert.equal(/WHITE GLOSS OS/.test(src), true);
    assert.equal(/API-Schlüssel/.test(src), true);
    assert.equal(/Konto anlegen/.test(src), false);
    assert.equal(/Weiter mit X/.test(src), false);
  });
});
