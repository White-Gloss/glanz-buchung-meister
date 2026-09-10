import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import {
  bookingSchedule,
  queueRoappBooking,
  runRoappSync,
  type RoappCall,
} from "./roapp-sync.ts";
import {
  createRoappClient,
  extractRoappId,
  RoappError,
  type RoappCredentials,
} from "./roapp.ts";

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

const creds: RoappCredentials = {
  apiKey: "test-key",
  apiBase: "https://api.roapp.io/v2",
  branchId: 10,
  assigneeId: 20,
  orderTypeId: 30,
  entityMap: { premium: 100, felgen: 200 },
};

function mockApi() {
  const people: { id: number; phone?: string; email?: string }[] = [];
  const bookings: { id: number; comment?: string; client_id: number }[] = [];
  const orders: { id: number; manager_notes?: string; client_id: number }[] = [];
  const bookingItems: { booking_id: number; entity_id: number }[] = [];
  const orderItems: { order_id: number; entity_id: number }[] = [];
  const calls: string[] = [];
  let rateLimitOnce = false;
  let failNext: string | null = null;

  const respond = async (
    method: string,
    path: string,
    body?: Record<string, unknown> | null,
  ): Promise<unknown> => {
    calls.push(`${method} ${path}`);
    if (rateLimitOnce) {
      rateLimitOnce = false;
      throw new RoappError("roapp_rate_limited", { status: 429, retryable: true });
    }
    if (failNext === `${method} ${path}`) {
      failNext = null;
      throw new RoappError("roapp_request_failed", { status: 500, retryable: true });
    }
    if (method === "GET" && path === "/contacts/people") {
      return { data: people };
    }
    if (method === "POST" && path === "/contacts/people") {
      const id = people.length + 1;
      const phones = (body?.phones as { phone: string }[] | undefined) || [];
      people.push({ id, phone: phones[0]?.phone, email: body?.email as string | undefined });
      return { id };
    }
    if (method === "POST" && path === "/bookings") {
      const id = bookings.length + 1;
      bookings.push({
        id,
        comment: body?.comment as string | undefined,
        client_id: body?.client_id as number,
      });
      return { id };
    }
    if (method === "POST" && path.match(/^\/bookings\/\d+\/items$/)) {
      const bookingId = Number(path.split("/")[2]);
      bookingItems.push({ booking_id: bookingId, entity_id: body?.entity_id as number });
      return { id: bookingItems.length };
    }
    if (method === "POST" && path === "/orders") {
      const id = orders.length + 1;
      orders.push({
        id,
        manager_notes: body?.manager_notes as string | undefined,
        client_id: body?.client_id as number,
      });
      return { id };
    }
    if (method === "POST" && path.match(/^\/orders\/\d+\/items$/)) {
      const orderId = Number(path.split("/")[2]);
      orderItems.push({ order_id: orderId, entity_id: body?.entity_id as number });
      return { id: orderItems.length };
    }
    if (method === "POST" && path.match(/^\/orders\/\d+\/comments$/)) {
      return { ok: true };
    }
    throw new Error(`Unexpected ${method} ${path}`);
  };

  // Keep the generic response assertion at the simulated transport boundary.
  const request: RoappCall = async <T>(
    method: string,
    path: string,
    body?: Record<string, unknown> | null,
  ): Promise<T> => (await respond(method, path, body)) as T;

  return {
    request,
    people,
    bookings,
    orders,
    bookingItems,
    orderItems,
    calls,
    rateLimitOnce: () => {
      rateLimitOnce = true;
    },
    failNext: (sig: string) => {
      failNext = sig;
    },
    seedPerson: (phone: string, email?: string) => {
      const id = people.length + 1;
      people.push({ id, phone, email });
      return id;
    },
  };
}

test("RO App client backs off on HTTP 429", async () => {
  let attempts = 0;
  const sleeps: number[] = [];
  const fetchImpl: typeof fetch = async () => {
    attempts++;
    if (attempts === 1) return new Response("{}", { status: 429 });
    return new Response(JSON.stringify({ id: 7 }), { status: 200 });
  };
  const client = createRoappClient(creds, {
    fetchImpl,
    minIntervalMs: 0,
    sleepImpl: async (ms) => {
      sleeps.push(ms);
    },
  });
  const payload = await client<{ id: number }>("POST", "/contacts/people", { first_name: "A" });
  assert.equal(payload.id, 7);
  assert.equal(attempts, 2);
  assert.ok(sleeps.some((ms) => ms >= 500));
});

test("extractRoappId reads nested payloads", () => {
  assert.equal(extractRoappId({ data: { id: 42 } }), 42);
  assert.equal(extractRoappId({ id: 3 }), 3);
});

test("bookingSchedule rejects missing slot", () => {
  assert.throws(
    () => bookingSchedule({ preferred_date: "2026-09-12", preferred_slot: null }),
    (err: unknown) => err instanceof RoappError && err.code === "roapp_missing_slot",
  );
  const schedule = bookingSchedule({ preferred_date: "2026-09-12", preferred_slot: "09:00" });
  assert.match(schedule.scheduledFor, /2026-09-12/);
  assert.ok(Date.parse(schedule.scheduledTo) > Date.parse(schedule.scheduledFor));
});

test("RO App synchronization creates contact, booking, order and retries partial progress", async (t) => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } }),
    sql = wrap(pg);
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  await sql`insert into shop_settings(shop_id,roapp_sync_enabled) values('white-gloss',true)
    on conflict(shop_id) do update set roapp_sync_enabled=true`;

  let sequence = 0;
  async function fixture(opts: { date?: string | null; slot?: string | null; phone?: string } = {}) {
    const [row] =
      await sql<WorkflowBooking>`insert into bookings(
        shop_id,customer_name,phone,email,package_id,class_id,extra_ids,total_cents,preferred_date,preferred_slot,note
      ) values(
        'white-gloss','Integration Test',${opts.phone || `+49000000${++sequence}`},'test@example.invalid',
        'premium','kompakt','["felgen"]',34900,${opts.date === undefined ? "2026-09-15" : opts.date},
        ${opts.slot === undefined ? "11:00" : opts.slot},'Hinweis'
      ) returning *`;
    await queueRoappBooking(sql, row);
    return row;
  }

  try {
    await t.test("finds existing contact or creates person, booking and order with WG id", async () => {
      const api = mockApi();
      const existing = api.seedPerson("+4900000099", "test@example.invalid");
      const row = await fixture({ phone: "+4900000099" });
      // Force email-only miss then phone hit via seeded list returned for any GET.
      assert.equal(
        (await runRoappSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 }))
          .synced,
        1,
      );
      assert.equal(api.people.length, 1);
      assert.equal(api.people[0].id, existing);
      assert.equal(api.bookings.length, 1);
      assert.equal(api.orders.length, 1);
      assert.match(api.bookings[0].comment || "", /WG-\d+/);
      assert.match(api.orders[0].manager_notes || "", /WG-\d+/);
      assert.deepEqual(
        api.bookingItems.map((i) => i.entity_id).sort(),
        [100, 200],
      );
      assert.deepEqual(
        api.orderItems.map((i) => i.entity_id).sort(),
        [100, 200],
      );
      const [queue] = await sql<{
        status: string;
        ro_contact_id: number;
        ro_booking_id: number;
        ro_order_id: number;
      }>`select status,ro_contact_id,ro_booking_id,ro_order_id from roapp_sync_queue where booking_id=${row.id}`;
      assert.equal(queue.status, "synced");
      assert.equal(queue.ro_contact_id, existing);
      assert.ok(queue.ro_booking_id);
      assert.ok(queue.ro_order_id);
    });

    await t.test("creates a new person when lookup finds nothing", async () => {
      const api = mockApi();
      const row = await fixture();
      assert.equal(
        (await runRoappSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 }))
          .synced,
        1,
      );
      assert.equal(api.people.length, 1);
      assert.ok(api.calls.includes("POST /contacts/people"));
    });

    await t.test("resumes after partial failure without duplicating contact/booking", async () => {
      const api = mockApi();
      const row = await fixture();
      api.failNext("POST /orders");
      assert.equal(
        (await runRoappSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 }))
          .failed,
        1,
      );
      const [mid] = await sql<{
        ro_contact_id: number | null;
        ro_booking_id: number | null;
        ro_order_id: number | null;
        status: string;
      }>`select ro_contact_id,ro_booking_id,ro_order_id,status from roapp_sync_queue where booking_id=${row.id}`;
      assert.equal(mid.status, "pending");
      assert.ok(mid.ro_contact_id);
      assert.ok(mid.ro_booking_id);
      assert.equal(mid.ro_order_id, null);
      await sql`update roapp_sync_queue set next_attempt_at=now() where booking_id=${row.id}`;
      assert.equal(
        (await runRoappSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 }))
          .synced,
        1,
      );
      assert.equal(api.people.length, 1);
      assert.equal(api.bookings.length, 1);
      assert.equal(api.orders.length, 1);
    });

    await t.test("missing slot marks review and keeps local booking", async () => {
      const api = mockApi();
      const row = await fixture({ date: null, slot: null });
      assert.equal(
        (await runRoappSync(sql, { request: api.request, creds, bookingId: row.id, limit: 1 }))
          .review,
        1,
      );
      const [queue] = await sql<{
        status: string;
        last_error: string;
      }>`select status,last_error from roapp_sync_queue where booking_id=${row.id}`;
      assert.equal(queue.status, "review");
      assert.equal(queue.last_error, "roapp_missing_slot");
      const [saved] = await sql<WorkflowBooking>`select * from bookings where id=${row.id}`;
      assert.equal(saved.status, "neu");
      assert.equal(api.bookings.length, 0);
    });

    await t.test("disabled synchronization performs no remote calls", async () => {
      const api = mockApi();
      const row = await fixture();
      await sql`update shop_settings set roapp_sync_enabled=false where shop_id='white-gloss'`;
      assert.equal(
        (await runRoappSync(sql, { request: api.request, creds, bookingId: row.id })).synced,
        0,
      );
      assert.equal(api.calls.length, 0);
      await sql`update shop_settings set roapp_sync_enabled=true where shop_id='white-gloss'`;
    });
  } finally {
    await pg.close();
  }
});
