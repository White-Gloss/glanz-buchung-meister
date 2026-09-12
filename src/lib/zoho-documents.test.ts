import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { createBookingConfirmationPdf, receiptEmailCopy } from "./zoho-documents.ts";

test("confirmation PDF is titled as booking confirmation and never as an invoice", async () => {
  const content = await createBookingConfirmationPdf({
    id: 42,
    customer_name: "Müller 🚗",
    phone: "+4915233540284",
    email: "kunde@example.invalid",
    package_id: "premium",
    class_id: "suv",
    extra_ids: "[]",
    city_slug: "horb-am-neckar",
    note: "Bitte Innenraum extra.",
    agreed_price_cents: 42900,
    total_cents: 42900,
    work_start_at: "2026-04-02T07:00:00.000Z",
    work_end_at: "2026-04-02T13:00:00.000Z",
    preferred_date: "2026-04-02",
    preferred_slot: "09:00",
    vehicle_make: "Porsche",
    vehicle_model: "911",
    vehicle_plate: null,
    confirmation_pdf_version: 1,
  });
  const doc = await PDFDocument.load(Buffer.from(content, "base64"));
  assert.equal(doc.getTitle(), "Buchungsbestaetigung WG-42");
  assert.equal(doc.getPageCount(), 1);
  assert.ok(!/rechnung/i.test(doc.getTitle() || ""));
});

test("receipt copy states the request is unconfirmed and names the process", () => {
  const body = receiptEmailCopy("Lars", "WG-7");
  assert.match(body, /Buchungsanfrage ist bei uns eingegangen/);
  assert.match(body, /noch nicht verbindlich bestätigt/);
  assert.match(body, /WG-7/);
  assert.doesNotMatch(body, /Rechnung/);
});
