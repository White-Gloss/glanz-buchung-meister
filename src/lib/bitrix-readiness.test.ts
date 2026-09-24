import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { ensureBitrixSchema } from "./bitrix-sync.ts";
import { bitrixCutoverReadiness } from "./bitrix-readiness.ts";
import { bitrixCalendarEnabled } from "./bitrix-calendar.ts";

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

async function database() {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  for (const f of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${f}`, "utf8"));
  const sql = wrap(pg);
  await ensureBitrixSchema(sql);
  return { pg, sql };
}

const status = (checks: { id: string; status: string }[]) =>
  Object.fromEntries(checks.map((check) => [check.id, check.status]));

test("readiness reports missing prerequisites without calling Bitrix", async () => {
  const { pg, sql } = await database();
  try {
    let probed = 0;
    const checks = await bitrixCutoverReadiness(sql, {
      env: { BOOKING_OPERATIONS: "roapp", OWNER_EMAIL: "owner@example.invalid" },
      apiKey: "",
      probe: async () => {
        probed++;
        return { ok: true };
      },
    });
    assert.equal(probed, 0);
    assert.deepEqual(status(checks), {
      mode: "warn",
      access: "fail",
      calendar: "warn",
      owner: "fail",
      mail: "fail",
      queue: "ok",
      open: "ok",
    });
  } finally {
    await pg.close();
  }
});

test("readiness passes when access, owner, mail and queues are in order", async () => {
  const { pg, sql } = await database();
  try {
    await sql`insert into "user"(id,name,email,"emailVerified") values('owner','Owner','owner@example.invalid',true)`;
    await bitrixCalendarEnabled(sql);
    await sql`update shop_settings set bitrix_calendar_enabled=true where shop_id='white-gloss'`;
    const checks = await bitrixCutoverReadiness(sql, {
      env: {
        BOOKING_OPERATIONS: "bitrix",
        OWNER_EMAIL: "owner@example.invalid",
        RESEND_API_KEY: "re_test",
        MAIL_FROM: "White Gloss <buchung@example.invalid>",
      },
      apiKey: "vibe_api_test_key_long_enough",
      probe: async () => ({ ok: true }),
    });
    assert.ok(
      checks.every((check) => check.status === "ok"),
      JSON.stringify(checks),
    );
  } finally {
    await pg.close();
  }
});

test("a rejected key and open bookings without a Bitrix deal are reported", async () => {
  const { pg, sql } = await database();
  try {
    await sql`insert into bookings(shop_id,customer_name,phone,package_id,class_id,extra_ids,total_cents,status)
      values('white-gloss','Kunde','+490000','basis','kompakt','[]',14900,'neu')`;
    const checks = await bitrixCutoverReadiness(sql, {
      env: {},
      apiKey: "vibe_api_test_key_long_enough",
      probe: async () => ({ ok: false, error: "Zugang verweigert." }),
    });
    const byId = Object.fromEntries(checks.map((check) => [check.id, check]));
    assert.equal(byId.access.status, "fail");
    assert.equal(byId.access.detail, "Zugang verweigert.");
    assert.equal(byId.open.status, "warn");
    assert.match(byId.open.detail, /^1 offene Buchung/);
  } finally {
    await pg.close();
  }
});
