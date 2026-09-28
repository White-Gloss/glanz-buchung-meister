process.env.ROAPP_ACCOUNT_SCOPE = "new-test-account";
process.env.ROAPP_REVIEW_STATUS_ID = "1";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
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
  const secret = "s".repeat(20),
    id = "9cba80cc-93b5-459b-bfd3-445e724dafc5";
  const signature = createHmac("sha256", secret).update(id).digest("hex");
  assert.ok(verifyRoSignature(id, signature, secret));
  assert.equal(verifyRoSignature(id, signature, "x".repeat(40)), false);
  assert.equal(
    verifyRoSignature(
      id,
      createHash("sha256")
        .update(id + secret)
        .digest("hex"),
      secret,
    ),
    false,
  );
  assert.equal(verifyRoSignature(id, signature.slice(1), secret), false);
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
  const tooLarge = await handleRoCallback(
    new Request("https://example.invalid", { method: "POST", body: "x".repeat(65537) }),
    {} as Sql,
  );
  assert.equal(tooLarge.status, 413);
  const wrongType = await handleRoCallback(
    new Request("https://example.invalid", {
      method: "POST",
      body: JSON.stringify({ id: 42, event_name: 42 }),
    }),
    {} as Sql,
  );
  assert.equal(wrongType.status, 401);
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
    await sql`insert into roapp_sync_queue(booking_id,requested_version,ro_order_id,account_scope) values(${booking.id},1,501,${process.env.ROAPP_ACCOUNT_SCOPE})`;
    process.env.ROAPP_APPROVED_STATUS_ID = "2";
    let status = { id: 1, name: "Anfrage (Preise prüfen)" },
      total = "175.00",
      modified = "2026-09-19T12:00:00Z";
    let scheduled: string | null = null;
    const request: RoappRequest = async <T>(_method: string, path: string) =>
      (path.endsWith("/public-url")
        ? { url: "https://web.roapp.io/public/test" }
        : { id: 501, status, total, modified_at: modified, scheduled_for: scheduled }) as T;
    await sql`update roapp_sync_queue set account_scope='legacy' where booking_id=${booking.id}`;
    assert.equal(
      await refreshRoOrder(sql, 501, async () => {
        throw new Error("foreign account must not be read");
      }),
      false,
    );
    await sql`update roapp_sync_queue set account_scope=${process.env.ROAPP_ACCOUNT_SCOPE} where booking_id=${booking.id}`;
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
    process.env.ROAPP_FIRM_STATUS_ID = "4";
    process.env.ROAPP_CONFIRMED_STATUS_IDS = "4,7";
    process.env.ROAPP_COMPLETED_STATUS_IDS = "5,6";
    scheduled = "2026-10-02T12:00:00Z";
    const step = async (id: number, name: string) => {
      status = { id, name };
      modified = new Date(Date.parse(modified) + 60000).toISOString();
      await refreshRoOrder(sql, 501, request);
      return (await sql`select owner_confirmed_at,completed_at from roapp_order_state`)[0];
    };
    await step(2, "Fixpreis bestätigt");
    assert.equal((await step(3, "Akzeptiert")).owner_confirmed_at, null);
    assert.ok((await step(4, "Termin verbindlich")).owner_confirmed_at);
    scheduled = "2026-10-03T12:00:00Z";
    assert.equal((await step(4, "Termin verbindlich")).owner_confirmed_at, null);
    await step(3, "Akzeptiert");
    await step(4, "Termin verbindlich");
    const completed = (await step(5, "Erledigt")).completed_at;
    assert.ok(completed);
    assert.deepEqual((await step(6, "Geschlossen")).completed_at, completed);
    assert.equal((await step(3, "Akzeptiert")).completed_at, null);
  } finally {
    delete process.env.ROAPP_APPROVED_STATUS_ID;
    await pg.close();
  }
});
