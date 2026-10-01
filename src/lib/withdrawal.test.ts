import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { isApprovedCustomerNotification, isOwnerNotification } from "./billing-policy.ts";
import { runNotificationWorker } from "./notification-worker.ts";
import {
  formatReceivedAt,
  queueWithdrawal,
  withdrawalDeclaration,
  withdrawalReference,
  withdrawalSchema,
  type WithdrawalInput,
} from "./withdrawal.ts";

function wrap(pg: Pick<PGlite, "query">, transaction?: Sql["transaction"]): Sql {
  const sql = (async (strings: TemplateStringsArray, ...args: unknown[]) => {
    const text = strings.reduce(
      (value, part, index) => value + (index ? `$${index}` : "") + part,
      "",
    );
    return (await pg.query(text, args)).rows;
  }) as Sql;
  sql.query = async <T>(text: string, args: unknown[] = []) => (await pg.query<T>(text, args)).rows;
  sql.transaction = transaction ?? ((work) => work(sql));
  return sql;
}

const input: WithdrawalInput = {
  requestId: "6f1c1a3e-6d1f-4a55-9a37-4f1d2c3b4a5e",
  name: "Erika Mustermann",
  contract: "Vorgang WG-123, Keramikschutz, angenommen am 2. Oktober 2026",
  scope: "gesamt",
  email: "erika@example.invalid",
};

test("schema requires name, contract and a confirmation address but no reason", () => {
  assert.equal(withdrawalSchema.safeParse(input).success, true);
  assert.equal(withdrawalSchema.safeParse({ ...input, name: "" }).success, false);
  assert.equal(withdrawalSchema.safeParse({ ...input, contract: "" }).success, false);
  assert.equal(withdrawalSchema.safeParse({ ...input, email: "keine-adresse" }).success, false);
  assert.equal(withdrawalSchema.safeParse({ ...input, scope: "teil" }).success, false);
  assert.equal(
    withdrawalSchema.safeParse({ ...input, scope: "teil", part: "Lederpflege" }).success,
    true,
  );
});

test("receipt states content, date and time of receipt in German time", () => {
  assert.equal(formatReceivedAt(new Date("2026-10-01T12:03:04Z")), "01.10.2026 um 14:03:04 MESZ");
  assert.equal(formatReceivedAt(new Date("2026-12-01T12:03:04Z")), "01.12.2026 um 13:03:04 MEZ");
  assert.match(withdrawalReference(input.requestId), /^WR-[0-9A-F]{10}$/);
  assert.equal(
    withdrawalDeclaration({ ...input, scope: "teil", part: "Lederpflege" })[0],
    "Hiermit widerrufe ich folgenden Teil des Vertrags: Lederpflege.",
  );
});

test("only the customer receipt passes the customer mail policy", () => {
  const reference = withdrawalReference(input.requestId);
  assert.equal(
    isApprovedCustomerNotification(`withdrawal:${reference}:customer:email`, "withdrawal.received"),
    true,
  );
  assert.equal(
    isApprovedCustomerNotification(`withdrawal:${reference}:owner:email`, "withdrawal.received"),
    false,
  );
  assert.equal(
    isApprovedCustomerNotification("withdrawal:WR-x:customer:email", "withdrawal.received"),
    false,
  );
  assert.equal(isOwnerNotification(`withdrawal:${reference}:owner:email`, "withdrawal.owner"), true);
});

test("withdrawal is stored durably, idempotent and delivered as receipt", async (t) => {
  const environment = {
    OWNER_EMAIL: "owner@example.invalid",
    OWNER_WHATSAPP: "",
    ADMIN_WHATSAPP_NUMBER: "",
    MAIL_FROM: "White Gloss Detailing <info@example.invalid>",
    RESEND_API_KEY: "test-key",
  };
  const previous = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, environment);
  const pg = new PGlite({ parsers: { 1082: (value) => value, 20: Number } });
  try {
    for (const file of (await readdir("migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      await pg.exec(await readFile(`migrations/${file}`, "utf8"));
    }
    const sql = wrap(pg, (work) => pg.transaction((tx) => work(wrap(tx))));
    const fetchMock = t.mock.method(globalThis, "fetch", async () => {
      throw new Error("Queueing a withdrawal must never call the network");
    });

    const receivedAt = new Date("2026-10-01T12:03:04Z");
    const first = await queueWithdrawal(sql, input, receivedAt);
    assert.equal(first.duplicate, false);
    assert.equal(first.receivedAtLabel, "01.10.2026 um 14:03:04 MESZ");

    // A retry with the same ID but edited fields returns the stored declaration, not the edit.
    const again = await queueWithdrawal(
      sql,
      { ...input, name: "Geändert", email: "anders@example.invalid" },
      new Date("2026-10-01T12:09:00Z"),
    );
    assert.equal(again.duplicate, true);
    assert.equal(again.reference, first.reference);
    assert.equal(again.receivedAtLabel, first.receivedAtLabel);
    assert.deepEqual(again.declaration, first.declaration);
    assert.equal(again.email, "erika@example.invalid");
    assert.ok(again.declaration.includes("Name: Erika Mustermann"));

    const rows = await sql<{
      event_key: string;
      event_type: string;
      to_addr: string;
      subject: string;
      body: string;
    }>`select event_key, event_type, to_addr, subject, body from outbound_queue
      where event_key like 'withdrawal:%' order by id`;
    assert.equal(rows.length, 2);
    const customer = rows.find((row) => row.event_key.includes(":customer:"));
    const owner = rows.find((row) => row.event_key.includes(":owner:"));
    assert.ok(customer && owner);
    assert.equal(customer.to_addr, "erika@example.invalid");
    assert.equal(owner.to_addr, "owner@example.invalid");
    assert.match(customer.subject, /Eingangsbestätigung Ihres Widerrufs WR-/);
    assert.match(customer.body, /Eingang der Widerrufserklärung: 01\.10\.2026 um 14:03:04 MESZ/);
    assert.match(customer.body, /Hiermit widerrufe ich den gesamten Vertrag\./);
    assert.match(customer.body, /Vertrag: Vorgang WG-123/);
    assert.match(customer.body, /Lars Marco Hägele/);
    assert.match(owner.body, /Erika Mustermann/);
    const events = await sql`select * from automation_events where area = 'widerruf'`;
    assert.equal(events.length, 1);
    assert.equal(fetchMock.mock.callCount(), 0);

    const sent: { to: string; subject: string; from?: string }[] = [];
    await runNotificationWorker(sql, {
      sendEmail: async (message) => {
        sent.push({ to: message.to, subject: message.subject, from: message.from });
        return { id: `mail-${sent.length}` };
      },
    });
    assert.deepEqual(
      sent.map((message) => message.to).sort(),
      ["erika@example.invalid", "owner@example.invalid"],
    );
    assert.ok(sent.every((message) => message.from === environment.MAIL_FROM));
    const statuses = await sql<{ status: string }>`
      select status from outbound_queue where event_key like 'withdrawal:%'`;
    assert.ok(statuses.every((row) => row.status === "sent"));
  } finally {
    await pg.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
