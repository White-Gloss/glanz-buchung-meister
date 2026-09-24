import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import {
  calendarDateRange,
  publicAvailabilityDateRange,
  eventWindows,
  readBitrixCalendar,
  bitrixBusyWindows,
} from "./bitrix-calendar.ts";
import { requestedSlotBusy } from "./booking-slot-availability.ts";
import { confirmBookingWithSchedule } from "./booking-operations.ts";
import { confirmBookingManually } from "./booking-workflow.ts";
import { site } from "../data/site.ts";

const event = {
  id: 12,
  sectionId: 2,
  from: "2026-11-02T08:00:00Z",
  to: "2026-11-02T14:00:00Z",
  accessibility: "busy",
};
const webhook = "https://example.bitrix24.de/rest/1/testcode123/";
const native = (e: typeof event) => ({
  ID: String(e.id),
  SECTION_ID: String(e.sectionId),
  DATE_FROM: e.from.replace(/Z$/, ""),
  DATE_TO: e.to.replace(/Z$/, ""),
  TZ_OFFSET_FROM: "0",
  TZ_OFFSET_TO: "0",
  TZ_FROM: "UTC",
  TZ_TO: "UTC",
  ACCESSIBILITY: e.accessibility,
  DT_SKIP_TIME: "N",
});
const envelope = (data: (typeof event)[]) => Response.json({ result: data.map(native) });

test("all-day Bitrix blocks follow Berlin DST and overnight blocks keep their whole range", () => {
  const [block] = eventWindows([
    { ...event, from: "2026-10-25T00:00:00+00:00", skipTime: true, durationSeconds: 86400 },
  ]);
  assert.equal(block.start, "2026-10-24T22:00:00.000Z");
  assert.equal(block.end, "2026-10-25T23:00:00.000Z");
  assert.equal(
    eventWindows([{ ...event, to: "2026-11-04T14:00:00Z" }])[0].end,
    "2026-11-04T14:00:00.000Z",
  );
  assert.deepEqual(
    eventWindows([
      { ...event, accessibility: "free" },
      { ...event, deleted: true },
    ]),
    [],
  );
  assert.throws(() => eventWindows([{ ...event, sectionId: undefined } as any]), /vollständig/);
  assert.throws(() => eventWindows([{ ...event, from: "2026-11-02T09:00:00" }]), /vollständig/);
});

test("availability queries use inclusive Berlin dates and reject invalid or unbounded ranges", () => {
  assert.deepEqual(calendarDateRange("2026-03-29", "2026-03-29"), {
    from: "2026-03-28T23:00:00.000Z",
    to: "2026-03-29T22:00:00.000Z",
  });
  assert.throws(() => calendarDateRange("2026-02-30", "2026-03-01"));
  assert.throws(() => calendarDateRange("2026-01-01", "2027-01-01"));
});

test("public availability stays inside the supported booking horizon", () => {
  assert.deepEqual(publicAvailabilityDateRange("2026-03-01", "2026-03-14", "2026-03-01"), {
    from: "2026-02-28T23:00:00.000Z",
    to: "2026-03-14T23:00:00.000Z",
  });
  assert.throws(() => publicAvailabilityDateRange("2026-02-29", "2026-03-14", "2026-03-01"));
  assert.throws(() => publicAvailabilityDateRange("2026-03-01", "2026-06-03", "2026-03-01"));
});

test("native calendar reads the portal directly and fails closed on malformed or incomplete data", async () => {
  const rows = await readBitrixCalendar(webhook, event.from, event.to, async (url, init) => {
    assert.equal(String(url), webhook + "calendar.event.get.json");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      type: "user",
      ownerId: 1,
      section: [2],
      from: "2026-11-02",
      to: "2026-11-02",
    });
    return envelope([event]);
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].start, "2026-11-02T08:00:00.000Z");
  for (const body of [
    {},
    { result: true },
    { result: [], next: 50 },
    { error: "ACCESS_DENIED" },
    { result: [{ ...native(event), DATE_FROM: null }] },
    { result: [{ ...native(event), RRULE: { FREQ: "WEEKLY" } }] },
  ]) {
    await assert.rejects(
      readBitrixCalendar(webhook, event.from, event.to, async () => Response.json(body)),
      /vollständig/,
    );
  }
  let contacted = false;
  await assert.rejects(
    readBitrixCalendar("vibe_api_old", event.from, event.to, async () => {
      contacted = true;
      return envelope([]);
    }),
  );
  assert.equal(contacted, false);
});

test("native calendar matches the live German wall time despite inconsistent UTC helper fields", async () => {
  const body = {
    result: [
      {
        ID: "1108",
        SECTION_ID: "2",
        DATE_FROM: "25.09.2026 11:00:00",
        DATE_TO: "25.09.2026 17:00:00",
        TZ_FROM: "Europe/Berlin",
        TZ_TO: "Europe/Berlin",
        TZ_OFFSET_FROM: "7200",
        TZ_OFFSET_TO: "7200",
        DATE_FROM_TS_UTC: "1790316000",
        DATE_TO_TS_UTC: "1790337600",
        DT_SKIP_TIME: "N",
        ACCESSIBILITY: "busy",
        RRULE: "",
      },
    ],
  };
  const windows = await readBitrixCalendar(
    webhook,
    "2026-09-25T00:00:00Z",
    "2026-09-26T00:00:00Z",
    async () => Response.json(body),
  );
  assert.equal(windows[0].start, "2026-09-25T09:00:00.000Z");
  assert.equal(windows[0].end, "2026-09-25T15:00:00.000Z");
  body.result[0].TZ_OFFSET_FROM = "3600";
  await assert.rejects(
    readBitrixCalendar(webhook, event.from, event.to, async () => Response.json(body)),
    /vollständig/,
  );
});

test("a full package interval needs one continuously free capacity; adjoining bookings do not overlap", () => {
  const windows = eventWindows([event]);
  assert.equal(requestedSlotBusy(windows, "2026-11-02", "09:00", "basis"), true);
  assert.equal(requestedSlotBusy(windows, "2026-11-02", "15:00", "basis"), false);
  assert.equal(
    requestedSlotBusy(
      windows.filter((w) => w.resourceId === 1),
      "2026-11-02",
      "09:00",
      "basis",
    ),
    false,
  );
});

function wrap(pg: Pick<PGlite, "query">, transaction?: Sql["transaction"]): Sql {
  const sql = (async (parts: TemplateStringsArray, ...values: unknown[]) =>
    (
      await pg.query(
        parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
        values,
      )
    ).rows) as Sql;
  sql.query = async <T>(text: string, values: unknown[] = []) =>
    (await pg.query<T>(text, values)).rows;
  sql.transaction = transaction ?? ((work) => work(sql));
  return sql;
}

test("manual approval fails closed on Bitrix conflicts and outages; matching exports do not block twice", async () => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.BITRIX_WEBHOOK_URL;
  try {
    for (const path of (await readdir("migrations")).filter((p) => p.endsWith(".sql")).sort())
      await pg.exec(await readFile(`migrations/${path}`, "utf8"));
    const sql = wrap(pg, (work) => pg.transaction((tx) => work(wrap(tx))));
    await sql`insert into "user"(id,name,email,"emailVerified") values('owner','Owner',${process.env.OWNER_EMAIL || site.email},true)`;
    await sql`alter table shop_settings add column if not exists bitrix_calendar_enabled boolean not null default false`;
    await sql`update shop_settings set bitrix_calendar_enabled=true where shop_id='white-gloss'`;
    process.env.BITRIX_WEBHOOK_URL = webhook;
    const [booking] = await sql<{
      id: number;
      version: number;
    }>`insert into bookings(shop_id,customer_name,phone,package_id,class_id,extra_ids,total_cents,pickup_cents,preferred_date,preferred_slot)
      values('white-gloss','Calendar Test','000000000','basis','kompakt','[]',14900,0,'2026-11-02','09:00') returning id,version`;
    const input = {
      startDate: "2026-11-02",
      startTime: "09:00",
      durationMinutes: 180,
      agreedCents: 14900,
    };
    globalThis.fetch = async () => envelope([event]);
    await assert.rejects(
      confirmBookingWithSchedule(sql, booking.id, booking.version, "owner", input),
      /Terminkonflikt/,
    );
    globalThis.fetch = async () => {
      throw new Error("network unavailable");
    };
    await assert.rejects(
      confirmBookingWithSchedule(sql, booking.id, booking.version, "owner", input),
      /vollständig/,
    );
    assert.equal((await sql`select * from booking_time_blocks`).length, 0);
    assert.equal((await sql`select status from bookings where id=${booking.id}`)[0].status, "neu");
    await assert.rejects(
      confirmBookingManually(sql, booking.id, booking.version, "owner"),
      /Preis, Start und Ende/,
    );
    globalThis.fetch = async () => envelope([]);
    const confirmed = await confirmBookingWithSchedule(
      sql,
      booking.id,
      booking.version,
      "owner",
      input,
    );
    assert.equal(confirmed.booking.status, "bestaetigt");
    await sql`update bookings set bitrix_event_id=12 where id=${booking.id}`;
    globalThis.fetch = async () => envelope([{ ...event, to: "2026-11-02T11:00:00Z" }]);
    assert.deepEqual(await bitrixBusyWindows(sql, event.from, event.to, { fresh: true }), []);
    globalThis.fetch = async () => envelope([event]);
    assert.equal((await bitrixBusyWindows(sql, event.from, event.to, { fresh: true })).length, 2);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.BITRIX_WEBHOOK_URL;
    else process.env.BITRIX_WEBHOOK_URL = oldKey;
    await pg.close();
  }
});
