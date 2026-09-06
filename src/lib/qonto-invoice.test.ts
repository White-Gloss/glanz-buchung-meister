import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInvoiceLinesFromBooking } from "./qonto-invoice.ts";

describe("buildInvoiceLinesFromBooking", () => {
  it("uses default VAT 0.19 and EUR unit price", () => {
    const lines = buildInvoiceLinesFromBooking({
      customer_name: "Max Mustermann",
      email: "max@example.com",
      package_id: "premium",
      package_name: "Signature",
      extra_names: ["Innenraum"],
      total_cents: 11900,
      pickup_cents: 0,
    });
    assert.ok(lines.length >= 1);
    assert.equal(lines[0].vat_rate, "0.19");
    assert.equal(lines[0].unit_price.currency, "EUR");
    assert.equal(lines[0].unit_price.value, "100.00");
  });

  it("splits pickup into a separate line", () => {
    const lines = buildInvoiceLinesFromBooking({
      package_id: "basis",
      package_name: "Pur",
      total_cents: 14280,
      pickup_cents: 2380,
    });
    assert.equal(lines.length, 2);
    assert.equal(lines[0].unit_price.value, "100.00");
    assert.equal(lines[1].title.includes("Abholung"), true);
    assert.equal(lines[1].unit_price.value, "20.00");
  });
});
