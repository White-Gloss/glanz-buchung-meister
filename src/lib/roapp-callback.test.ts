import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import {
  euroCents,
  verifyRoSignature,
  refreshRoOrder,
  handleRoCallback,
} from "./roapp-callback.ts";
import type { RoappRequest } from "./roapp.ts";
import { bookingStatusToken, verifyBookingStatusToken } from "./booking-status-token.ts";

test("callback rejects unauthenticated payloads and malformed amounts", async () => {
  const secret = "s".repeat(40),
    id = "9cba80cc-93b5-459b-bfd3-445e724dafc5";
  const signature = createHash("sha256")
    .update(id + secret)
    .digest("hex");
  assert.ok(verifyRoSignature(id, signature, secret));
  assert.equal(verifyRoSignature(id, signature, "x".repeat(40)), false);
  for (const value of [null, undefined, "", -1, "1.001", "NaN", Infinity])
    assert.throws(() => euroCents(value));
  assert.equal(euroCents("149.99"), 14999);
  process.env.ROAPP_WEBHOOK_SECRET = secret;
  assert.equal(
    (
      await handleRoCallback(
        new Request("https://example.invalid", { method: "POST", body: "null" }),
        {} as Sql,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handleRoCallback(
        new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ id }) }),
        {} as Sql,
      )
    ).status,
    401,
  );
  delete process.env.ROAPP_WEBHOOK_SECRET;
});

test("personal status tokens cannot access another customer's booking", () => {
  process.env.BETTER_AUTH_SECRET = "status-test".repeat(4);
  const token = bookingStatusToken(12);
  assert.ok(verifyBookingStatusToken(12, token));
  assert.equal(verifyBookingStatusToken(13, token), false);
  assert.equal(verifyBookingStatusToken(12, ""), false);
  delete process.env.BETTER_AUTH_SECRET;
});

test("canonical RO prices stay provisional until manual approval and stale updates cannot overwrite them", async () => {
  const pg = new PGlite();
  const wrap = (db: Pick<PGlite, "query">): Sql => {
    const sql = (async (parts: TemplateStringsArray, ...args: unknown[]) =>
      (
        await db.query(
          parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
          args,
        )
      ).rows) as Sql;
    sql.query = async <T>(q: string, args: unknown[] = []) => (await db.query<T>(q, args)).rows;
    sql.transaction = (fn) => fn(sql);
    return sql;
  };
  const sql = wrap(pg);
  sql.transaction = (fn) => pg.transaction((tx) => fn(wrap(tx)));
  try {
    for (const f of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
      await pg.exec(await readFile(`migrations/${f}`, "utf8"));
    const [booking] = await sql<{
      id: number;
    }>`insert into bookings(shop_id,customer_name,phone,package_id,class_id,extra_ids,total_cents) values('white-gloss','Internal Test','+490000000','basis','kompakt','[]',14900) returning id`;
    await sql`insert into roapp_sync_queue(booking_id,requested_version,ro_order_id) values(${booking.id},1,501)`;
    process.env.ROAPP_APPROVED_STATUS_ID = "2";
    let status = { id: 1, name: "Anfrage (Preise prüfen)" },
      total = "175.00",
      modified = "2026-09-19T12:00:00Z";
    const request: RoappRequest = async <T>(_method: string, path: string) =>
      (path.endsWith("/public-url")
        ? { url: "https://web.roapp.io/public/test" }
        : { id: 501, status, total, modified_at: modified, scheduled_for: null }) as T;
    await refreshRoOrder(sql, 501, request);
    assert.equal(
      (await sql`select total_cents from bookings where id=${booking.id}`)[0].total_cents,
      14900,
    );
    assert.equal((await sql`select fixed_price from roapp_order_state`)[0].fixed_price, false);
    status = { id: 2, name: "Fixpreis bestätigt" };
    modified = "2026-09-19T12:01:00Z";
    await refreshRoOrder(sql, 501, request);
    assert.equal(
      (await sql`select total_cents from bookings where id=${booking.id}`)[0].total_cents,
      17500,
    );
    assert.equal((await sql`select fixed_price from roapp_order_state`)[0].fixed_price, true);
    total = "199.00";
    modified = "2026-09-19T11:00:00Z";
    await refreshRoOrder(sql, 501, request);
    assert.equal(
      (await sql`select total_cents from bookings where id=${booking.id}`)[0].total_cents,
      17500,
    );
    status = { id: 1, name: "Anfrage (Preise prüfen)" };
    modified = "2026-09-19T12:02:00Z";
    await refreshRoOrder(sql, 501, request);
    const [state] = await sql`select fixed_price,inquiry_cents from roapp_order_state`;
    assert.equal(state.fixed_price, false);
    assert.equal(state.inquiry_cents, 14900);
    assert.equal((await sql`select * from roapp_order_history`).length, 3);
  } finally {
    delete process.env.ROAPP_APPROVED_STATUS_ID;
    await pg.close();
  }
});
