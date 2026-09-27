import test from "node:test";
import assert from "node:assert/strict";
import {
  legacyPlan,
  moneyCents,
  assertLegacyBookingUnchanged,
  fingerprint,
} from "./bitrix-legacy-plan.mjs";
import { parseImportArgs } from "./import-bitrix-legacy.mjs";

test("legacy CLI is read-only unless a reviewed digest, private journal and backup are specified", () => {
  assert.equal(parseImportArgs(["--environment=/env", "--snapshot=/snapshot"]).apply, false);
  assert.throws(
    () => parseImportArgs(["--environment=/env", "--snapshot=/snapshot", "--apply"]),
    /reviewed_plan_and_backup_required/,
  );
  assert.throws(
    () => parseImportArgs(["--environment=/env", "--snapshot=/snapshot", "--snapshot=/other"]),
    /invalid_argument/,
  );
  assert.throws(
    () => parseImportArgs(["--environment=/env", "--snapshot=/snapshot", "--send-invoice"]),
    /invalid_argument/,
  );
  assert.equal(
    parseImportArgs([
      "--environment=/env",
      "--snapshot=/snapshot",
      "--apply",
      `--approve=${"a".repeat(64)}`,
      "--journal=/private/log",
      "--database-backup=/private/dump",
    ]).apply,
    true,
  );
});

function fixture(status = "Akzeptiert") {
  return {
    booking: {
      id: 50,
      shop_id: "white-gloss",
      version: 1,
      ro_order_id: 123,
      total_cents: 26800,
      customer_name: "Test Person",
      email: "test@example.invalid",
      phone: "",
      status: "neu",
      class_id: "compact",
      package_id: "basis",
      extra_ids: "[]",
    },
    order: {
      id: 123,
      total: "268.00",
      payed: "0.00",
      discount_sum: "0.00",
      status: { name: status },
      scheduled_for: "2026-09-22T11:00:00Z",
      scheduled_to: "2026-09-22T13:00:00Z",
      done_at: null,
      closed_at: null,
    },
    items: [149, 119].map((price, i) => ({
      id: i + 1,
      entity: { title: `Leistung ${i + 1}` },
      quantity: "1.000",
      price: price.toFixed(2),
      discount: { type: "percentage", percentage: 0, amount: "0.00" },
      taxes: [{ rate: 19 }],
      is_refunded: false,
    })),
    photos: [{ booking_id: 50, upload_state: "ready" }],
  };
}

test("legacy accepted transfer preserves exact price, interval, lines and original booking", () => {
  const source = fixture();
  const before = structuredClone(source);
  const plan = legacyPlan(source);
  assert.equal(plan.stage, "EXECUTING");
  assert.equal(plan.amountCents, 26800);
  assert.equal(plan.deal.ufCrmWgBookingRef, "WG-50");
  assert.equal(plan.deal.ufCrmWgAppointment, "2026-09-22T11:00:00.000Z");
  assert.equal(plan.deal.ufCrmWgDurationMinutes, 120);
  assert.deepEqual(
    plan.products.map((p) => p.price),
    [149, 119],
  );
  assert.equal(plan.photoCount, 1);
  assert.deepEqual(source, before);
});

test("legacy done and invoiced stages preserve original status without inventing a new invoice or cash payment", () => {
  for (const status of ["Erledigt", "In Rechnung gestellt"]) {
    const source = fixture(status);
    source.order.payed = "268.00";
    const plan = legacyPlan(source);
    assert.equal(plan.stage, "FINAL_INVOICE");
    assert.equal(plan.paidCents, 26800);
    assert.match(plan.deal.comments, new RegExp(`Originalstatus: ${status}`));
    assert.match(plan.deal.comments, /Zahlungsstand laut RO: 268.00 EUR/);
    assert.doesNotMatch(plan.deal.comments, /Rechnungsstatus \(Website\)/);
    assert.equal(plan.deal.ufCrmWgCashAmount, null);
    assert.equal(plan.deal.ufCrmWgPaymentMethod, "");
    assert.equal(plan.deal.ufCrmWgAcceptedAt, null);
  }
});

test("contradictory source completion and future appointment are retained and explicitly flagged", () => {
  const source = fixture("Erledigt");
  source.order.done_at = "2026-09-19T21:45:29Z";
  source.order.scheduled_for = "2026-11-13T14:00:00Z";
  source.order.scheduled_to = "2026-11-13T16:00:00Z";
  const plan = legacyPlan(source);
  assert.deepEqual(plan.warnings, ["source_completion_precedes_scheduled_date"]);
  assert.equal(plan.start, "2026-11-13T14:00:00.000Z");
  assert.match(plan.deal.comments, /Quellkonflikt unverändert erhalten/);
});

for (const [name, mutate, error] of [
  ["unknown stage", (r) => (r.order.status.name = "Wartet"), "legacy_status_needs_review"],
  ["wrong order", (r) => (r.order.id = 999), "legacy_identity_mismatch"],
  ["wrong amount", (r) => (r.order.total = "269.00"), "legacy_price_mismatch"],
  ["changed agreed price", (r) => (r.booking.agreed_price_cents = 100), "legacy_price_mismatch"],
  ["overpayment", (r) => (r.order.payed = "300.00"), "legacy_payment_or_discount_needs_review"],
  [
    "ambiguous date",
    (r) => (r.order.scheduled_for = "2026-09-22T11:00:00"),
    "legacy_timezone_required",
  ],
  [
    "backward interval",
    (r) => (r.order.scheduled_to = r.order.scheduled_for),
    "invalid_legacy_interval",
  ],
  ["missing products", (r) => (r.items = []), "legacy_items_missing"],
  [
    "quantity requiring explicit conversion",
    (r) => (r.items[0].quantity = "2.000"),
    "legacy_item_needs_review",
  ],
  ["refund", (r) => (r.items[0].is_refunded = true), "legacy_item_needs_review"],
  ["discount", (r) => (r.items[0].discount.percentage = 10), "legacy_item_discount_needs_review"],
  ["different tax", (r) => (r.items[0].taxes[0].rate = 7), "legacy_item_tax_needs_review"],
  ["line total discrepancy", (r) => (r.items[0].price = "148.00"), "legacy_lines_total_mismatch"],
  ["unfinished photo", (r) => (r.photos[0].upload_state = "pending"), "legacy_photos_not_ready"],
])
  test(`legacy handoff refuses ${name}`, () => {
    const source = fixture();
    mutate(source);
    assert.throws(() => legacyPlan(source), new RegExp(error));
  });

test("money refuses empty, boolean, negative, exponent and sub-cent values", () => {
  for (const value of ["", null, true, -1, "1e2", "1.123", 1.123, Infinity])
    assert.throws(() => moneyCents(value));
  assert.equal(moneyCents("1503.75"), 150375);
});

test("a source position without tax entries is preserved without adding VAT", () => {
  const source = fixture("In Rechnung gestellt");
  source.items.forEach((item) => (item.taxes = []));
  const plan = legacyPlan(source);
  assert.deepEqual(
    plan.products.map((p) => p.taxRate),
    [0, 0],
  );
  assert.equal(plan.amountCents, 26800);
});

test("booking drift check normalizes pg timestamps and allows only Bitrix metadata changes", () => {
  const source = {
    id: 50,
    total_cents: 26800,
    created_at: "2026-09-19T00:00:00.000Z",
    bitrix_deal_id: null,
  };
  assert.doesNotThrow(() =>
    assertLegacyBookingUnchanged(source, {
      ...source,
      created_at: new Date(source.created_at),
      bitrix_deal_id: 500,
    }),
  );
  assert.throws(
    () => assertLegacyBookingUnchanged(source, { ...source, total_cents: 26801 }),
    /legacy_booking_changed/,
  );
  assert.equal(fingerprint({ b: 1, a: 2 }), fingerprint({ a: 2, b: 1 }));
});
