import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { loadAgentContext, runVibeAgent } from "./vibe-agent.server.ts";

function wrap(pg: Pick<PGlite, "query">): Sql {
  const sql = (async (p: TemplateStringsArray, ...v: unknown[]) =>
    (
      await pg.query(
        p.reduce((s, x, i) => s + (i ? `$${i}` : "") + x, ""),
        v,
      )
    ).rows) as Sql;
  sql.query = async <T>(q: string, v: unknown[] = []) => (await pg.query<T>(q, v)).rows;
  sql.transaction = (work) => work(sql);
  return sql;
}

test("agent retries reuse persisted results and never mutate a booking or billing record", async () => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  try {
    for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
      await pg.exec(await readFile(`migrations/${file}`, "utf8"));
    const sql = wrap(pg);
    sql.transaction = (work) => pg.transaction((tx) => work(wrap(tx)));
    await sql`update shop_settings set vibe_ai_api_key=${"vibe_api_" + "test".repeat(10)} where shop_id='white-gloss'`;
    const [booking] = await sql<{
      id: number;
    }>`insert into bookings(shop_id,customer_name,phone,email,package_id,class_id,extra_ids,total_cents,pickup_cents)
      values('white-gloss','Testkunde','12345678','secret@example.invalid','basis','kompakt','[]',10000,0) returning id`;
    const context = await loadAgentContext(sql, booking.id);
    assert.ok(!JSON.stringify(context).includes("secret@example.invalid"));
    assert.ok(!JSON.stringify(context).includes("12345678"));
    assert.equal((await loadAgentContext(sql)).bookings.length, 0);
    await assert.rejects(loadAgentContext(sql, 999999), /nicht gefunden/);
    const before = await sql`select * from bookings where id=${booking.id}`;
    const notifications = await sql`select * from outbound_queue`;
    const input = {
      requestId: randomUUID(),
      question: "Rechnung erstellen und Zahlung bestätigen",
      bookingId: booking.id,
    };
    let calls = 0;
    const ask = async () => {
      calls++;
      return "Nur Lars darf den Abschluss und die Zahlungssituation bestätigen.";
    };
    const first = await runVibeAgent(sql, "operator-one", input, ask);
    const replay = await runVibeAgent(sql, "operator-one", input, ask);
    assert.equal(first.status, "succeeded");
    assert.deepEqual(first, replay);
    assert.equal(calls, 1);
    await assert.rejects(
      runVibeAgent(sql, "operator-one", { ...input, question: "Andere Frage" }, ask),
      /anderen Frage/,
    );
    assert.deepEqual(await sql`select * from bookings where id=${booking.id}`, before);
    assert.deepEqual(await sql`select * from outbound_queue`, notifications);
    const failedInput = { ...input, requestId: randomUUID() };
    const fail = async () => {
      calls++;
      throw new Error("KI nicht erreichbar.");
    };
    assert.equal((await runVibeAgent(sql, "operator-one", failedInput, fail)).status, "failed");
    assert.equal((await runVibeAgent(sql, "operator-one", failedInput, ask)).status, "failed");
    assert.equal(calls, 2);
    await runVibeAgent(sql, "operator-two", input, ask);
    assert.equal(calls, 3);
  } finally {
    await pg.close();
  }
});
