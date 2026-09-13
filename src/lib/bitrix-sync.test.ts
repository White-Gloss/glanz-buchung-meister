import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import {
  ensureCalendar,
  bookingDealBody,
  bookingLineItems,
  queueBitrixBooking,
  runBitrixSync,
  splitCustomerName,
  stageForStatus,
} from "./bitrix-sync.ts";
import { DEFAULT_PRODUCT_MAP, probeBitrix } from "./bitrix.ts";
import {
  createBitrixRestClient,
  normalizeBitrixRestWebhook,
  toRestDealFields,
} from "./bitrix-rest.ts";
import { readVibeApiKey } from "./bitrix-credentials.server.ts";

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

function mockBitrix() {
  const contacts: { id: number; email?: string; phone?: string }[] = [];
  const deals: Array<Record<string, unknown> & { id: number }> = [];
  const products: Record<number, unknown[]> = {};
  const events: { id: number; name: string }[] = [];
  const calls: string[] = [];
  const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    calls.push(`${method} ${path}`);
    const payload = (body || {}) as Record<string, unknown>;
    if (method === "POST" && path === "/contacts/search") {
      const filter = (payload.filter || {}) as { email?: string; phone?: string };
      const found = contacts.filter(
        (c) =>
          (filter.email && c.email === filter.email) || (filter.phone && c.phone === filter.phone),
      );
      return found as T;
    }
    if (method === "POST" && path === "/contacts") {
      const created = {
        id: contacts.length + 1,
        email: payload.email as string | undefined,
        phone: payload.phone as string | undefined,
      };
      contacts.push(created);
      return created as T;
    }
    if (method === "POST" && path === "/deals") {
      const created = { id: deals.length + 10, ...payload };
      deals.push(created);
      return created as T;
    }
    if (method === "PATCH" && path.startsWith("/deals/")) {
      return { ok: true } as T;
    }
    if (method === "PUT" && path.endsWith("/products")) {
      const id = Number(path.split("/")[2]);
      assert.ok(Array.isArray(payload.items), "VibeCode requires the items array");
      products[id] = payload.items as unknown[];
      return { ok: true } as T;
    }
    if (method === "POST" && path === "/calendar-events") {
      const created = { id: events.length + 50, name: String(payload.name || "") };
      events.push(created);
      return created as T;
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
  return { contacts, deals, products, events, calls, request };
}

test("deal payload keeps website catalog, WG id and class factor", () => {
  const booking = {
    id: 17,
    status: "neu",
    customer_name: "Anna Meier",
    phone: "+491511111",
    email: "anna@example.invalid",
    preferred_date: "2026-09-21",
    preferred_slot: "11:00",
    package_id: "premium",
    class_id: "suv",
    extra_ids: JSON.stringify(["felgen", "ozon"]),
    city_slug: "nagold",
    note: "Leasingrückgabe",
    total_cents: 62250,
    pickup_cents: 5000,
    vehicle_make: "BMW",
    vehicle_model: "X3",
  } as unknown as WorkflowBooking;
  const body = bookingDealBody(booking, 9);
  assert.match(String(body.title), /WG-17/);
  assert.match(String(body.comments), /white-gloss.de\/#buchung/);
  assert.equal(body.ufCrmWgPackage, "Reinigung & Politur");
  assert.match(String(body.ufCrmWgExtras), /Felgenreinigung/);
  assert.equal(body.ufCrmWgClass, "SUV / Limousine");
  assert.equal(body.ufCrmWgCity, "Nagold");
  assert.equal(body.amount, 622.5);
  const items = bookingLineItems(booking, DEFAULT_PRODUCT_MAP);
  assert.equal(items[0]?.productId, 4);
  assert.equal(items[0]?.price, 436.25);
  assert.ok(items.some((item) => item.catalogId === "felgen" && item.productId === 20));
  assert.ok(items.some((item) => item.catalogId === "hol20" && item.price === 50));
  assert.equal(stageForStatus("bestaetigt"), "EXECUTING");
  assert.deepEqual(splitCustomerName("Lars Hägele"), { name: "Lars", lastName: "Hägele" });
});

test("Bitrix sync creates contact, deal and products from a website booking", async () => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  const sql = wrap(pg);
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  const [row] = await sql<WorkflowBooking>`insert into bookings(
      shop_id,customer_name,phone,email,package_id,class_id,extra_ids,total_cents,pickup_cents,preferred_date,preferred_slot,note,city_slug
    ) values(
      'white-gloss','Integration Test','+4900000011','bitrix@example.invalid',
      'premium','kompakt','["felgen"]',49900,5000,'2026-09-22','09:00','Hinweis','nagold'
    ) returning *`;
  await queueBitrixBooking(sql, row);
  const api = mockBitrix();
  const result = await runBitrixSync(sql, {
    request: api.request,
    bookingId: row.id,
    limit: 1,
    loadPhotos: async () => [],
  });
  assert.equal(result.synced, 1);
  assert.equal(api.contacts.length, 1);
  assert.equal(api.deals.length, 1);
  assert.match(String(api.deals[0].title), /WG-/);
  assert.equal(api.deals[0].ufCrmWgPackage, "Reinigung & Politur");
  assert.ok((api.products[api.deals[0].id] || []).length >= 2);
  const queued = await sql<{ status: string; bitrix_deal_id: number }>`
    select status, bitrix_deal_id from bitrix_sync_queue where booking_id=${row.id}`;
  assert.equal(queued[0].status, "synced");
  assert.equal(queued[0].bitrix_deal_id, api.deals[0].id);
  const originalRows = structuredClone(api.products[api.deals[0].id]);
  await queueBitrixBooking(sql, row);
  const repeated = await runBitrixSync(sql, {
    request: api.request,
    bookingId: row.id,
    limit: 1,
    loadPhotos: async () => [],
  });
  assert.equal(repeated.synced, 1);
  assert.equal(api.deals.length, 1);
  assert.equal(api.contacts.length, 1);
  assert.deepEqual(api.products[api.deals[0].id], originalRows);
  assert.equal(api.calls.filter((call) => call.endsWith("/products")).length, 2);
  assert.ok(
    api.calls.filter((call) => call.endsWith("/products")).every((call) => call.startsWith("PUT ")),
  );
  await pg.close();
});

test("REST product replacement maps the shared PUT/items contract without appending rows", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const request = createBitrixRestClient(
    "https://example.bitrix24.de/rest/1/testcode123/",
    async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ result: true }), { status: 200 });
    },
  );
  const items = [
    {
      productId: 4,
      productName: "Politur",
      price: 349,
      quantity: 1,
      taxRate: 19,
      taxIncluded: true,
    },
    {
      productId: 20,
      productName: "Felgen",
      price: 49,
      quantity: 1,
      taxRate: 19,
      taxIncluded: true,
    },
  ];
  await request("PUT", "/deals/412/products", { items });
  await request("PUT", "/deals/412/products", { items });
  assert.equal(requests.length, 2);
  assert.ok(requests.every((call) => call.url.endsWith("/crm.deal.productrows.set.json")));
  assert.deepEqual(requests[0].body, {
    id: 412,
    rows: [
      {
        PRODUCT_ID: 4,
        PRODUCT_NAME: "Politur",
        PRICE: 349,
        QUANTITY: 1,
        TAX_RATE: 19,
        TAX_INCLUDED: "Y",
      },
      {
        PRODUCT_ID: 20,
        PRODUCT_NAME: "Felgen",
        PRICE: 49,
        QUANTITY: 1,
        TAX_RATE: 19,
        TAX_INCLUDED: "Y",
      },
    ],
  });
  assert.deepEqual(requests[1], requests[0]);
});

test("Bitrix sync is a no-op without API key", async () => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  const sql = wrap(pg);
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  const previous = process.env.VIBE_API_KEY;
  delete process.env.VIBE_API_KEY;
  try {
    const result = await runBitrixSync(sql);
    assert.equal(result.skipped, 1);
    assert.equal(result.synced, 0);
  } finally {
    if (previous !== undefined) process.env.VIBE_API_KEY = previous;
    else delete process.env.VIBE_API_KEY;
    await pg.close();
  }
});

test("stored Bitrix key is used when the environment is empty", async () => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  const sql = wrap(pg);
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  const previous = process.env.VIBE_API_KEY;
  delete process.env.VIBE_API_KEY;
  try {
    assert.equal(await readVibeApiKey(sql), "");
    await sql`alter table shop_settings add column if not exists vibe_api_key text`;
    await sql`update shop_settings set vibe_api_key=${"panel-stored-bitrix-key"} where shop_id='white-gloss'`;
    assert.equal(await readVibeApiKey(sql), "panel-stored-bitrix-key");
  } finally {
    if (previous !== undefined) process.env.VIBE_API_KEY = previous;
    else delete process.env.VIBE_API_KEY;
    await pg.close();
  }
});

test("probeBitrix accepts a valid key and rejects 401 without storing details", async () => {
  const ok = await probeBitrix("vibe_api_test_key_1234567890", {
    fetchImpl: async () =>
      new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
  });
  assert.equal(ok.ok, true);
  const denied = await probeBitrix("vibe_api_test_key_1234567890", {
    fetchImpl: async () => new Response(JSON.stringify({ success: false }), { status: 401 }),
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.match(denied.error, /prüfen/);
  const inactive = await probeBitrix("vibe_api_test_key_1234567890", {
    fetchImpl: async () =>
      new Response(JSON.stringify({ success: false, error: { code: "KEY_INACTIVE" } }), {
        status: 401,
      }),
  });
  assert.equal(inactive.ok, false);
  if (!inactive.ok) assert.match(inactive.error, /gesperrt/);
});

test("Bitrix REST webhook URL is accepted and mapped to crm.deal.add", async () => {
  assert.equal(
    normalizeBitrixRestWebhook(
      "https://b24-emfor7.bitrix24.de/rest/1/examplecode123/crm.deal.add.json",
    ),
    "https://b24-emfor7.bitrix24.de/rest/1/examplecode123/",
  );
  assert.equal(normalizeBitrixRestWebhook("https://evil.example/rest/1/abc"), null);
  const fields = toRestDealFields({
    title: "WG-17 · Test",
    contactId: 9,
    stageId: "NEW",
    amount: 149,
    ufCrmWgPackage: "Basisreinigung",
  });
  assert.equal(fields.TITLE, "WG-17 · Test");
  assert.equal(fields.CONTACT_ID, 9);
  assert.equal(fields.UF_CRM_WG_PACKAGE, "Basisreinigung");
  const calls: string[] = [];
  const ok = await probeBitrix("https://b24-emfor7.bitrix24.de/rest/1/examplecode123/", {
    fetchImpl: async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ result: [] }), { status: 200 });
    },
  });
  assert.equal(ok.ok, true);
  assert.match(calls[0] || "", /crm\.deal\.list\.json/);
  const request = createBitrixRestClient(
    "https://b24-emfor7.bitrix24.de/rest/1/examplecode123/",
    async (input) => {
      const url = String(input);
      if (url.includes("crm.deal.add"))
        return new Response(JSON.stringify({ result: 22 }), { status: 200 });
      return new Response(JSON.stringify({ result: true }), { status: 200 });
    },
  );
  const created = await request<{ id: number }>("POST", "/deals", {
    title: "WG-1",
    contactId: 5,
    amount: 149,
  });
  assert.equal(created.id, 22);
});

test("Bitrix calendar preserves agreed overnight interval, updates and cancels", async () => {
  const calls: { method: string; path: string; body: any }[] = [];
  const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    calls.push({ method, path, body });
    return { id: 77 } as T;
  };
  const booking = {
    id: 1,
    status: "bestaetigt",
    preferred_date: "2026-11-02",
    preferred_slot: "09:00",
    package_id: "basis",
    customer_name: "QA",
    phone: "123456",
    work_start_at: "2026-11-02T08:00:00Z",
    work_end_at: "2026-11-03T14:00:00Z",
  } as any;
  assert.equal(await ensureCalendar(request, booking, 8, null), 77);
  assert.equal(calls[0].body.from, "2026-11-02T08:00:00.000Z");
  assert.equal(calls[0].body.to, "2026-11-03T14:00:00.000Z");
  calls.length = 0;
  assert.equal(await ensureCalendar(request, booking, 8, 77), 77);
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].path, "/calendar-events/77");
  calls.length = 0;
  assert.equal(await ensureCalendar(request, { ...booking, status: "storniert" }, 8, 77), null);
  assert.deepEqual(
    calls.map((c) => c.method),
    ["DELETE"],
  );
});

test("agreed prices and Bitrix product rows have identical totals", () => {
  const booking = {
    package_id: "premium",
    class_id: "suv",
    extra_ids: '["felgen","ozon"]',
    pickup_cents: 5000,
    agreed_price_cents: 54321,
  } as any;
  const rows = bookingLineItems(booking, DEFAULT_PRODUCT_MAP);
  assert.equal(
    rows.reduce((sum, r) => sum + Math.round(r.price * 100), 0),
    54321,
  );
});

test("REST deal creation never retries a timed-out POST with stripped fields", async () => {
  let calls = 0;
  const request = createBitrixRestClient(
    "https://example.bitrix24.de/rest/1/examplecode123/",
    async () => {
      calls++;
      throw new Error("lost response");
    },
  );
  await assert.rejects(request("POST", "/deals", { title: "WG-1" }));
  assert.equal(calls, 1);
});

test("uncertain external creation enters review and cannot duplicate on retry", async () => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  try {
    const sql = wrap(pg);
    for (const f of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
      await pg.exec(await readFile(`migrations/${f}`, "utf8"));
    const [row] =
      await sql<WorkflowBooking>`insert into bookings(shop_id,customer_name,phone,package_id,class_id,extra_ids,total_cents,pickup_cents)
      values('white-gloss','QA','123456','basis','kompakt','[]',14900,0) returning *`;
    await queueBitrixBooking(sql, row);
    let creates = 0;
    const request = async <T>(method: string, path: string): Promise<T> => {
      if (path === "/contacts/search") return [{ id: 1 }] as T;
      if (path === "/deals" && method === "POST") {
        creates++;
        throw new Error("response lost after external creation");
      }
      throw new Error("unexpected request");
    };
    assert.equal((await runBitrixSync(sql, { request, limit: 1 })).review, 1);
    await sql`update bitrix_sync_queue set status='pending',next_attempt_at=now() where booking_id=${row.id}`;
    assert.equal((await runBitrixSync(sql, { request, limit: 1 })).review, 1);
    assert.equal(creates, 1);
  } finally {
    await pg.close();
  }
});
