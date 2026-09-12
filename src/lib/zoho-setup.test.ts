import assert from "node:assert/strict";
import { test } from "node:test";
import { pickGermanStandardVat } from "./zoho-setup.ts";

test("picks the real 19 percent Books tax and never invents an id", () => {
  const vat = pickGermanStandardVat([
    { tax_id: "tax-7", tax_percentage: 7, tax_name: "ermäßigt" },
    { tax_id: "tax-19", tax_percentage: 19, tax_name: "MwSt. 19%" },
  ]);
  assert.equal(vat?.tax_id, "tax-19");
  assert.equal(pickGermanStandardVat([{ tax_percentage: 19, tax_name: "ohne id" }]), null);
  assert.equal(pickGermanStandardVat([]), null);
});

test("grant code without client id is refused before any Zoho call", async () => {
  const calls: string[] = [];
  const sql = Object.assign(
    async (strings: TemplateStringsArray) => {
      calls.push(strings.join(""));
      if (strings.join("").includes("select zoho_client_id")) {
        return [
          {
            zoho_client_id: null,
            zoho_client_secret: null,
            zoho_refresh_token: null,
            zoho_books_org_id: null,
            zoho_webhook_secret: null,
          },
        ];
      }
      return [];
    },
    { query: async () => undefined },
  );
  const { applyZohoSetup } = await import("./zoho-setup.ts");
  const report = await applyZohoSetup(sql as never, { grantCode: "1000.abc" });
  assert.equal(report.auth, false);
  assert.match(report.errors[0] || "", /Client-ID/);
});
