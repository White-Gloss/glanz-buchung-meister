import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { ensureBitrixSchema } from "./bitrix-sync.ts";
import { bitrixCutoverReadiness } from "./bitrix-readiness.ts";
import { ensureBitrixCalendarSchema } from "./bitrix-calendar.ts";

function wrap(pg: Pick<PGlite, "query">): Sql {
  const sql = (async (strings: TemplateStringsArray, ...args: unknown[]) =>
    (
      await pg.query(
        strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""),
        args,
      )
    ).rows) as Sql;
  sql.query = async <T>(text: string, args: unknown[] = []) => (await pg.query<T>(text, args)).rows;
  sql.transaction = (fn) => fn(sql);
  return sql;
}

async function database({ bitrixSchema = true } = {}) {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  for (const f of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${f}`, "utf8"));
  const sql = wrap(pg);
  if (bitrixSchema) {
    await ensureBitrixSchema(sql);
    await ensureBitrixCalendarSchema(sql);
  }
  return { pg, sql };
}

const status = (checks: { id: string; status: string }[]) =>
  Object.fromEntries(checks.map((check) => [check.id, check.status]));

const ready = {
  BOOKING_OPERATIONS: "bitrix",
  OWNER_EMAIL: "owner@example.invalid",
  RESEND_API_KEY: "re_test",
  MAIL_FROM: "White Gloss <buchung@example.invalid>",
};

async function readyDatabase() {
  const db = await database();
  await db.sql`insert into "user"(id,name,email,"emailVerified") values('owner','Owner','owner@example.invalid',true)`;
  await db.sql`update shop_settings set bitrix_calendar_enabled=true where shop_id='white-gloss'`;
  return db;
}

test("readiness reports missing prerequisites without calling Bitrix", async () => {
  const { pg, sql } = await database();
  try {
    let calls = 0;
    const checks = await bitrixCutoverReadiness(sql, {
      env: { BOOKING_OPERATIONS: "roapp", OWNER_EMAIL: "owner@example.invalid" },
      apiKey: "",
      probe: async () => {
        calls++;
        return { ok: true };
      },
      calendarProbe: async () => {
        calls++;
      },
    });
    assert.equal(calls, 0);
    assert.deepEqual(status(checks), {
      mode: "fail",
      access: "fail",
      calendar: "fail",
      owner: "fail",
      mail: "fail",
      queue: "ok",
      open: "ok",
    });
  } finally {
    await pg.close();
  }
});

test("readiness is green except for the unverified mail delivery", async () => {
  const { pg, sql } = await readyDatabase();
  try {
    let calendarKey = "";
    const checks = await bitrixCutoverReadiness(sql, {
      env: ready,
      apiKey: "vibe_api_test_key_long_enough",
      probe: async () => ({ ok: true }),
      calendarProbe: async (key) => {
        calendarKey = key;
      },
    });
    assert.equal(calendarKey, "vibe_api_test_key_long_enough");
    const { mail, ...rest } = status(checks);
    assert.equal(mail, "warn");
    assert.ok(
      Object.values(rest).every((value) => value === "ok"),
      JSON.stringify(checks),
    );
  } finally {
    await pg.close();
  }
});

test("an enabled calendar that the current key cannot read fails the check", async () => {
  const { pg, sql } = await readyDatabase();
  try {
    const checks = await bitrixCutoverReadiness(sql, {
      env: ready,
      apiKey: "https://example.bitrix24.de/rest/1/abc/",
      probe: async () => ({ ok: true }),
      calendarProbe: async () => {
        throw new Error("Kalenderrecht fehlt.");
      },
    });
    const calendar = checks.find((check) => check.id === "calendar")!;
    assert.equal(calendar.status, "fail");
    assert.match(calendar.detail, /Kalenderrecht fehlt/);
  } finally {
    await pg.close();
  }
});

test("retrying transfers, a rejected key and open bookings without a deal are reported", async () => {
  const { pg, sql } = await database();
  try {
    const [booking] = await sql<{
      id: number;
    }>`insert into bookings(shop_id,customer_name,phone,package_id,class_id,extra_ids,total_cents,status)
      values('white-gloss','Kunde','+490000','basis','kompakt','[]',14900,'neu') returning id`;
    await sql`insert into bitrix_sync_queue(booking_id,shop_id,requested_version,status,last_error,bitrix_deal_id)
      values(${booking.id},'white-gloss',1,'pending','bitrix_photos_pending',77)`;
    await sql`insert into bookings(shop_id,customer_name,phone,package_id,class_id,extra_ids,total_cents,status)
      values('white-gloss','Kunde 2','+490001','basis','kompakt','[]',14900,'neu')`;
    const checks = await bitrixCutoverReadiness(sql, {
      env: {},
      apiKey: "vibe_api_test_key_long_enough",
      probe: async () => ({ ok: false, error: "Zugang verweigert." }),
      calendarProbe: async () => {},
    });
    const byId = Object.fromEntries(checks.map((check) => [check.id, check]));
    assert.equal(byId.access.status, "fail");
    assert.equal(byId.access.detail, "Zugang verweigert.");
    assert.equal(byId.queue.status, "fail");
    assert.match(byId.queue.detail, /1 mit Fehler in Wiederholung/);
    assert.equal(byId.open.status, "fail");
    assert.match(byId.open.detail, /^2 offene Buchung/);
  } finally {
    await pg.close();
  }
});

test("the check changes neither schema nor data", async () => {
  const { pg, sql } = await database({ bitrixSchema: false });
  try {
    const snapshot = async () =>
      JSON.stringify(
        await sql`select table_name,column_name from information_schema.columns
          where table_schema=current_schema() order by table_name,column_name`,
      ) + JSON.stringify(await sql`select * from shop_settings order by shop_id`);
    const before = await snapshot();
    const checks = await bitrixCutoverReadiness(sql, {
      env: ready,
      apiKey: "vibe_api_test_key_long_enough",
      probe: async () => ({ ok: true }),
      calendarProbe: async () => {},
    });
    assert.equal(await snapshot(), before);
    assert.equal(status(checks).calendar, "fail");
  } finally {
    await pg.close();
  }
});
