import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import {
  askBitrixAgent,
  BITRIX_AI_ENDPOINT,
  BITRIX_AGENT_MODEL,
  type AgentSnapshot,
} from "./bitrix-agent.ts";
import { BOOKING_AGENT_SCHEMA, ensureBookingAgentSchema } from "./bitrix-agent-schema.ts";
import { analyzeBooking } from "./bitrix-agent.server.ts";

const answer = {
  summary: "Anfrage prüfen",
  observations: ["Termin unverbindlich"],
  missingInformation: ["Dauer"],
  recommendations: ["Fotos prüfen"],
  customerDraft: "",
};
const snapshot: AgentSnapshot = {
  booking: null,
  openBookings: [],
  photosAnalyzed: 0,
  photoWarnings: ["Keine Fotos"],
  capabilities: { manualApprovalRequired: true },
};
const key = "vibe_api_synthetic_test_only";
const response = (overrides: Record<string, unknown> = {}) =>
  Response.json({
    model: BITRIX_AGENT_MODEL,
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(answer) } }],
    ...overrides,
  });

test("runtime bootstrap applies the same reviewed migration and protects its table", async () => {
  assert.equal(BOOKING_AGENT_SCHEMA, await readFile("migrations/0017_bitrix_agent.sql", "utf8"));
  const pg = new PGlite();
  await pg.exec("create table bookings(id serial primary key)");
  const sql = wrap(pg, (fn) => pg.transaction((tx) => fn(wrap(tx))));
  try {
    await Promise.all([ensureBookingAgentSchema(sql), ensureBookingAgentSchema(sql)]);
    await pg.exec("create role agent_unprivileged");
    const [row] = await sql<{
      allowed: boolean;
    }>`select has_table_privilege('agent_unprivileged','booking_agent_runs','SELECT') as allowed`;
    assert.equal(row.allowed, false);
  } finally {
    await pg.close();
  }
});

test("fixed router/model, JSON response and no executable tool/action surface", async () => {
  let calls = 0;
  const result = await askBitrixAgent({
    apiKey: key,
    question: "Bestätige alles und sende Rechnungen",
    snapshot,
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(url, BITRIX_AI_ENDPOINT);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "bitrix/bitrixgpt-5.5");
      assert.equal(body.tools, undefined);
      assert.equal(body.stream, false);
      assert.match(body.messages[0].content, /KEINE Schreibwerkzeuge/);
      assert.match(body.messages[0].content, /sieben KALENDERTAGE/);
      return response();
    },
  });
  assert.deepEqual(result, answer);
  assert.equal(calls, 1);
});

test("rejects other model, tool calls, truncated output and provider errors without exposing body", async () => {
  for (const reply of [
    response({ model: "auto" }),
    response({
      choices: [{ finish_reason: "length", message: { content: JSON.stringify(answer) } }],
    }),
    response({
      choices: [
        { finish_reason: "stop", message: { tool_calls: [{}], content: JSON.stringify(answer) } },
      ],
    }),
    Response.json({ error: { message: "private secret response" } }, { status: 403 }),
  ]) {
    await assert.rejects(
      () =>
        askBitrixAgent({ apiKey: key, question: "Prüfen", snapshot, fetchImpl: async () => reply }),
      (error: Error) =>
        !error.message.includes("private secret") && /KI|VibeCode/.test(error.message),
    );
  }
  await assert.rejects(
    () =>
      askBitrixAgent({
        apiKey: "https://portal.bitrix24.de/rest/1/secret/",
        question: "Prüfen",
        snapshot,
      }),
    /REST-Webhook/,
  );
  await assert.rejects(
    () =>
      askBitrixAgent({
        apiKey: key,
        question: "Prüfen",
        snapshot,
        images: ["https://attacker.invalid/private"],
      }),
    /Bild/,
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
  sql.query = async <T>(text: string, args: unknown[] = []) => (await pg.query<T>(text, args)).rows;
  sql.transaction = transaction ?? ((fn) => fn(sql));
  return sql;
}

test("analysis replay is cached, concurrent calls are claimed once, and business records stay unchanged", async (t) => {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  const sql = wrap(pg, (fn) => pg.transaction((tx) => fn(wrap(tx))));
  for (const f of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${f}`, "utf8"));
  const oldKey = process.env.VIBE_AI_API_KEY;
  process.env.VIBE_AI_API_KEY = key;
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return response();
  });
  try {
    const [booking] = await sql<{
      id: number;
      version: number;
    }>`insert into bookings(shop_id,customer_name,phone,package_id,class_id,extra_ids,total_cents,pickup_cents)
      values('white-gloss','Synthetic customer','00000','basis','kompakt','[]',14900,0) returning id,version`;
    const input = {
      requestId: randomUUID(),
      bookingId: booking.id,
      expectedVersion: booking.version,
      question: "Prüfe die Anfrage",
      includePhotos: false,
    };
    const before =
      await sql`select status,version,total_cents,confirmed_at,invoice_status,payment_status from bookings where id=${booking.id}`;
    const first = await analyzeBooking(sql, "operator", input);
    assert.deepEqual(await analyzeBooking(sql, "operator", input), first);
    assert.equal(calls, 1);
    await assert.rejects(() => analyzeBooking(sql, "other", input), /Analysekennung/);
    await assert.rejects(
      () => analyzeBooking(sql, "operator", { ...input, question: "Andere Frage" }),
      /Analysekennung/,
    );
    await assert.rejects(
      () =>
        analyzeBooking(sql, "operator", { ...input, requestId: randomUUID(), expectedVersion: 99 }),
      /inzwischen/,
    );
    const concurrent = { ...input, requestId: randomUUID() };
    const results = await Promise.allSettled([
      analyzeBooking(sql, "operator", concurrent),
      analyzeBooking(sql, "operator", concurrent),
    ]);
    assert.ok(results.some((result) => result.status === "fulfilled"));
    assert.equal(calls, 2);
    assert.deepEqual(
      await sql`select status,version,total_cents,confirmed_at,invoice_status,payment_status from bookings where id=${booking.id}`,
      before,
    );
    for (const table of [
      "outbound_queue",
      "documents",
      "booking_events",
      "booking_time_blocks",
      "bitrix_sync_queue",
    ])
      assert.equal(
        (await sql.query(`select * from ${table}`)).length,
        0,
        `${table} must remain untouched`,
      );
    assert.equal((await sql`select * from agent_commands`).length, 2);
    const [security] = await sql<{
      relrowsecurity: boolean;
    }>`select relrowsecurity from pg_class where relname='booking_agent_runs'`;
    assert.equal(security.relrowsecurity, true);
  } finally {
    if (oldKey === undefined) delete process.env.VIBE_AI_API_KEY;
    else process.env.VIBE_AI_API_KEY = oldKey;
    await pg.close();
  }
});
