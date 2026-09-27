import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { legacyPlan } from "./bitrix-legacy-plan.mjs";
import { transferLegacyBooking } from "./import-bitrix-legacy.mjs";
import { ensureBitrixSchema } from "../src/lib/bitrix-sync.ts";
import { toRestDealFields } from "../src/lib/bitrix-rest.ts";

async function setup(t, failure) {
  const db = new PGlite({ parsers: { 1082: (value) => value, 20: Number } });
  t.after(() => db.close());
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  const query = async (text, values = []) => (await db.query(text, values)).rows;
  const sql = (parts, ...values) =>
    query(
      parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, ""),
      values,
    );
  sql.query = query;
  sql.transaction = (fn) =>
    db.transaction((tx) => {
      const run = async (text, values = []) => (await tx.query(text, values)).rows;
      const wrapped = (parts, ...values) =>
        run(
          parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, ""),
          values,
        );
      wrapped.query = run;
      return fn(wrapped);
    });
  const [booking] =
    await query(`INSERT INTO bookings(shop_id,customer_name,phone,email,package_id,class_id,extra_ids,total_cents,pickup_cents,preferred_date,preferred_slot,note,city_slug)
  VALUES('white-gloss','Legacy QA','+4900000011','legacy@example.invalid','basis','kompakt','[]',26800,0,'2026-09-22','13:00','','horb') RETURNING *`);
  await ensureBitrixSchema(sql);
  const source = {
    booking: { ...booking, ro_order_id: 123 },
    order: {
      id: 123,
      total: "268.00",
      payed: "0.00",
      discount_sum: "0.00",
      status: { name: "In Rechnung gestellt" },
      scheduled_for: "2026-09-22T11:00:00Z",
      scheduled_to: "2026-09-22T13:00:00Z",
      done_at: null,
      closed_at: null,
    },
    items: [149, 119].map((price, i) => ({
      id: i + 1,
      entity: { title: `Leistung ${i + 1}` },
      quantity: "1.000",
      price: price.toFixed(2),
      discount: { type: "percentage", percentage: 0, amount: "0.00" },
      taxes: [],
      is_refunded: false,
    })),
    photos: [],
  };
  const plan = legacyPlan(source);
  const native = { deals: [], products: [], events: [], contacts: [], calls: [] };
  const request = async (method, path, body) => {
    native.calls.push(`${method} ${path}`);
    if (path === "/contacts/search") return native.contacts;
    if (path === "/contacts") {
      const contact = { id: 422 };
      native.contacts.push(contact);
      return contact;
    }
    if (path === "/deals" && method === "POST") {
      native.deals.push({ ID: 500, ...toRestDealFields(body) });
      return { id: 500 };
    }
    if (path === "/deals/500/products") {
      native.products = body.items.map((p) => ({
        PRODUCT_NAME: p.productName,
        PRICE: p.price,
        QUANTITY: p.quantity,
        TAX_RATE: p.taxRate,
        TAX_INCLUDED: p.taxIncluded ? "Y" : "N",
      }));
      return { ok: true };
    }
    if (path === "/calendar-events") {
      native.events.push({ eventId: 1100, start: body.from, end: body.to, resourceId: 1 });
      if (failure === "calendar_timeout") throw new Error("simulated_timeout");
      return { id: 1100 };
    }
    if (path === "/deals/500" && method === "PATCH") {
      Object.assign(native.deals[0], toRestDealFields(body));
      return { ok: true };
    }
    throw new Error(`Unexpected mutation ${method} ${path}`);
  };
  const nativeRead = async (method) => {
    if (method === "crm.deal.get")
      return { ...native.deals[0], ...(failure === "wrong_price" ? { OPPORTUNITY: 999 } : {}) };
    if (method === "crm.deal.productrows.get") return native.products;
    if (method === "crm.item.get") return { item: { UF_CRM_WG_PHOTOS: [] } };
    throw new Error(`Unexpected method ${method}`);
  };
  const events = [];
  const run = () =>
    transferLegacyBooking({
      plan,
      source,
      sql,
      request,
      nativeRead,
      loadedPhotos: new Map([[booking.id, []]]),
      record: async (event) => events.push(event),
      calendarRead: async () => native.events,
      verifySource: async () => {
        if (failure === "source_drift") throw new Error("legacy_source_changed_during_transfer");
      },
    });
  return { run, native, events, sql, booking, plan };
}

test("legacy handoff writes exactly one native contact/deal/calendar, preserves zero tax and does not repeat on resume", async (t) => {
  const state = await setup(t);
  await state.run();
  const calls = [...state.native.calls];
  await state.run();
  assert.deepEqual(state.native.calls, calls);
  assert.equal(state.native.deals.length, 1);
  assert.equal(state.native.events.length, 1);
  assert.equal(state.native.contacts.length, 1);
  assert.deepEqual(
    state.native.products.map((p) => p.TAX_RATE),
    [0, 0],
  );
  assert.equal(state.native.deals[0].STAGE_ID, "FINAL_INVOICE");
  assert.match(state.native.deals[0].COMMENTS, /Originalstatus: In Rechnung gestellt/);
  const [booking] = await state.sql.query("SELECT * FROM bookings WHERE id=$1", [state.booking.id]);
  assert.equal(booking.status, state.booking.status);
  assert.equal(booking.total_cents, 26800);
  assert.equal(booking.bitrix_deal_id, 500);
  assert.equal(booking.bitrix_event_id, 1100);
  assert.equal((await state.sql.query("SELECT count(*) AS count FROM outbound_queue"))[0].count, 0);
  assert.ok(state.events.some((e) => e.phase === "native_readback_verified"));
  assert.ok(calls.every((call) => !/(invoice|message|mail|payment)/i.test(call)));
});

test("uncertain calendar creation enters review and cannot create a duplicate on retry", async (t) => {
  const state = await setup(t, "calendar_timeout");
  await assert.rejects(state.run(), /simulated_timeout/);
  const [queue] = await state.sql.query("SELECT * FROM bitrix_sync_queue WHERE booking_id=$1", [
    state.booking.id,
  ]);
  assert.equal(queue.status, "review");
  assert.equal(queue.write_pending, "legacy_calendar");
  await assert.rejects(state.run(), /different_or_uncertain_transfer_exists/);
  assert.equal(state.native.events.length, 1);
  assert.equal(state.native.deals.length, 1);
});

test("native readback discrepancy blocks cutover by leaving the transfer in review", async (t) => {
  const state = await setup(t, "wrong_price");
  await assert.rejects(state.run(), /native_deal_readback_failed/);
  const [queue] = await state.sql.query("SELECT * FROM bitrix_sync_queue WHERE booking_id=$1", [
    state.booking.id,
  ]);
  assert.equal(queue.status, "review");
  assert.equal(queue.last_error, "legacy_transfer_unverified");
  await assert.rejects(state.run(), /different_or_uncertain_transfer_exists/);
  assert.equal(state.native.deals.length, 1);
});

test("a source change during transfer blocks cutover and requires reconciliation", async (t) => {
  const state = await setup(t, "source_drift");
  await assert.rejects(state.run(), /legacy_source_changed_during_transfer/);
  const [queue] = await state.sql.query("SELECT * FROM bitrix_sync_queue WHERE booking_id=$1", [
    state.booking.id,
  ]);
  assert.equal(queue.status, "review");
  await assert.rejects(state.run(), /different_or_uncertain_transfer_exists/);
  assert.equal(state.native.events.length, 1);
});
