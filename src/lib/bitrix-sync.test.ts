import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import {
  bookingDealBody,
  bookingLineItems,
  queueBitrixBooking,
  runBitrixSync,
  splitCustomerName,
  stageForStatus,
} from "./bitrix-sync.ts";
import { DEFAULT_PRODUCT_MAP, probeBitrix } from "./bitrix.ts";
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
        (c) => (filter.email && c.email === filter.email) || (filter.phone && c.phone === filter.phone),
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
    if (method === "POST" && path.endsWith("/products")) {
      const id = Number(path.split("/")[2]);
      products[id] = (payload.products as unknown[]) || [];
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
  const [row] =
    await sql<WorkflowBooking>`insert into bookings(
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
  await pg.close();
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
    fetchImpl: async () => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
  });
  assert.equal(ok.ok, true);
  const denied = await probeBitrix("vibe_api_test_key_1234567890", {
    fetchImpl: async () => new Response(JSON.stringify({ success: false }), { status: 401 }),
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.match(denied.error, /prüfen/);
});
