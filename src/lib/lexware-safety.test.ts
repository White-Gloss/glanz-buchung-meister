import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLexwareClient,
  findContactByEmail,
  LexwareError,
  normalizeLexwareApiBase,
  type LexwareRequest,
} from "./lexware.ts";
import { berlinDateTime, syncOneLexwareBooking } from "./lexware-sync.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import type { Sql } from "./db.ts";
import { isOwnerNotification } from "./billing-policy.ts";

test("unknown writes are review-only and GET remains retryable", async () => {
  for (const method of ["POST", "GET"]) {
    let calls = 0;
    const api = createLexwareClient(
      { apiBase: "https://api.lexware.io/v1", apiKey: "isolated" },
      {
        fetchImpl: async () => {
          calls++;
          throw new Error("lost response");
        },
        minIntervalMs: 0,
      },
    );
    await assert.rejects(
      api(method, "/contacts"),
      (err) =>
        err instanceof LexwareError &&
        err.review === (method === "POST") &&
        err.retryable === (method === "GET"),
    );
    assert.equal(calls, 1);
  }
});
test("contact matching rejects substrings and ambiguity", async () => {
  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  let content = [{ id, emailAddresses: { business: ["prefix-a_b@example.invalid"] } }];
  const request: LexwareRequest = async <T>(
    _m: string,
    _p: string,
    _b?: Record<string, unknown> | null,
    query?: Record<string, string | string[] | undefined>,
  ) => {
    assert.equal(query?.email, "a\\_b@example.invalid");
    return { content } as T;
  };
  assert.equal(await findContactByEmail(request, "a_b@example.invalid"), null);
  content = [{ id, emailAddresses: { business: ["a_b@example.invalid"] } }];
  assert.equal(await findContactByEmail(request, "a_b@example.invalid"), id);
  content.push({ ...content[0], id: "11111111-2222-3333-4444-555555555555" });
  await assert.rejects(findContactByEmail(request, "a_b@example.invalid"), /ambiguous/);
});
test("Lexware credentials cannot be redirected to arbitrary hosts", () => {
  assert.throws(() => normalizeLexwareApiBase("https://example.org/v1"));
  assert.equal(berlinDateTime("2026-12-01"), "2026-12-01T00:00:00.000+01:00");
});
test("only owner notifications survive the customer-mail policy", () => {
  assert.equal(isOwnerNotification("booking:1:event:2:owner:email:x", "booking.created"), true);
  assert.equal(isOwnerNotification("booking:1:event:2:customer:email:x", "booking.created"), false);
  assert.equal(isOwnerNotification("booking:1:reminder:2:email:x", "booking.reminder"), false);
  assert.equal(isOwnerNotification(null, null), false);
});

test("binding invoices require explicit automation and the exact approved booking revision", async () => {
  const row = {
    id: 123,
    status: "erledigt",
    version: 3,
    customer_name: "Isolated test",
    email: "test@example.invalid",
    phone: "000000",
    package_id: "basis",
    extra_ids: "[]",
    total_cents: 11900,
    pickup_cents: 0,
  } as WorkflowBooking;
  const contact = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const invoice = "11111111-2222-3333-4444-555555555555";
  const sql = (async () => [{ exists: false }]) as unknown as Sql;
  let calls = 0;
  const request: LexwareRequest = async <T>(
    _method: string,
    path: string,
    body?: Record<string, unknown> | null,
    query?: Record<string, string | string[] | undefined>,
  ) => {
    calls++;
    assert.equal(path, "/invoices");
    assert.equal(query?.finalize, "true");
    assert.deepEqual(body?.address, {
      contactId: contact,
      name: row.customer_name,
      countryCode: "DE",
      street: "Testweg 1",
      zip: "72160",
      city: "Horb",
    });
    return { id: invoice } as T;
  };
  const progress = { lex_contact_id: contact, lex_invoice_id: null };
  await assert.rejects(
    syncOneLexwareBooking(sql, row, request, progress, true),
    /approval_required/,
  );
  const billing = {
    street: "Testweg 1",
    zip: "72160",
    city: "Horb",
    countryCode: "DE",
    serviceDate: "2026-09-11",
    totalCents: 11900,
    bookingVersion: 2,
    bookingStatus: "bestaetigt",
  };
  await assert.rejects(
    syncOneLexwareBooking(
      sql,
      { ...row, version: 4 },
      request,
      { ...progress, billing_data: billing },
      true,
    ),
    /approval_required/,
  );
  await assert.rejects(
    syncOneLexwareBooking(
      sql,
      row,
      request,
      { ...progress, billing_data: { ...billing, bookingStatus: "erledigt" } },
      true,
    ),
    /approval_required/,
  );
  assert.equal(calls, 0);
  assert.equal(
    (await syncOneLexwareBooking(sql, row, request, { ...progress, billing_data: billing }, true))
      .invoiceId,
    invoice,
  );
  assert.equal(calls, 1);
});
