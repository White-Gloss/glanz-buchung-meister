import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import {
  saveBookingRequest,
  saveManualBookingRequest,
  confirmBookingManually,
  changeBookingStatus,
  editBooking,
} from "./booking-workflow.ts";
import { createRequestUploadCapability } from "./booking-upload-capability.ts";
import { type PublicBookingInput } from "./booking-schema.ts";
import { isBookingOwner } from "./booking-owner.ts";
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
async function database() {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  for (const f of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${f}`, "utf8"));
  const sql = wrap(pg, (fn) => pg.transaction((tx) => fn(wrap(tx))));
  await sql`insert into "user"(id,name,email,"emailVerified") values('owner','Owner',${process.env.OWNER_EMAIL || site.email},true),('operator','Other','other@white-gloss.de',true),('unverified','Unverified','unverified@example.invalid',false)`;
  return { pg, sql };
}
function input(overrides: Partial<PublicBookingInput> = {}): PublicBookingInput {
  return {
    idempotencyKey: randomUUID(),
    name: "Test Owner Flow",
    phone: "+490000123456",
    email: "qa@example.invalid",
    date: "2999-04-01",
    slot: "09:00",
    note: "",
    packageId: "basis",
    classId: "kompakt",
    extraIds: [],
    citySlug: "",
    kind: "booking",
    privacy: true,
    ...overrides,
  };
}
async function create(sql: Sql, data = input()) {
  return (await saveBookingRequest(sql, data, createRequestUploadCapability(data.idempotencyKey)))
    .booking;
}

test("owner confirmation excludes general operators, unverified email and preview fallback", () => {
  const env = { OWNER_EMAIL: "owner@example.invalid" };
  assert.equal(isBookingOwner({ id: "u", email: env.OWNER_EMAIL, emailVerified: true }, env), true);
  for (const u of [
    { id: "other", email: "team@white-gloss.de", emailVerified: true },
    { id: "u", email: env.OWNER_EMAIL, emailVerified: false },
    { id: "dev-user", email: env.OWNER_EMAIL, emailVerified: true },
  ])
    assert.equal(isBookingOwner(u, env), false);
});

test("manual requests keep audit, Odoo queue and separate confirmation; customer email is opt-in and retries are safe", async () => {
  const { pg, sql } = await database();
  try {
    const { privacy: _privacy, ...details } = input();
    const data = { ...details, notifyCustomer: false };
    const first = await saveManualBookingRequest(sql, data, "owner");
    const retry = await saveManualBookingRequest(sql, data, "owner");
    assert.equal(first.booking.id, retry.booking.id);
    assert.equal(first.booking.status, "neu");
    assert.equal(first.booking.confirmed_at, null);
    assert.equal(
      (await sql`select actor from booking_events where booking_id=${first.booking.id}`)[0].actor,
      "owner",
    );
    assert.equal(
      (await sql`select * from odoo_sync_queue where booking_id=${first.booking.id}`).length,
      1,
    );
    assert.equal(
      (await sql`select * from lexware_sync_queue where booking_id=${first.booking.id}`).length,
      1,
    );
    assert.equal((await sql`select * from outbound_queue where to_addr=${data.email}`).length, 0);
    await assert.rejects(
      () => saveManualBookingRequest(sql, { ...data, notifyCustomer: true }, "owner"),
      /Anfragekennung/,
    );
    const second = await saveManualBookingRequest(
      sql,
      { ...data, idempotencyKey: randomUUID(), notifyCustomer: true },
      "operator",
    );
    const mail = await sql<{
      attachments: unknown[];
    }>`select attachments from outbound_queue where booking_id=${second.booking.id} and to_addr=${data.email}`;
    assert.equal(mail.length, 1, "Explicit opt-in creates one Resend customer notification");
    assert.deepEqual(
      mail[0].attachments,
      [],
      "Do not generate a competing local accounting document",
    );
    // A public request cannot replay a private manual request with the same UUID.
    const publicRequest = await create(sql, { ...details, privacy: true });
    assert.notEqual(publicRequest.id, first.booking.id);
  } finally {
    await pg.close();
  }
});

test("booking workflow commits requests, audit and durable notifications atomically", async () => {
  const { pg, sql } = await database();
  try {
    const data = input();
    const [a, b] = await Promise.all([create(sql, data), create(sql, data)]);
    assert.equal(a.id, b.id);
    assert.equal(a.status, "neu");
    assert.equal(a.confirmed_at, null);
    assert.equal((await sql`select * from bookings`).length, 1);
    assert.equal((await sql`select * from customers`).length, 1);
    assert.equal((await sql`select * from booking_events`).length, 1);
    const count = (await sql`select * from outbound_queue`).length;
    assert.ok(count >= 1);
    await create(sql, data);
    assert.equal((await sql`select * from outbound_queue`).length, count);
    await assert.rejects(() => create(sql, { ...data, name: "Different" }), /Anfragekennung/);
    await assert.rejects(() => create(sql, input({ slot: "99:99" })));
    await assert.rejects(
      () =>
        saveBookingRequest(sql, input(), createRequestUploadCapability(randomUUID()), async () => {
          throw new Error("outbox unavailable");
        }),
      /outbox unavailable/,
    );
    assert.equal(
      (await sql`select * from bookings`).length,
      1,
      "outbox DB failure rolls back complete transaction",
    );
  } finally {
    await pg.close();
  }
});

test("only explicit owner action confirms; conflicting simultaneous confirmations have one winner", async () => {
  const { pg, sql } = await database();
  try {
    const [a, b] = await Promise.all([create(sql), create(sql)]);
    assert.equal(a.status, "neu");
    assert.equal(b.status, "neu", "parallel requests remain inquiries");
    for (const actor of ["", "operator", "unverified", "dev-user", "auto", "operator:whatsapp"])
      await assert.rejects(() => confirmBookingManually(sql, a.id, 1, actor), /Inhaber/);
    await assert.rejects(
      () => sql`update bookings set status='bestaetigt' where id=${a.id}`,
      /owner confirmation/i,
    );
    await assert.rejects(
      () => changeBookingStatus(sql, a.id, 1, "bestaetigt", "owner"),
      /manuelle/,
    );
    const results = await Promise.allSettled([
      confirmBookingManually(sql, a.id, 1, "owner"),
      confirmBookingManually(sql, b.id, 1, "owner"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    const win = results.find((r) => r.status === "fulfilled")!;
    if (win.status !== "fulfilled") throw new Error("winner missing");
    const confirmed = win.value.booking;
    assert.equal(confirmed.confirmed_by, "owner");
    assert.ok(confirmed.confirmed_at);
    const size = (await sql`select * from outbound_queue`).length;
    assert.equal((await confirmBookingManually(sql, confirmed.id, 1, "owner")).changed, false);
    assert.equal((await sql`select * from outbound_queue`).length, size);
    assert.equal((await sql`select * from bookings where status='bestaetigt'`).length, 1);
  } finally {
    await pg.close();
  }
});

test("capacity, cancellation, rejection and rescheduling stay consistent with audit and reminders", async () => {
  const { pg, sql } = await database();
  try {
    const a = await create(sql),
      b = await create(sql, input({ slot: "11:00" })),
      c = await create(sql, input({ slot: "13:00" }));
    await confirmBookingManually(sql, a.id, 1, "owner");
    await confirmBookingManually(sql, b.id, 1, "owner");
    await assert.rejects(() => confirmBookingManually(sql, c.id, 1, "owner"), /Terminkonflikt/);
    await changeBookingStatus(sql, a.id, 2, "storniert", "owner");
    await confirmBookingManually(sql, c.id, 1, "owner");
    const changed = await editBooking(sql, c.id, 2, input({ slot: "15:00" }), "owner");
    assert.equal(changed.booking.status, "neu");
    assert.equal(changed.booking.confirmed_by, null);
    assert.equal(
      (await sql`select * from booking_capacity_claims where booking_id=${c.id}`).length,
      0,
    );
    await confirmBookingManually(sql, c.id, 3, "owner");
    await assert.rejects(() => editBooking(sql, c.id, 2, input(), "owner"), /inzwischen/);
    const d = await create(sql, input({ date: "2999-04-02" }));
    await changeBookingStatus(sql, d.id, 1, "abgelehnt", "owner");
    await assert.rejects(() => confirmBookingManually(sql, d.id, 2, "owner"), /offene/);
    const e = await create(sql, input({ date: "2999-04-02", packageId: "keramik" }));
    await confirmBookingManually(sql, e.id, 1, "owner");
    const f = await create(sql, input({ date: "2999-04-02", slot: "15:00" }));
    await assert.rejects(() => confirmBookingManually(sql, f.id, 1, "owner"), /Terminkonflikt/);
    const events = await sql<{
      event: string;
    }>`select event from booking_events where booking_id=${c.id} order by version`;
    assert.deepEqual(
      events.map((e) => e.event),
      ["booking.created", "booking.confirmed", "booking.rescheduled", "booking.confirmed"],
    );
    await assert.rejects(() => sql`delete from bookings where id=${f.id}`);
  } finally {
    await pg.close();
  }
});

test("no date, past date and weekend cannot be manually confirmed; completion requires a confirmed job", async () => {
  const { pg, sql } = await database();
  try {
    const a = await create(sql, input({ date: "", slot: "" }));
    await assert.rejects(() => confirmBookingManually(sql, a.id, 1, "owner"), /Datum/);
    await assert.rejects(
      () => changeBookingStatus(sql, a.id, 1, "erledigt", "owner"),
      /Statuswechsel/,
    );
    const b = await create(sql, input({ date: "2999-04-06" }));
    await sql`update bookings set preferred_date='2000-01-01' where id=${b.id}`;
    await assert.rejects(() => confirmBookingManually(sql, b.id, 1, "owner"), /vergangener/);
    const weekend = await create(sql, input({ date: "2999-04-06" }));
    await assert.rejects(
      () => confirmBookingManually(sql, weekend.id, 1, "owner"),
      /Montag bis Freitag/,
    );
    const c = await create(sql, input({ date: "2999-04-01" }));
    await confirmBookingManually(sql, c.id, 1, "owner");
    await changeBookingStatus(sql, c.id, 2, "erledigt", "owner");
    await assert.rejects(() => changeBookingStatus(sql, c.id, 3, "neu", "owner"), /Statuswechsel/);
  } finally {
    await pg.close();
  }
});

test("migration preserves historical confirmations and refuses conflicting legacy data atomically", async () => {
  for (const collision of [false, true]) {
    const pg = new PGlite();
    try {
      for (const f of (await readdir("migrations"))
        .filter((f) => f.endsWith(".sql") && f < "0007")
        .sort())
        await pg.exec(await readFile(`migrations/${f}`, "utf8"));
      await pg.exec(
        "insert into bookings(status,customer_name,phone,package_id,class_id,preferred_date,preferred_slot) values('bestaetigt','Legacy','+4900000','basis','kompakt','2999-04-01','09:00')",
      );
      if (collision)
        await pg.exec(
          "insert into bookings(status,customer_name,phone,package_id,class_id,preferred_date,preferred_slot) values('bestaetigt','Second','+4900001','basis','kompakt','2999-04-01','09:00')",
        );
      const migration = await readFile("migrations/0007_booking_workflow.sql", "utf8");
      if (collision) {
        await assert.rejects(() => pg.transaction((tx) => tx.exec(migration)));
        assert.equal(
          (await pg.query("select * from bookings where status='bestaetigt'")).rows.length,
          2,
        );
        assert.equal(
          (
            await pg.query(
              "select * from information_schema.columns where table_name='bookings' and column_name='version'",
            )
          ).rows.length,
          0,
        );
      } else {
        await pg.transaction((tx) => tx.exec(migration));
        const [row] = (
          await pg.query<{ status: string; confirmed_by: string | null }>("select * from bookings")
        ).rows;
        assert.equal(row.status, "bestaetigt");
        assert.equal(row.confirmed_by, null, "never invent a historical actor");
        assert.equal(
          (await pg.query("select * from booking_events where event='booking.imported'")).rows
            .length,
          1,
        );
      }
    } finally {
      await pg.close();
    }
  }
});
