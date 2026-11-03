// Explicit legacy mode keeps regression coverage separate from the panel default.
process.env.BOOKING_OPERATIONS = "bitrix";
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

// Fixtures need a fixed weekday pattern (Mon, Wed, Thu, Fri, Sat, next Mon) on a
// future week; hard-coded dates expire against the "no past dates" rule.
const baseMonday = (() => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 14 + ((8 - d.getUTCDay()) % 7));
  return d;
})();
function day(offset: number) {
  const d = new Date(baseMonday);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

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
    street: "Musterweg 1",
    postalCode: "72160",
    town: "Horb am Neckar",
    date: day(0),
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
    const third = await create(sql, input({ date: day(2) }));
    await confirmBookingWithSchedule(sql, first.id, first.version, "owner", {
      startDate: day(0),
      startTime: "09:00",
      durationMinutes: 180,
      agreedCents: 14900,
    });
    await assert.rejects(
      () =>
        confirmBookingWithSchedule(sql, second.id, second.version, "owner", {
          startDate: day(0),
          startTime: "11:00",
          durationMinutes: 180,
          agreedCents: 14900,
        }),
      /Terminkonflikt/,
    );
    assert.equal((await sql`select * from booking_time_blocks`).length, 1);
    assert.equal((await sql`select * from bookings where status='bestaetigt'`).length, 1);
    const long = await create(sql, input({ date: day(3), packageId: "keramik" }));
    await confirmBookingWithSchedule(sql, long.id, long.version, "owner", {
      startDate: day(3),
      startTime: "09:00",
      durationMinutes: 1920,
      agreedCents: 89900,
    });
    await assert.rejects(
      () =>
        confirmBookingWithSchedule(sql, third.id, third.version, "owner", {
          startDate: day(4),
          startTime: "09:00",
          durationMinutes: 180,
          agreedCents: 14900,
          customerAccepted: true,
        }),
      /Terminkonflikt/,
    );
    const busy = await listBusyWindows(
      sql,
      berlinWallToUtc(day(3), "00:00").toISOString(),
      berlinWallToUtc(day(5), "00:00").toISOString(),
    );
    assert.ok(
      busy.some(
        (window) => new Date(window.end).getTime() > berlinWallToUtc(day(4), "08:00").getTime(),
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
      startDate: day(7),
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
        startDate: day(7),
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
      startDate: day(0),
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
        cashDate: day(0),
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
      startDate: day(0),
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
