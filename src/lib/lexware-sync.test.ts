import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import {
  berlinDateTime,
  buildLexwareInvoiceLines,
  ensureLexwareSchema,
  queueLexwareBooking,
  runLexwareSync,
  splitCustomerName,
  type LexwareCall,
} from "./lexware-sync.ts";
import { createInvoiceDraft, LexwareError, type LexwareCredentials } from "./lexware.ts";
import { readLexwareCredentials } from "./lexware-credentials.server.ts";

function wrap(pg: Pick<PGlite, "query">): Sql {
  const sql = (async (parts: TemplateStringsArray, ...values: unknown[]) =>
    (
      await pg.query(
        parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
        values,
      )
    ).rows) as Sql;
  sql.query = async <T>(query: string, params: unknown[] = []) =>
    (await pg.query<T>(query, params)).rows;
  sql.transaction = (work) => work(sql);
  return sql;
}

const creds: LexwareCredentials = {
  apiKey: "test-key",
  apiBase: "https://api.lexware.io/v1",
};

const CONTACT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const INVOICE_ID = "11111111-2222-3333-4444-555555555555";

function mockApi() {
  const contacts: { id: string; email?: string; archived?: boolean; lastName?: string }[] = [];
  const invoices: {
    id: string;
    contactId: string;
    remark?: string;
    finalize?: boolean;
    shippingType?: string;
    taxType?: string;
  }[] = [];
  const calls: string[] = [];
  const bodies: Record<string, unknown>[] = [];
  let failNext: string | null = null;

  const respond = async (
    method: string,
    path: string,
    body?: Record<string, unknown> | null,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<unknown> => {
    const q = query ? `?${new URLSearchParams(query as Record<string, string>).toString()}` : "";
    calls.push(`${method} ${path}${q}`);
    if (body) bodies.push(body);
    if (failNext === `${method} ${path}`) {
      failNext = null;
      throw new LexwareError("lexware_request_failed", { status: 500, retryable: true });
    }
    if (path.includes("finalize") || q.includes("finalize"))
      throw new Error("finalize must never be sent");
    if (method === "GET" && path === "/contacts") {
      const email = typeof query?.email === "string" ? query.email : "";
      return {
        content: contacts.filter((c) => !email || c.email === email),
      };
    }
    if (method === "POST" && path === "/contacts") {
      const person = body?.person as { lastName?: string } | undefined;
      const emails = body?.emailAddresses as { business?: string[] } | undefined;
      const id = `00000000-0000-0000-0000-${String(contacts.length + 1).padStart(12, "0")}`;
      contacts.push({
        id,
        email: emails?.business?.[0],
        lastName: person?.lastName,
      });
      return { id };
    }
    if (method === "POST" && path === "/invoices") {
      const shipping = body?.shippingConditions as { shippingType?: string } | undefined;
      const tax = body?.taxConditions as { taxType?: string } | undefined;
      invoices.push({
        id: INVOICE_ID,
        contactId: body?.contactId as string,
        remark: body?.remark as string | undefined,
        shippingType: shipping?.shippingType,
        taxType: tax?.taxType,
      });
      return { id: INVOICE_ID };
    }
    throw new Error(`Unexpected ${method} ${path}`);
  };

  const request: LexwareCall = async <T>(
    method: string,
    path: string,
    body?: Record<string, unknown> | null,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<T> => (await respond(method, path, body, query)) as T;

  return {
    request,
    contacts,
    invoices,
    calls,
    bodies,
    failNext: (sig: string) => {
      failNext = sig;
    },
    seedContact: (email: string) => {
      contacts.push({ id: CONTACT_ID, email });
      return CONTACT_ID;
    },
  };
}

test("splitCustomerName always yields a lastName", () => {
  assert.deepEqual(splitCustomerName("Max Mustermann"), {
    firstName: "Max",
    lastName: "Mustermann",
  });
  assert.deepEqual(splitCustomerName("Madonna"), { firstName: "Kunde", lastName: "Madonna" });
  assert.equal(splitCustomerName("").lastName, "Website");
});

test("berlinDateTime keeps calendar dates", () => {
  assert.equal(berlinDateTime("2026-09-15"), "2026-09-15T00:00:00.000+02:00");
  assert.match(berlinDateTime(null), /^\d{4}-\d{2}-\d{2}T00:00:00.000\+02:00$/);
});

test("buildLexwareInvoiceLines uses 19% net EUR and splits pickup", () => {
  const lines = buildLexwareInvoiceLines({
    id: 40,
    status: "erledigt",
    version: 1,
    customer_name: "Test",
    phone: "+49000",
    email: "a@b.invalid",
    preferred_date: "2026-09-15",
    preferred_slot: "09:00",
    package_id: "premium",
    class_id: "kompakt",
    extra_ids: '["felgen"]',
    city_slug: "horb",
    note: null,
    total_cents: 14280,
    pickup_cents: 2380,
    confirmed_at: null,
    confirmed_by: null,
    cancelled_at: null,
    request_fingerprint: null,
    upload_token_expires_at: null,
  });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].unitPrice.currency, "EUR");
  assert.equal(lines[0].unitPrice.taxRatePercentage, 19);
  assert.equal(lines[0].unitPrice.netAmount, 100);
  assert.equal(lines[1].name.includes("Abholung"), true);
  assert.equal(lines[1].unitPrice.netAmount, 20);
  assert.match(lines[0].name, /Politur|premium|Felgen/i);
});

test("createInvoiceDraft never sends finalize", async () => {
  const seen: string[] = [];
  const request: LexwareCall = async <T>(
    method: string,
    path: string,
    body?: Record<string, unknown> | null,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<T> => {
    seen.push(`${method} ${path}${query ? JSON.stringify(query) : ""}`);
    assert.equal(path, "/invoices");
    assert.equal(query, undefined);
    assert.ok(body);
    assert.equal(
      (body as { shippingConditions: { shippingType: string } }).shippingConditions.shippingType,
      "service",
    );
    return { id: INVOICE_ID } as T;
  };
  const id = await createInvoiceDraft(request, {
    voucherDate: "2026-09-10T00:00:00.000+02:00",
    contactId: CONTACT_ID,
    addressName: "Test",
    lineItems: [
      {
        type: "custom",
        name: "Leistung",
        quantity: 1,
        unitName: "Leistung",
        unitPrice: { currency: "EUR", netAmount: 100, taxRatePercentage: 19 },
      },
    ],
    shippingDate: "2026-09-15T00:00:00.000+02:00",
    remark: "WG-1",
  });
  assert.equal(id, INVOICE_ID);
  assert.deepEqual(seen, ["POST /invoices"]);
});

test("Lexware synchronization creates contact and draft invoice, retries partial progress", async (t) => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } }),
    sql = wrap(pg);
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  await ensureLexwareSchema(sql);
  await sql`insert into shop_settings(shop_id,lexware_sync_enabled) values('white-gloss',true)
    on conflict(shop_id) do update set lexware_sync_enabled=true`;

  let sequence = 0;
  async function fixture(opts: { status?: string; email?: string | null; phone?: string } = {}) {
    sequence += 1;
    const day = String(10 + sequence).padStart(2, "0");
    const [row] = await sql<WorkflowBooking>`insert into bookings(
        shop_id,status,customer_name,phone,email,package_id,class_id,extra_ids,total_cents,pickup_cents,preferred_date,preferred_slot,note
      ) values(
        'white-gloss',${opts.status || "neu"},'Integration Test',${opts.phone || `+49000000${sequence}`},${opts.email === undefined ? "test@example.invalid" : opts.email},
        'premium','kompakt','["felgen"]',34900,0,${`2026-10-${day}`},'11:00','Hinweis'
      ) returning *`;
    await queueLexwareBooking(sql, row);
    return row;
  }

  try {
    await t.test("reuses existing contact and skips invoice until erledigt", async () => {
      const api = mockApi();
      api.seedContact("test@example.invalid");
      const row = await fixture({ status: "neu" });
      assert.equal(
        (await runLexwareSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 }))
          .synced,
        1,
      );
      assert.equal(api.contacts.length, 1);
      assert.equal(api.invoices.length, 0);
      assert.ok(api.calls.some((c) => c.startsWith("GET /contacts")));
      assert.ok(!api.calls.some((c) => c.startsWith("POST /invoices")));
      const [queue] = await sql<{
        status: string;
        lex_contact_id: string;
        lex_invoice_id: string | null;
      }>`select status,lex_contact_id,lex_invoice_id from lexware_sync_queue where booking_id=${row.id}`;
      assert.equal(queue.status, "synced");
      assert.equal(queue.lex_contact_id, CONTACT_ID);
      assert.equal(queue.lex_invoice_id, null);
    });

    await t.test("creates a person when lookup finds nothing", async () => {
      const api = mockApi();
      const row = await fixture({ email: "neu@example.invalid" });
      assert.equal(
        (await runLexwareSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 }))
          .synced,
        1,
      );
      assert.equal(api.contacts.length, 1);
      assert.ok(api.calls.includes("POST /contacts"));
      assert.equal(api.invoices.length, 0);
    });

    await t.test("creates a draft invoice only after status erledigt, never finalize", async () => {
      const api = mockApi();
      const row = await fixture({ status: "neu", email: "done@example.invalid" });
      await runLexwareSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 });
      assert.equal(api.invoices.length, 0);
      await sql`update bookings set status='erledigt', version=version+1 where id=${row.id}`;
      const [updated] = await sql<WorkflowBooking>`select * from bookings where id=${row.id}`;
      await queueLexwareBooking(sql, updated);
      assert.equal(
        (await runLexwareSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 }))
          .synced,
        1,
      );
      assert.equal(api.invoices.length, 1);
      assert.equal(api.invoices[0].shippingType, "service");
      assert.equal(api.invoices[0].taxType, "net");
      assert.match(api.invoices[0].remark || "", /WG-\d+/);
      assert.ok(!api.calls.some((c) => /finalize/i.test(c)));
      const [queue] = await sql<{
        status: string;
        lex_invoice_id: string | null;
      }>`select status,lex_invoice_id from lexware_sync_queue where booking_id=${row.id}`;
      assert.equal(queue.status, "synced");
      assert.equal(queue.lex_invoice_id, INVOICE_ID);
    });

    await t.test("resumes after invoice failure without duplicating the contact", async () => {
      const api = mockApi();
      const row = await fixture({ status: "erledigt", email: "retry@example.invalid" });
      api.failNext("POST /invoices");
      assert.equal(
        (await runLexwareSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 }))
          .failed,
        1,
      );
      const [mid] = await sql<{
        lex_contact_id: string | null;
        lex_invoice_id: string | null;
        status: string;
      }>`select lex_contact_id,lex_invoice_id,status from lexware_sync_queue where booking_id=${row.id}`;
      assert.equal(mid.status, "pending");
      assert.ok(mid.lex_contact_id);
      assert.equal(mid.lex_invoice_id, null);
      await sql`update lexware_sync_queue set next_attempt_at=now() where booking_id=${row.id}`;
      assert.equal(
        (await runLexwareSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 }))
          .synced,
        1,
      );
      assert.equal(api.contacts.length, 1);
      assert.equal(api.invoices.length, 1);
    });

    await t.test("does not create a second invoice on later events", async () => {
      const api = mockApi();
      const row = await fixture({ status: "erledigt", email: "once@example.invalid" });
      await runLexwareSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 });
      await sql`update bookings set version=version+1, note='update' where id=${row.id}`;
      const [updated] = await sql<WorkflowBooking>`select * from bookings where id=${row.id}`;
      await queueLexwareBooking(sql, updated);
      await runLexwareSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 });
      assert.equal(api.invoices.length, 1);
    });

    await t.test("disabled synchronization performs no remote calls", async () => {
      const api = mockApi();
      const row = await fixture();
      await sql`update shop_settings set lexware_sync_enabled=false where shop_id='white-gloss'`;
      assert.equal(
        (await runLexwareSync(sql, { request: api.request, creds, bookingId: row.id })).synced,
        0,
      );
      assert.equal(api.calls.length, 0);
      await sql`update shop_settings set lexware_sync_enabled=true where shop_id='white-gloss'`;
    });
  } finally {
    await pg.close();
  }
});

test("stored Lexware key is used when the environment is empty", async () => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } }),
    sql = wrap(pg);
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  await ensureLexwareSchema(sql);
  const previous = process.env.LEXWARE_API_KEY;
  delete process.env.LEXWARE_API_KEY;
  try {
    assert.equal(await readLexwareCredentials(sql), null);
    await sql`update shop_settings set lexware_api_key=${"panel-stored-lexware-key"} where shop_id='white-gloss'`;
    const stored = await readLexwareCredentials(sql);
    assert.equal(stored?.apiKey, "panel-stored-lexware-key");
    assert.equal(stored?.apiBase, "https://api.lexware.io/v1");
  } finally {
    if (previous === undefined) delete process.env.LEXWARE_API_KEY;
    else process.env.LEXWARE_API_KEY = previous;
    await pg.close();
  }
});
