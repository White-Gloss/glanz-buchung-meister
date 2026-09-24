import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bitrixDocumentPayload,
  documentTotals,
  invoiceDueDate,
  type ConfirmedDocument,
  type InvoiceDocument,
} from "./bitrix-documents.ts";

const booking: ConfirmedDocument = {
  kind: "confirmation",
  reference: "TEST-WG-DOC-20260913-01",
  issuedOn: "2026-09-13",
  customer: {
    name: "TEST White-Gloss",
    address: "Testanschrift, keine Kundenadresse",
    email: "info@white-gloss.de",
    phone: "+49000000000",
  },
  vehicle: "TEST Fahrzeug",
  plate: "TEST",
  notes: "TESTDOKUMENT – keine echte Terminreservierung.",
  lines: [
    { description: "TEST Innenreinigung", quantity: 1, unitNetCents: 10000 },
    { description: "TEST Lackpflege", quantity: 1, unitNetCents: 5000 },
  ],
  agreedGrossCents: 17850,
  start: "2026-11-01T22:00:00Z",
  end: "2026-11-03T07:00:00Z",
  location: "Arnistal 27, 72160 Horb (Dettingen)",
};

test("confirmation binds every template label, repeats positions and preserves overnight duration", () => {
  const payload = bitrixDocumentPayload(booking, 10, "test-document");
  assert.equal(payload.values.WGDuration, "33 Std. 0 Min.");
  assert.equal(payload.values.WGStart, "01.11.2026, 23:00");
  assert.equal(payload.values.WGEnd, "03.11.2026, 08:00");
  assert.equal(payload.values.WGServiceLines, "WGItems.Item.Description");
  assert.equal((payload.values.WGItems as unknown[]).length, 2);
  assert.equal(payload.values.WGVatTotal, "28,50 €");
  assert.equal(payload.values.WGPaymentText, undefined);
  assert.equal(payload.values.WGInvoiceNumber, undefined);
});

test("VAT is calculated from reviewed positions and must equal agreed total", () => {
  assert.deepEqual(documentTotals([{ description: "A", quantity: 12, unitNetCents: 8500 }]), {
    net: 102000,
    vat: 19380,
    gross: 121380,
  });
  assert.throws(
    () => bitrixDocumentPayload({ ...booking, agreedGrossCents: 17851 }, 10, "test"),
    /total_mismatch/,
  );
  assert.throws(
    () => documentTotals([{ description: "A", quantity: -1, unitNetCents: 100 }]),
    /quantity/,
  );
  assert.throws(
    () => bitrixDocumentPayload({ ...booking, end: booking.start }, 10, "test"),
    /interval/,
  );
  assert.throws(
    () => bitrixDocumentPayload({ ...booking, start: "2026-11-01T22:00:00" }, 10, "test"),
    /time/,
  );
});

const invoice: InvoiceDocument = {
  ...booking,
  kind: "invoice",
  invoiceNumber: "TEST-RE-001",
  serviceDate: "2026-09-12",
  payment: { method: "transfer" },
  bank: { name: "TEST Bank", iban: "TEST", bic: "TEST" },
};

test("transfer invoice has concrete seven-calendar-day due date, including DST and year boundary", () => {
  assert.equal(invoiceDueDate("2026-10-22"), "2026-10-29");
  assert.equal(invoiceDueDate("2026-12-28"), "2027-01-04");
  assert.throws(() => invoiceDueDate("2026-02-30"), /date/);
  const payload = bitrixDocumentPayload(invoice, 12, "invoice-test");
  assert.match(String(payload.values.WGPaymentText), /20.9.2026/);
  assert.equal(payload.values.WGPaymentReference, "TEST-RE-001");
  assert.equal(payload.values.WGTaxIdentification, "");
});

test("only actually recorded full cash payment is paid; partial payment retains its balance", () => {
  const paid = bitrixDocumentPayload(
    { ...invoice, payment: { method: "cash", amountCents: 17850, paidOn: "2026-09-12" } },
    12,
    "cash-test",
  );
  assert.match(String(paid.values.WGPaymentText), /Vollständig bezahlt/);
  assert.doesNotMatch(String(paid.values.WGPaymentText), /überweise|Zahlungsziel/);
  const partial = bitrixDocumentPayload(
    { ...invoice, payment: { method: "cash", amountCents: 10000, paidOn: "2026-09-12" } },
    12,
    "partial-test",
  );
  assert.match(String(partial.values.WGPaymentText), /Offener Restbetrag: 78,50/);
  assert.throws(
    () =>
      bitrixDocumentPayload(
        { ...invoice, payment: { method: "cash", amountCents: 17851, paidOn: "2026-09-12" } },
        12,
        "test",
      ),
    /invalid_cash/,
  );
  assert.throws(
    () =>
      bitrixDocumentPayload(
        { ...invoice, payment: { method: "cash", amountCents: 17850, paidOn: "2026-09-14" } },
        12,
        "test",
      ),
    /future_payment/,
  );
});

test("all placeholders in the actual DOCX generator have value bindings", async () => {
  const { readFile } = await import("node:fs/promises");
  const generator = await readFile("scripts/build-bitrix-confirmation.py", "utf8");
  const confirmationValues = bitrixDocumentPayload(booking, 10, "test").values;
  const invoiceValues = bitrixDocumentPayload(invoice, 12, "test").values;
  for (const placeholder of generator.matchAll(/\{(WG\w+|Qty|UnitNet|LineNet)\}/g)) {
    assert.ok(
      placeholder[1] in confirmationValues || placeholder[1] in invoiceValues,
      placeholder[1],
    );
  }
});
