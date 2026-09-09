import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import { runOdooSync, queueOdooBooking, bookingOdooValues, type OdooCall } from "./odoo-sync.ts";

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
function remote() {
  const records: Record<string, { id: number; [key: string]: unknown }[]> = {
    "res.partner": [],
    x_auftrage: [],
  };
  const creates: string[] = [];
  let lostResponse = false,
    loseBeforeCreate = false;
  const call: OdooCall = async <T>(
    model: string,
    method: string,
    body: Record<string, unknown>,
  ) => {
    assert.ok(
      ["res.partner", "x_auftrage", "x_auftrage_stage"].includes(model),
      "No invoice, calendar or message writes",
    );
    if (model === "x_auftrage_stage") return [{ id: 1 }] as T;
    if (method === "search_read") {
      const [[field, , value]] = body.domain as string[][];
      return records[model].filter((row) => row[field] === value) as T;
    }
    if (method === "create") {
      creates.push(model);
      if (loseBeforeCreate) {
        loseBeforeCreate = false;
        throw new Error("Request lost before remote commit");
      }
      const [values] = body.vals_list as Record<string, unknown>[];
      const id = records[model].length + 1;
      records[model].push({ ...values, id });
      if (lostResponse) {
        lostResponse = false;
        throw new Error("Response lost after remote commit");
      }
      return [id] as T;
    }
    assert.equal(method, "write");
    const [id] = body.ids as number[];
    Object.assign(
      records[model].find((row) => row.id === id)!,
      body.vals,
    );
    return true as T;
  };
  return {
    call,
    records,
    creates,
    loseResponse: () => {
      lostResponse = true;
    },
    loseRequest: () => {
      loseBeforeCreate = true;
    },
  };
}

test("Odoo synchronization preserves booking safety across retries and interrupted creates", async (t) => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } }),
    sql = wrap(pg);
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  await sql`insert into shop_settings(shop_id,odoo_sync_enabled) values('white-gloss',true) on conflict(shop_id) do update set odoo_sync_enabled=true`;
  let sequence = 0;
  async function fixture() {
    const [row] =
      await sql<WorkflowBooking>`insert into bookings(shop_id,customer_name,phone,email,package_id,class_id,total_cents,note)
      values('white-gloss','Integration test',${`+49000000${++sequence}`},'test@example.invalid','premium','kompakt',34900,'<script>unsafe</script>') returning *`;
    await queueOdooBooking(sql, row);
    return row;
  }
  try {
    await t.test("creates one contact/order, with no confirmation or invoice", async () => {
      const row = await fixture(),
        api = remote();
      assert.equal(
        (await runOdooSync(sql, { call: api.call, bookingId: row.id, limit: 1 })).synced,
        1,
      );
      await queueOdooBooking(sql, row);
      await runOdooSync(sql, { call: api.call, bookingId: row.id, limit: 1 });
      assert.deepEqual(api.creates, ["res.partner", "x_auftrage"]);
      const [saved] = await sql<WorkflowBooking>`select * from bookings where id=${row.id}`;
      assert.equal(saved.status, "neu");
      assert.equal(saved.confirmed_at, null);
      assert.equal(api.records.x_auftrage[0].x_studio_value, 349);
      assert.match(String(api.records.x_auftrage[0].x_studio_notes), /&lt;script&gt;/);
      assert.match(String(api.records.x_auftrage[0].x_studio_notes), /Wartet auf manuelle/);
    });
    await t.test("recovers a committed create whose response was lost", async () => {
      const row = await fixture(),
        api = remote();
      api.loseResponse();
      await runOdooSync(sql, { call: api.call, bookingId: row.id, limit: 1 });
      await sql`update odoo_sync_queue set next_attempt_at=now() where booking_id=${row.id}`;
      assert.equal(
        (await runOdooSync(sql, { call: api.call, bookingId: row.id, limit: 1 })).synced,
        1,
      );
      assert.equal(api.records["res.partner"].length, 1);
      assert.deepEqual(api.creates, ["res.partner", "x_auftrage"]);
    });
    await t.test("does not repeat an uncertain create when lookup finds nothing", async () => {
      const row = await fixture(),
        api = remote();
      api.loseRequest();
      await runOdooSync(sql, { call: api.call, bookingId: row.id, limit: 1 });
      await sql`update odoo_sync_queue set next_attempt_at=now() where booking_id=${row.id}`;
      assert.equal(
        (await runOdooSync(sql, { call: api.call, bookingId: row.id, limit: 1 })).review,
        1,
      );
      assert.equal(api.creates.length, 1);
      const [queue] = await sql<{
        status: string;
      }>`select status from odoo_sync_queue where booking_id=${row.id}`;
      assert.equal(queue.status, "review");
    });
    await t.test("edits during transfer remain queued at their newer version", async () => {
      const row = await fixture(),
        api = remote();
      const call: OdooCall = async <T>(
        model: string,
        method: string,
        body: Record<string, unknown>,
      ) => {
        const value = await api.call<T>(model, method, body);
        if (model === "x_auftrage" && method === "write")
          await queueOdooBooking(sql, { id: row.id, version: row.version + 1 });
        return value;
      };
      await runOdooSync(sql, { call, bookingId: row.id, limit: 1 });
      const [queue] = await sql<{
        status: string;
        requested_version: number;
        synced_version: number;
      }>`select status,requested_version,synced_version from odoo_sync_queue where booking_id=${row.id}`;
      assert.equal(queue.status, "pending");
      assert.equal(queue.requested_version, 2);
      assert.equal(queue.synced_version, 1);
    });
    await t.test("recovers a booking saved by an older release without a queue event", async () => {
      const row = await fixture(),
        api = remote();
      await sql`delete from odoo_sync_queue where booking_id=${row.id}`;
      assert.equal(
        (await runOdooSync(sql, { call: api.call, bookingId: row.id, limit: 1 })).synced,
        1,
      );
      assert.deepEqual(api.creates, ["res.partner", "x_auftrage"]);
    });
    await t.test("an expired runner cannot start another remote write", async () => {
      const row = await fixture(),
        api = remote();
      const call: OdooCall = async <T>(
        model: string,
        method: string,
        body: Record<string, unknown>,
      ) => {
        const result = await api.call<T>(model, method, body);
        await sql`update odoo_sync_runner set lease_token='new-runner' where shop_id='white-gloss'`;
        return result;
      };
      assert.equal((await runOdooSync(sql, { call, bookingId: row.id, limit: 1 })).review, 1);
      assert.equal(api.creates.length, 0);
      await sql`update odoo_sync_runner set lease_token=null,locked_until=null where shop_id='white-gloss'`;
    });
    await t.test("disabled synchronization performs no remote calls", async () => {
      const row = await fixture(),
        api = remote();
      await sql`update shop_settings set odoo_sync_enabled=false where shop_id='white-gloss'`;
      assert.equal((await runOdooSync(sql, { call: api.call, bookingId: row.id })).synced, 0);
      assert.equal(api.creates.length, 0);
    });
  } finally {
    await pg.close();
  }
});

test("booking date remains an unconfirmed request and vehicle class is not invented as a vehicle", () => {
  const values = bookingOdooValues(
    {
      id: 1,
      customer_name: "Test",
      status: "neu",
      phone: "123456",
      email: null,
      package_id: "premium",
      class_id: "kompakt",
      extra_ids: "[]",
      preferred_date: "2030-01-10",
      preferred_slot: "09:00",
      total_cents: 34900,
      note: null,
    } as WorkflowBooking,
    1,
    2,
  );
  assert.equal(values.x_studio_date, "2030-01-10");
  assert.equal("x_studio_many2one_1" in values, false);
  assert.equal("invoice_ids" in values, false);
});
