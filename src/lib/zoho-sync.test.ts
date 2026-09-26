import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { saveBookingRequest } from "./booking-workflow.ts";
import { createRequestUploadCapability } from "./booking-upload-capability.ts";
import { confirmBookingWithSchedule, completeServiceWithPayment } from "./zoho-ops.ts";
import { processZohoJob } from "./zoho-sync.ts";
import { site } from "../data/site.ts";

function wrap(pg: Pick<PGlite, "query">, transaction?: Sql["transaction"]): Sql {
  const sql = (async (strings: TemplateStringsArray, ...args: unknown[]) => {
    const text = strings.reduce((s, part, i) => s + (i ? `$${i}` : "") + part, "");
    return (await pg.query(text, args)).rows;
  }) as Sql;
  sql.query = async <T>(text: string, args: unknown[] = []) => (await pg.query<T>(text, args)).rows;
  sql.transaction = transaction ?? ((fn) => fn(sql));
  return sql;
}

test("calendar sync never invoices; cash payment sends a Books customer_id", async (t) => {
  const previous = {
    ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN,
    ZOHO_BOOKS_ORG_ID: process.env.ZOHO_BOOKS_ORG_ID,
    ZOHO_DC: process.env.ZOHO_DC,
  };
  Object.assign(process.env, {
    ZOHO_CLIENT_ID: "client",
    ZOHO_CLIENT_SECRET: "secret",
    ZOHO_REFRESH_TOKEN: "refresh",
    ZOHO_BOOKS_ORG_ID: "org-1",
    ZOHO_DC: "eu",
  });
  const calls: { url: string; body: unknown }[] = [];
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url.includes("/oauth/v2/token")) {
      return Response.json({ access_token: "token", expires_in: 3600 });
    }
    if (url.includes("/crm/v8/Contacts/search") || url.includes("/crm/v8/Deals/search")) {
      return Response.json({ data: [] });
    }
    if (url.includes("/crm/v8/Contacts") && init?.method === "POST") {
      return Response.json({ data: [{ details: { id: "contact-1" } }] });
    }
    if (url.includes("/crm/v8/Deals") && init?.method === "POST") {
      return Response.json({ data: [{ details: { id: "deal-1" } }] });
    }
    if (url.includes("/crm/v8/Events")) {
      return Response.json({ data: [{ details: { id: "event-1" } }] });
    }
    if (url.includes("/books/v3/settings/taxes")) {
      return Response.json({ taxes: [{ tax_id: "tax-19", tax_percentage: 19, tax_name: "MwSt. 19%" }] });
    }
    if (url.includes("/books/v3/contacts") && init?.method !== "POST") {
      return Response.json({ contacts: [] });
    }
    if (url.includes("/books/v3/contacts") && init?.method === "POST") {
      return Response.json({ contact: { contact_id: "books-c1" } });
    }
    if (url.includes("/books/v3/invoices") && init?.method === "POST" && !url.includes("/email")) {
      return Response.json({ invoice: { invoice_id: "inv-1", invoice_number: "RE-1" } });
    }
    if (url.includes("/customerpayments")) {
      return Response.json({ payment: { payment_id: "pay-1" } });
    }
    if (url.includes("/email")) {
      return Response.json({ success: true });
    }
    return Response.json({}, { status: 404 });
  });
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  try {
    for (const file of (await readdir("migrations")).filter((file) => file.endsWith(".sql")).sort()) {
      await pg.exec(await readFile(`migrations/${file}`, "utf8"));
    }
    const sql = wrap(pg, (fn) => pg.transaction((tx) => fn(wrap(tx))));
    await sql`insert into "user"(id,name,email,"emailVerified") values('owner','Owner',${process.env.OWNER_EMAIL || site.email},true)`;
    const created = await saveBookingRequest(
      sql,
      {
        idempotencyKey: randomUUID(),
        name: "Kalender Test",
        phone: "+490000123456",
        email: "qa@example.invalid",
        date: "2026-11-02",
        slot: "09:00",
        note: "",
        packageId: "basis",
        classId: "kompakt",
        extraIds: [],
        citySlug: "",
        kind: "booking",
        privacy: true,
      },
      createRequestUploadCapability(randomUUID()),
    );
    const confirmed = await confirmBookingWithSchedule(sql, created.booking.id, created.booking.version, "owner", {
      startDate: "2026-11-02",
      startTime: "09:00",
      durationMinutes: 180,
      agreedCents: 14900,
    });
    await processZohoJob(sql, {
      id: 1,
      job: "calendar",
      booking_id: confirmed.booking.id,
      payload: {},
    });
    const eventCall = calls.find((call) => call.url.includes("/crm/v8/Events"));
    assert.ok(eventCall);
    assert.equal((eventCall.body as { data: { Event_Title: string }[] }).data[0].Event_Title, "White Gloss · Werkstatt belegt");
    assert.equal(
      calls.some((call) => call.url.includes("/books/v3/invoices") && !call.url.includes("/email")),
      false,
      "calendar must not create a Books invoice",
    );
    await completeServiceWithPayment(sql, confirmed.booking.id, confirmed.booking.version, "owner", {
      payment: "bar",
      cashCents: 14900,
      cashDate: "2026-11-02",
    });
    const [fresh] = await sql<{ id: number }>`select id from bookings where id=${confirmed.booking.id}`;
    await processZohoJob(sql, { id: 2, job: "invoice", booking_id: fresh.id, payload: {} });
    const payment = calls.find((call) => call.url.includes("/customerpayments"));
    assert.ok(payment);
    assert.equal((payment.body as { customer_id: string }).customer_id, "books-c1");
    assert.equal((payment.body as { payment_mode: string }).payment_mode, "cash");
    assert.equal(fetchMock.mock.callCount() > 3, true);
  } finally {
    await pg.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
