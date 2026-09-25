import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import {
  ensureCalendar,
  findContact,
  repairBookingContact,
  bookingDealBody,
  bookingLineItems,
  queueBitrixBooking,
  queueBitrixPhotos,
  loadReadyPhotos,
  runBitrixSync,
  syncOneBitrixBooking,
  splitCustomerName,
  stageForStatus,
} from "./bitrix-sync.ts";
import { DEFAULT_PRODUCT_MAP, probeBitrix } from "./bitrix.ts";
import {
  createBitrixRestClient,
  normalizeBitrixRestWebhook,
  toRestDealFields,
} from "./bitrix-rest.ts";
import { readBitrixWebhook } from "./bitrix-credentials.server.ts";

test("reviewed legacy product snapshots preserve zero tax and reject invalid tax rates", async () => {
  const calls: unknown[] = [];
  const request = async <T>(_method: string, _path: string, body?: unknown) => {
    calls.push(body);
    return { ok: true } as T;
  };
  const sql = (async () => []) as unknown as Sql;
  const booking = {
    id: 50,
    total_cents: 26800,
    package_id: "basis",
    customer_name: "Test Person",
  } as WorkflowBooking;
  const progress = {
    bitrix_contact_id: 1,
    bitrix_deal_id: 2,
    bitrix_event_id: null,
    photos_done: true,
    details_done: false,
    initial_products: [
      { catalogId: "legacy-1", productId: 0, name: "Basisreinigung", price: 149, taxRate: 0 },
      { catalogId: "legacy-2", productId: 0, name: "Felgen", price: 119, taxRate: 0 },
    ],
  };
  await syncOneBitrixBooking(sql, booking, request, {}, progress);
  assert.deepEqual(calls, [
    {
      items: progress.initial_products.map((item) => ({
        productId: 0,
        productName: item.name,
        price: item.price,
        quantity: 1,
        taxRate: 0,
        taxIncluded: true,
      })),
    },
  ]);
  calls.length = 0;
  progress.initial_products[0].taxRate = -1;
  await assert.rejects(syncOneBitrixBooking(sql, booking, request, {}, progress), /Steuersatz/);
  assert.equal(calls.length, 0);
});

test("media transfer includes every allowed image and video format", async () => {
  const rows = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ].map((mime, index) => ({
    storage_path: `media-${index}`,
    original_name: `media-${index}`,
    mime,
  }));
  const sql = (async () => rows) as unknown as Sql;
  const media = await loadReadyPhotos(sql, 17, {
    signUrl: async (path) => `https://uploads.invalid/${path}`,
    fetchImpl: async () => new Response(new Uint8Array([1, 2, 3])),
  });
  assert.deepEqual(
    media.map((file) => file.mime),
    rows.map((row) => row.mime),
  );
  assert.equal(media.length, 6);
  assert.equal(media[3].key, "media-3");
});

test("booking email must not fall back to a different email sharing the phone", async () => {
  const api = mockBitrix();
  api.contacts.push({ id: 414, email: "office@example.invalid", phone: "+4900000011" });
  assert.equal(await findContact(api.request, "customer@example.invalid", "+4900000011"), null);
  assert.deepEqual(api.contacts, [
    { id: 414, email: "office@example.invalid", phone: "+4900000011" },
  ]);
});

test("ambiguous email and phone matches require review", async () => {
  const request = async <T>() => [{ id: 1 }, { id: 2 }] as T;
  await assert.rejects(findContact(request, "qa@example.invalid", "123456"), /Mehrere Kontakte/);
  await assert.rejects(findContact(request, null, "123456"), /Mehrere Kontakte/);
});

test("contact lookup preserves matching email and phone-only bookings", async () => {
  const api = mockBitrix();
  api.contacts.push({ id: 414, email: "customer@example.invalid", phone: "+4900000011" });
  assert.equal(
    (await findContact(api.request, "customer@example.invalid", "+4900000011"))?.id,
    414,
  );
  assert.equal((await findContact(api.request, null, "+4900000011"))?.id, 414);
});

test("email search failure is not treated as a missing contact", async () => {
  await assert.rejects(
    findContact(
      async () => {
        throw new Error("unavailable");
      },
      "customer@example.invalid",
      "+4900000011",
    ),
    /unavailable/,
  );
});

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
      Object.assign(deals.find((deal) => deal.id === Number(path.split("/")[2])) || {}, payload);
      return { ok: true } as T;
    }
    if (method === "PUT" && path.endsWith("/products")) {
      const id = Number(path.split("/")[2]);
      assert.ok(Array.isArray(payload.items), "The native adapter requires product items");
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
      'premium','kompakt','["felgen"]',51800,5000,'2026-09-22','09:00','Hinweis','nagold'
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
  api.deals[0].amount = 777;
  api.deals[0].stageId = "EXECUTING";
  api.products[api.deals[0].id] = [{ productName: "In Bitrix geändert", price: 777 }];
  const originalRows = structuredClone(api.products[api.deals[0].id]);
  await queueBitrixBooking(sql, row);
  const repeated = await runBitrixSync(sql, {
    request: api.request,
    bookingId: row.id,
    limit: 1,
    loadPhotos: async () => [],
  });
  assert.equal(repeated.synced, 1);
  assert.equal(api.deals[0].amount, 777);
  assert.equal(api.deals[0].stageId, "EXECUTING");
  assert.equal(api.events.length, 0);
  assert.equal(api.deals.length, 1);
  assert.equal(api.contacts.length, 1);
  assert.deepEqual(api.products[api.deals[0].id], originalRows);
  assert.equal(api.calls.filter((call) => call.endsWith("/products")).length, 1);
  assert.ok(
    api.calls.filter((call) => call.endsWith("/products")).every((call) => call.startsWith("PUT ")),
  );
  api.contacts[0].email = "office@example.invalid";
  api.deals[0].stageId = "PREPAYMENT_INVOICE";
  const preservedRows = structuredClone(api.products);
  const repaired = await repairBookingContact(sql, row.id, api.request);
  assert.equal(repaired.contactId, 2);
  assert.equal(api.contacts[0].email, "office@example.invalid");
  assert.equal(api.deals[0].contactId, 2);
  assert.equal(api.deals[0].stageId, "PREPAYMENT_INVOICE");
  assert.deepEqual(api.products, preservedRows);
  const [stored] = await sql<{
    bitrix_contact_id: number;
  }>`select bitrix_contact_id from bookings where id=${row.id}`;
  assert.equal(stored.bitrix_contact_id, 2);
  assert.equal((await repairBookingContact(sql, row.id, api.request)).contactId, 2);
  assert.equal(api.contacts.length, 2);
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
    assert.equal(await readBitrixWebhook(sql), "");
    await sql`alter table shop_settings add column if not exists vibe_api_key text`;
    await sql`update shop_settings set vibe_api_key=${"https://example.bitrix24.de/rest/1/testcode123/"} where shop_id='white-gloss'`;
    assert.equal(await readBitrixWebhook(sql), "https://example.bitrix24.de/rest/1/testcode123/");
  } finally {
    if (previous !== undefined) process.env.VIBE_API_KEY = previous;
    else delete process.env.VIBE_API_KEY;
    await pg.close();
  }
});

test("probeBitrix accepts only direct REST and validates successful responses", async () => {
  let called = false;
  assert.equal(
    (
      await probeBitrix("vibe_api_test_key_1234567890", {
        fetchImpl: async () => {
          called = true;
          return Response.json({ result: [] });
        },
      })
    ).ok,
    false,
  );
  assert.equal(called, false);
  const key = "https://example.bitrix24.de/rest/1/testcode123/";
  for (const body of [{}, { result: true }, { success: true, data: [] }])
    assert.equal(
      (await probeBitrix(key, { fetchImpl: async () => Response.json(body) })).ok,
      false,
    );
  assert.equal(
    (await probeBitrix(key, { fetchImpl: async () => Response.json({ result: [] }) })).ok,
    true,
  );
  assert.equal(
    (
      await probeBitrix(key, {
        fetchImpl: async () => Response.json({ error: "ACCESS_DENIED" }, { status: 401 }),
      })
    ).ok,
    false,
  );
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
    // Manual scheduling is sufficient; an original website wish is optional.
    preferred_date: null,
    preferred_slot: null,
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

test("Bitrix never reserves an estimated package duration in place of manual scheduling", async () => {
  let calls = 0;
  const request = async <T>(): Promise<T> => {
    calls++;
    return { id: 77 } as T;
  };
  const booking = {
    status: "bestaetigt",
    preferred_date: "2026-11-02",
    preferred_slot: "09:00",
    package_id: "premium",
  } as any;
  await assert.rejects(ensureCalendar(request, booking, 8, null), /manuell festgelegt/);
  await assert.rejects(
    ensureCalendar(request, { ...booking, work_start_at: "2026-11-02T08:00:00Z" }, 8, null),
    /manuell festgelegt/,
  );
  await assert.rejects(
    ensureCalendar(
      request,
      { ...booking, work_start_at: "invalid", work_end_at: "2026-11-03T08:00:00Z" },
      8,
      null,
    ),
    /Ungültiger Arbeitszeitraum/,
  );
  assert.equal(calls, 0);
});

test("Bitrix exposes agreed price, pending consent and actual cash data consistently over REST", () => {
  const booking = {
    id: 17,
    version: 4,
    status: "neu",
    ops_stage: "kundenrueckmeldung",
    package_id: "premium",
    class_id: "kompakt",
    extra_ids: "[]",
    total_cents: 34900,
    agreed_price_cents: 54321,
    work_start_at: "2026-11-02T08:00:00Z",
    work_end_at: "2026-11-03T14:00:00Z",
    resource_id: 2,
  } as any;
  const body = bookingDealBody(booking, 9);
  const fields = toRestDealFields(body);
  assert.equal(body.stageId, "PREPAYMENT_INVOICE");
  assert.equal(body.amount, 543.21);
  assert.equal(fields.OPPORTUNITY, fields.UF_CRM_WG_AGREED_PRICE);
  assert.equal(fields.UF_CRM_WG_BOOKING_REF, "WG-17");
  assert.equal(fields.UF_CRM_WG_BOOKING_VERSION, 4);
  assert.equal(fields.UF_CRM_WG_RESOURCE_ID, 2);
  assert.equal(fields.UF_CRM_WG_DURATION_MINUTES, 1800);
  assert.equal(fields.UF_CRM_WG_WORK_END, "2026-11-03T14:00:00.000Z");
  assert.equal(fields.UF_CRM_WG_ACCEPTED_AT, null);
  assert.equal(fields.UF_CRM_WG_CASH_AMOUNT, null);
  const paid = toRestDealFields(
    bookingDealBody(
      {
        ...booking,
        status: "erledigt",
        payment_method: "bar",
        payment_recorded_cents: 20000,
        payment_recorded_on: "2026-11-03",
      },
      9,
    ),
  );
  assert.equal(paid.UF_CRM_WG_CASH_AMOUNT, 200);
  assert.equal(paid.UF_CRM_WG_PAYMENT_DATE, "2026-11-03");
  assert.equal(paid.STAGE_ID, "FINAL_INVOICE");
  assert.equal(stageForStatus("storniert", "bestaetigt"), "APOLOGY");
  assert.equal(stageForStatus("neu", "in_pruefung"), "PREPARATION");
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

test("late photos append once without replacing native CRM decisions; an uncertain upload stops retries", async () => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  try {
    const sql = wrap(pg);
    for (const f of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
      await pg.exec(await readFile(`migrations/${f}`, "utf8"));
    const [row] =
      await sql<WorkflowBooking>`insert into bookings(shop_id,customer_name,phone,email,package_id,class_id,extra_ids,total_cents,pickup_cents)
      values('white-gloss','Photo Test','123456','photo@example.invalid','basis','kompakt','[]',14900,0) returning *`;
    const photos: { key: string; name: string; mime: string; base64: string }[] = [];
    const addPhoto = async (key: string) => {
      await sql`insert into booking_photos(shop_id,booking_id,storage_path,mime,size_bytes,original_name,upload_state)
        values('white-gloss',${row.id},${key},'image/jpeg',4,'car.jpg','ready')`;
      photos.push({ key, name: "car.jpg", mime: "image/jpeg", base64: key });
    };
    await addPhoto("first");
    await queueBitrixBooking(sql, row);
    const api = mockBitrix();
    const uploads: unknown[] = [];
    let loseResponse = false;
    const request: typeof api.request = async <T>(method: string, path: string, body?: unknown) => {
      if (method === "POST" && path.endsWith("/photos")) {
        uploads.push(body);
        if (loseResponse) throw new Error("upload acknowledgement lost");
        return { ok: true } as T;
      }
      return api.request<T>(method, path, body);
    };
    const run = () =>
      runBitrixSync(sql, { request, bookingId: row.id, limit: 1, loadPhotos: async () => photos });
    assert.equal((await run()).synced, 1);
    api.deals[0].stageId = "EXECUTING";
    api.deals[0].amount = 777;
    api.products[api.deals[0].id] = [{ productName: "Native edit", price: 777 }];
    await addPhoto("second");
    await queueBitrixPhotos(sql, row);
    assert.equal((await run()).synced, 1);
    assert.deepEqual(uploads, [
      { files: [["car.jpg", "first"]] },
      { files: [["car.jpg", "second"]] },
    ]);
    assert.equal(api.deals[0].amount, 777);
    assert.equal(api.deals[0].stageId, "EXECUTING");
    assert.deepEqual(api.products[api.deals[0].id], [{ productName: "Native edit", price: 777 }]);
    assert.equal(
      api.calls.some((call) => /invoices|calendar-events/.test(call)),
      false,
    );
    await addPhoto("third");
    await queueBitrixPhotos(sql, row);
    loseResponse = true;
    assert.equal((await run()).review, 1);
    await queueBitrixPhotos(sql, row);
    assert.equal((await run()).synced, 0);
    assert.equal(uploads.length, 3);
  } finally {
    await pg.close();
  }
});

test("a photo arriving during sync completion remains pending and transfers on the next run", async () => {
  const pg = new PGlite({ parsers: { 1082: (value) => value, 20: Number } });
  try {
    for (const file of (await readdir("migrations")).filter((file) => file.endsWith(".sql")).sort())
      await pg.exec(await readFile(`migrations/${file}`, "utf8"));
    const base = wrap(pg);
    let inject = false;
    const sql = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const result = await base(parts, ...values);
      const query = parts.join("?");
      if (inject && query.includes("select count(*)") && query.includes("upload_state='ready'")) {
        inject = false;
        await base`insert into booking_photos(shop_id,booking_id,storage_path,mime,size_bytes,original_name,upload_state)
          values('white-gloss',${row.id},'late-photo','video/mp4',4,'late.mp4','ready')`;
        await queueBitrixPhotos(sql, row);
      }
      return result;
    }) as Sql;
    sql.query = base.query;
    sql.transaction = (work) => work(sql);
    const [row] =
      await sql<WorkflowBooking>`insert into bookings(shop_id,customer_name,phone,email,package_id,class_id,extra_ids,total_cents,pickup_cents)
      values('white-gloss','Race Test','123456','race@example.invalid','basis','kompakt','[]',14900,0) returning *`;
    await queueBitrixBooking(sql, row);
    const api = mockBitrix();
    let uploads = 0;
    const request: typeof api.request = async <T>(method: string, path: string, body?: unknown) => {
      if (path.endsWith("/photos")) {
        uploads++;
        return { ok: true } as T;
      }
      return api.request<T>(method, path, body);
    };
    const loadPhotos = async () =>
      (
        await base<{
          storage_path: string;
        }>`select storage_path from booking_photos where booking_id=${row.id}`
      ).map((photo) => ({
        key: photo.storage_path,
        name: "late.mp4",
        mime: "video/mp4",
        base64: "AAAA",
      }));
    inject = true;
    await runBitrixSync(sql, { request, limit: 1, loadPhotos });
    const [pending] =
      await base`select status,photos_done from bitrix_sync_queue where booking_id=${row.id}`;
    assert.equal(pending.status, "pending");
    assert.equal(pending.photos_done, false);
    assert.equal(uploads, 0);
    await runBitrixSync(sql, { request, limit: 1, loadPhotos });
    const [done] =
      await base`select status,photos_done,photo_keys from bitrix_sync_queue where booking_id=${row.id}`;
    assert.equal(done.status, "synced");
    assert.deepEqual(done.photo_keys, ["late-photo"]);
    assert.equal(uploads, 1);
  } finally {
    await pg.close();
  }
});
