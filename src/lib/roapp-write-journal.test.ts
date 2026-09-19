import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { journalRoappWrites } from "./roapp-write-journal.ts";
import { RoappError, type RoappRequest } from "./roapp.ts";

test("journal replays completed items, stops ambiguous writes and permits rejected writes", async () => {
  const db = new PGlite();
  const sql = (async (parts: TemplateStringsArray, ...values: unknown[]) =>
    (
      await db.query(
        parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
        values,
      )
    ).rows) as Sql;
  await db.exec(
    "create table roapp_write_journal (booking_id int, operation text, state text, response jsonb, primary key(booking_id,operation))",
  );
  let count = 0;
  const transport: RoappRequest = async <T>() => {
    count++;
    return { id: count } as T;
  };
  try {
    const request = journalRoappWrites(sql, 1, transport);
    assert.deepEqual(await request("POST", "/orders/1/items", { entity_id: 1 }), { id: 1 });
    assert.deepEqual(await request("POST", "/orders/1/items", { entity_id: 1 }), { id: 1 });
    await request("POST", "/orders/1/items", { entity_id: 2 });
    assert.equal(count, 2);
    const lost = journalRoappWrites(sql, 2, async () => {
      count++;
      throw new Error("response lost");
    });
    await assert.rejects(lost("POST", "/orders", {}), RoappError);
    await assert.rejects(lost("POST", "/orders", {}), RoappError);
    assert.equal(count, 3);
    const limited = journalRoappWrites(sql, 3, async () => {
      throw new RoappError("roapp_rate_limited", { status: 429 });
    });
    await assert.rejects(limited("POST", "/orders", {}), RoappError);
    await journalRoappWrites(sql, 3, transport)("POST", "/orders", {});
    assert.equal(count, 4);
  } finally {
    await db.close();
  }
});
