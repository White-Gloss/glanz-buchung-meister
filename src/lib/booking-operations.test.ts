import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { saveBookingRequest } from "./booking-workflow.ts";
import { createRequestUploadCapability } from "./booking-upload-capability.ts";
import type { PublicBookingInput } from "./booking-schema.ts";
import { site } from "../data/site.ts";
import {
  completeServiceWithPayment,
  confirmBookingWithSchedule,
  listBusyWindows,
} from "./booking-operations.ts";
import { berlinWallToUtc } from "./booking-time.ts";

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
  for (const file of (await readdir("migrations")).filter((file) => file.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  const sql = wrap(pg, (fn) => pg.transaction((tx) => fn(wrap(tx))));
  await sql`insert into "user"(id,name,email,"emailVerified") values('owner','Owner',${process.env.OWNER_EMAIL || site.email},true)`;
  return { pg, sql };
}

function input(overrides: Partial<PublicBookingInput> = {}): PublicBookingInput {
  return {
    idempotencyKey: randomUUID(),
    name: "Bitrix Test",
    phone: "+490000123456",
    email: "qa@example.invalid",
    date: "2026-11-02",
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

test("duration blocks overlap including overnight; inquiries never occupy the shop", async () => {
  const { pg, sql } = await database();
  try {
    const first = await create(sql);
    const second = await create(sql, input({ slot: "11:00" }));
    const third = await create(sql, input({ date: "2026-11-04" }));
    await confirmBookingWithSchedule(sql, first.id, first.version, "owner", {
      startDate: "2026-11-02",
      startTime: "09:00",
      durationMinutes: 180,
      agreedCents: 14900,
    });
    await assert.rejects(
      () =>
        confirmBookingWithSchedule(sql, second.id, second.version, "owner", {
          startDate: "2026-11-02",
          startTime: "11:00",
          durationMinutes: 180,
          agreedCents: 14900,
        }),
      /Terminkonflikt/,
    );
    assert.equal((await sql`select * from booking_time_blocks`).length, 1);
    assert.equal((await sql`select * from bookings where status='bestaetigt'`).length, 1);
    const long = await create(sql, input({ date: "2026-11-05", packageId: "keramik" }));
    await confirmBookingWithSchedule(sql, long.id, long.version, "owner", {
      startDate: "2026-11-05",
      startTime: "09:00",
      durationMinutes: 1920,
      agreedCents: 89900,
    });
    await assert.rejects(
      () =>
        confirmBookingWithSchedule(sql, third.id, third.version, "owner", {
          startDate: "2026-11-06",
          startTime: "09:00",
          durationMinutes: 180,
          agreedCents: 14900,
          customerAccepted: true,
        }),
      /Terminkonflikt/,
    );
    const busy = await listBusyWindows(
      sql,
      berlinWallToUtc("2026-11-05", "00:00").toISOString(),
      berlinWallToUtc("2026-11-07", "00:00").toISOString(),
    );
    assert.ok(
      busy.some(
        (window) =>
          new Date(window.end).getTime() > berlinWallToUtc("2026-11-06", "08:00").getTime(),
      ),
    );
  } finally {
    await pg.close();
  }
});

test("price increase or date change waits for customer acceptance and does not reserve", async () => {
  const { pg, sql } = await database();
  try {
    const row = await create(sql);
    const result = await confirmBookingWithSchedule(sql, row.id, row.version, "owner", {
      startDate: "2026-11-09",
      startTime: "09:00",
      durationMinutes: 180,
      agreedCents: 24900,
    });
    assert.equal(result.awaitingCustomer, true);
    assert.equal(result.booking.status, "neu");
    assert.equal(result.booking.ops_stage, "kundenrueckmeldung");
    assert.equal(
      (await sql`select * from booking_time_blocks where booking_id=${row.id}`).length,
      0,
    );
    const confirmed = await confirmBookingWithSchedule(
      sql,
      row.id,
      result.booking.version,
      "owner",
      {
        startDate: "2026-11-09",
        startTime: "09:00",
        durationMinutes: 180,
        agreedCents: 24900,
        customerAccepted: true,
      },
    );
    assert.equal(confirmed.awaitingCustomer, false);
    assert.equal(confirmed.booking.status, "bestaetigt");
    assert.equal(
      (await sql`select * from booking_time_blocks where booking_id=${row.id}`).length,
      1,
    );
  } finally {
    await pg.close();
  }
});

test("Bitrix owns confirmation and invoicing; legacy queues remain empty after completion", async () => {
  const { pg, sql } = await database();
  try {
    const row = await create(sql);
    const confirmed = await confirmBookingWithSchedule(sql, row.id, row.version, "owner", {
      startDate: "2026-11-02",
      startTime: "09:00",
      durationMinutes: 180,
      agreedCents: 14900,
    });
    assert.equal(confirmed.booking.invoice_status, "nicht_erstellt");
    const completed = await completeServiceWithPayment(
      sql,
      row.id,
      confirmed.booking.version,
      "owner",
      {
        payment: "bar",
        cashCents: 14900,
        cashDate: "2026-11-02",
      },
    );
    assert.equal(completed.booking.invoice_status, "ausstehend");
    for (const table of [
      "zoho_job_queue",
      "zoho_sync_queue",
      "odoo_sync_queue",
      "roapp_sync_queue",
      "lexware_sync_queue",
    ]) {
      const [exists] = await sql`select to_regclass(${table}) as name`;
      if (exists.name)
        assert.equal(
          (await sql.query("select * from " + table + " where booking_id=$1", [row.id])).length,
          0,
          table,
        );
    }
    const [queued] = await sql.query<{ requested_version: number }>(
      "select requested_version from bitrix_sync_queue where booking_id=$1",
      [row.id],
    );
    assert.equal(queued.requested_version, completed.booking.version);
  } finally {
    await pg.close();
  }
});

test("an old customer acceptance never approves a revised offer", async () => {
  const { pg, sql } = await database();
  try {
    const row = await create(sql);
    await sql`update bookings set customer_accepted_at=now() where id=${row.id}`;
    const result = await confirmBookingWithSchedule(sql, row.id, row.version, "owner", {
      startDate: "2026-11-02",
      startTime: "09:00",
      durationMinutes: 180,
      agreedCents: 34900,
    });
    assert.equal(result.awaitingCustomer, true);
    assert.equal(result.booking.customer_accepted_at, null);
    assert.equal(
      (await sql`select * from booking_time_blocks where booking_id=${row.id}`).length,
      0,
    );
    const [queued] = await sql<{
      requested_version: number;
    }>`select requested_version from bitrix_sync_queue where booking_id=${row.id}`;
    assert.equal(queued.requested_version, result.booking.version);
  } finally {
    await pg.close();
  }
});
