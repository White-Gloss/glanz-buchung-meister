import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { saveBookingRequest } from "./booking-workflow.ts";
import { createRequestUploadCapability } from "./booking-upload-capability.ts";
import { site } from "../data/site.ts";
import {
  applyBridgeAction,
  createBitrixBridgeHandler,
  verifyBridgeSignature,
} from "./bitrix-workshop-bridge.ts";
import { calendarInterval } from "./bitrix-workshop-calendar.ts";
import { BITRIX_WORKSHOP_SCHEMA, ensureBitrixWorkshopSchema } from "./bitrix-workshop-schema.ts";

test("existing production schema can initialize the private bridge without a release outage", async () => {
  assert.equal(
    BITRIX_WORKSHOP_SCHEMA,
    (await readFile("migrations/0018_bitrix_workshop_bridge.sql", "utf8")).replace(/\r\n/g, "\n"),
  );
  const pg = new PGlite();
  try {
    for (const file of (await readdir("migrations"))
      .filter((f) => f.endsWith(".sql") && !f.startsWith("0018"))
      .sort())
      await pg.exec(await readFile(`migrations/${file}`, "utf8"));
    const sql = wrap(pg, (fn) => pg.transaction((tx) => fn(wrap(tx))));
    await ensureBitrixWorkshopSchema(sql);
    assert.equal(
      (
        await sql<{
          relrowsecurity: boolean;
        }>`select relrowsecurity from pg_class where relname='bitrix_bridge_requests'`
      )[0].relrowsecurity,
      true,
    );
    assert.equal((await sql`select * from bookings where bitrix_workshop_managed`).length, 0);
  } finally {
    await pg.close();
  }
});

test("all-day Bitrix blocks include the final day and respect the Berlin DST boundary", () => {
  assert.deepEqual(
    calendarInterval({ from: "2026-10-25T00:00:00Z", to: "2026-10-25T00:00:00Z", skipTime: true }),
    { start: "2026-10-24T22:00:00.000Z", end: "2026-10-25T23:00:00.000Z", resourceId: 1 },
  );
  assert.throws(() => calendarInterval({ from: "invalid", to: "invalid" }));
});

function wrap(pg: Pick<PGlite, "query">, transaction?: Sql["transaction"]): Sql {
  const sql = (async (strings: TemplateStringsArray, ...args: unknown[]) =>
    (
      await pg.query(
        strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""),
        args,
      )
    ).rows) as Sql;
  sql.query = async <T>(text: string, args: unknown[] = []) => (await pg.query<T>(text, args)).rows;
  sql.transaction = transaction ?? ((fn) => fn(sql));
  return sql;
}
async function fixture() {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  const sql = wrap(pg, (fn) => pg.transaction((tx) => fn(wrap(tx))));
  await sql`insert into "user"(id,name,email,"emailVerified") values('owner','Owner',${process.env.OWNER_EMAIL || site.email},true)`;
  const input = {
    idempotencyKey: randomUUID(),
    name: "Workflow Test",
    phone: "+490000123456",
    email: "qa@example.invalid",
    date: "2026-11-02",
    slot: "09:00",
    note: "",
    packageId: "basis" as const,
    classId: "kompakt" as const,
    extraIds: [],
    citySlug: "",
    kind: "booking" as const,
    privacy: true as const,
  };
  const { booking } = await saveBookingRequest(
    sql,
    input,
    createRequestUploadCapability(input.idempotencyKey),
  );
  await sql`update bitrix_sync_queue set bitrix_deal_id=412 where booking_id=${booking.id}`;
  const request = {
    requestId: "confirmation-test-1",
    userId: 1 as const,
    action: "confirm" as const,
    dealId: 412,
    version: booking.version,
    from: "2026-11-02T08:00:00Z",
    to: "2026-11-03T14:00:00Z",
    amountCents: 14900,
    rows: [{ productName: "Basis", price: 149, quantity: 1, taxRate: 19, taxIncluded: true }],
    customerAccepted: true,
  };
  return { pg, sql, booking, request };
}

test("only a fresh signature from the existing app reaches the database", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const body = '{"userId":1}',
    timestamp = String(Date.now());
  const signature = sign(null, Buffer.from(`${timestamp}\n${body}`), privateKey).toString("base64");
  assert.equal(verifyBridgeSignature(body, timestamp, signature, pem), true);
  assert.equal(verifyBridgeSignature(body + " ", timestamp, signature, pem), false);
  assert.equal(verifyBridgeSignature(body, timestamp, signature, pem, Date.now() + 180000), false);
  const handle = createBitrixBridgeHandler({
    publicKey: pem,
    getSql: async () => {
      throw new Error("must not access DB");
    },
    kick: () => {},
  });
  assert.equal(
    (await handle(new Request("https://example.invalid", { method: "POST", body }))).status,
    401,
  );
});

test("owner confirmation atomically reserves the whole interval and queues one branded PDF", async () => {
  const { pg, sql, booking, request } = await fixture();
  try {
    const result = await applyBridgeAction(sql, request);
    assert.deepEqual(await applyBridgeAction(sql, request), result);
    const blocks = await sql`select * from booking_time_blocks where booking_id=${booking.id}`;
    assert.equal(blocks.length, 1);
    const emails = await sql<{
      attachments: { content: string }[];
    }>`select attachments from outbound_queue where event_key like 'bitrix:confirmation:%'`;
    assert.equal(emails.length, 1);
    assert.equal(
      Buffer.from(emails[0].attachments[0].content, "base64").subarray(0, 5).toString(),
      "%PDF-",
    );
    assert.equal(
      (
        await sql`select * from zoho_job_queue where booking_id=${booking.id} and job in ('confirmation','invoice')`
      ).length,
      0,
    );
    await assert.rejects(
      applyBridgeAction(sql, { ...request, amountCents: 99900 }),
      /bereits mit anderen/,
    );
    const current = (
      await sql<{ version: number }>`select version from bookings where id=${booking.id}`
    )[0];
    await applyBridgeAction(sql, {
      ...request,
      action: "cancel",
      requestId: "cancel-test-1",
      version: current.version,
    });
    assert.equal(
      (await sql`select * from booking_time_blocks where booking_id=${booking.id}`).length,
      0,
    );
  } finally {
    await pg.close();
  }
});

test("changed offer without customer acceptance remains an inquiry without PDF or reservation", async () => {
  const { pg, sql, request } = await fixture();
  try {
    await applyBridgeAction(sql, {
      ...request,
      from: "2026-11-04T08:00:00Z",
      to: "2026-11-04T14:00:00Z",
      customerAccepted: false,
    });
    assert.equal((await sql`select * from booking_time_blocks`).length, 0);
    assert.equal(
      (await sql`select * from outbound_queue where event_key like 'bitrix:confirmation:%'`).length,
      0,
    );
    assert.equal(
      (await sql<{ ops_stage: string }>`select ops_stage from bookings`)[0].ops_stage,
      "kundenrueckmeldung",
    );
  } finally {
    await pg.close();
  }
});

test("completion and the separate invoice email remain idempotent; cash is tied to that invoice", async () => {
  const { pg, sql, request } = await fixture();
  try {
    const confirmed = await applyBridgeAction(sql, request);
    const complete = {
      ...request,
      action: "complete" as const,
      requestId: "complete-test-1",
      version: Number(confirmed.version),
      payment: "bar" as const,
      receivedCents: 14900,
      receivedOn: "2026-11-03",
    };
    const done = await applyBridgeAction(sql, complete);
    await applyBridgeAction(sql, complete);
    const invoice = {
      ...request,
      action: "invoice" as const,
      requestId: "invoice-test-1",
      version: Number(done.version),
      invoiceId: 123,
      invoiceNumber: "WG-123",
      pdf: Buffer.from("%PDF-test").toString("base64"),
      paid: true,
    };
    await applyBridgeAction(sql, invoice);
    await applyBridgeAction(sql, invoice);
    assert.equal(
      (await sql`select * from outbound_queue where event_type='bitrix.invoice'`).length,
      1,
    );
    const [row] =
      await sql`select bitrix_invoice_id,payment_status,payment_recorded_cents from bookings`;
    assert.equal(row.bitrix_invoice_id, 123);
    assert.equal(row.payment_status, "bezahlt");
    assert.equal(row.payment_recorded_cents, 14900);
    assert.equal((await sql`select * from zoho_job_queue where job='invoice'`).length, 0);
  } finally {
    await pg.close();
  }
});

test("the confirmed PDF remains readable after completion without creating another email", async () => {
  const { pg, sql, request } = await fixture();
  try {
    const confirmed = await applyBridgeAction(sql, request);
    const read = { ...request, action: "confirmation" as const, requestId: "read-confirmation-1" };
    const before = await applyBridgeAction(sql, read);
    await applyBridgeAction(sql, {
      ...request,
      action: "complete",
      requestId: "complete-for-pdf-1",
      version: Number(confirmed.version),
      payment: "ueberweisung",
    });
    const after = await applyBridgeAction(sql, { ...read, requestId: "read-confirmation-2" });
    assert.ok("pdf" in before && typeof before.pdf === "string");
    assert.ok("pdf" in after);
    assert.equal(after.pdf, before.pdf);
    assert.equal(
      (await sql`select * from outbound_queue where event_key like 'bitrix:confirmation:%'`).length,
      1,
    );
  } finally {
    await pg.close();
  }
});
