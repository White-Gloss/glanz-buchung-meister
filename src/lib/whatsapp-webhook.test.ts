import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import {
  applyWhatsAppStatuses,
  createWhatsAppWebhookHandler,
  parseWhatsAppStatuses,
  readWhatsAppWebhookConfiguration,
  verifyWhatsAppSignature,
} from "./whatsapp-webhook.ts";

const env = {
  WHATSAPP_PROVIDER: "meta",
  WHATSAPP_APP_SECRET: "test-only-secret",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: "test-only-verification",
  WHATSAPP_PHONE_NUMBER_ID: "123456789",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "987654321",
  ADMIN_WHATSAPP_NUMBER: "+491234567890",
};
const config = readWhatsAppWebhookConfiguration(env)!;
const fixture = (status = "sent", timestamp = "1788688800", messageId = "wamid.test") => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: config.businessAccountId,
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: config.phoneNumberId },
            statuses: [
              {
                id: messageId,
                status,
                recipient_id: config.ownerNumber,
                timestamp,
                biz_opaque_callback_data: "booking:42:created:owner",
              },
            ],
          },
        },
      ],
    },
  ],
});
const signature = (body: string) =>
  `sha256=${createHmac("sha256", config.appSecret).update(body).digest("hex")}`;
const post = (body = JSON.stringify(fixture()), sig = signature(body)) =>
  new Request("https://example.invalid/api/whatsapp-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": sig },
    body,
  });

describe("WhatsApp webhook authentication and parsing", () => {
  it("uses separate verification and app secrets and verifies the exact body bytes", () => {
    const raw = JSON.stringify(fixture());
    assert.equal(verifyWhatsAppSignature(Buffer.from(raw), signature(raw), config.appSecret), true);
    assert.equal(
      verifyWhatsAppSignature(Buffer.from(raw + " "), signature(raw), config.appSecret),
      false,
    );
    assert.equal(
      verifyWhatsAppSignature(Buffer.from(raw), signature(raw), config.verifyToken),
      false,
    );
    for (const value of [null, "", "sha1=abc", "sha256=00", `sha256=${"z".repeat(64)}`])
      assert.equal(verifyWhatsAppSignature(Buffer.from(raw), value, config.appSecret), false);
  });

  it("answers the GET challenge only for a matching configured token", async () => {
    const handle = createWhatsAppWebhookHandler({
      env,
      getSql: async () => {
        throw new Error("must not access DB");
      },
    });
    const url = `https://example.invalid/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${config.verifyToken}&hub.challenge=challenge-123`;
    const response = await handle(new Request(url));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "challenge-123");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await handle(new Request(url.replace(config.verifyToken, "wrong")))).status, 403);
    assert.equal((await handle(new Request(url.replace("subscribe", "other")))).status, 403);
    assert.equal(
      (
        await createWhatsAppWebhookHandler({
          env: {},
          getSql: async () => {
            throw new Error();
          },
        })(new Request(url))
      ).status,
      503,
    );
  });

  it("rejects unsigned, altered, oversized and malformed requests before database access", async () => {
    let calls = 0;
    const handle = createWhatsAppWebhookHandler({
      env,
      getSql: async () => {
        calls++;
        throw new Error("not expected");
      },
    });
    assert.equal((await handle(post(undefined, ""))).status, 403);
    assert.equal((await handle(post("{}", signature("{ }")))).status, 403);
    assert.equal((await handle(post("not json"))).status, 400);
    assert.equal((await handle(post("x".repeat(1024 * 1024 + 1)))).status, 413);
    assert.equal(calls, 0);
  });

  it("acknowledges unrelated accounts, numbers, recipients, messages and future status fields without action", async () => {
    const account = fixture();
    account.entry[0].id = "111";
    const phone = fixture();
    phone.entry[0].changes[0].value.metadata.phone_number_id = "222";
    const owner = fixture();
    owner.entry[0].changes[0].value.statuses[0].recipient_id = "491234567899";
    const incoming = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: config.businessAccountId,
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: config.phoneNumberId },
                messages: [{ text: { body: "confirm WG-42" } }],
              },
            },
          ],
        },
      ],
    };
    let calls = 0;
    const handle = createWhatsAppWebhookHandler({
      env,
      getSql: async () => {
        calls++;
        throw new Error("not expected");
      },
    });
    for (const payload of [account, phone, owner, incoming, fixture("future_status")]) {
      assert.deepEqual(parseWhatsAppStatuses(payload, config), []);
      assert.equal((await handle(post(JSON.stringify(payload)))).status, 200);
    }
    assert.equal(calls, 0);
  });

  it("hashes semantic receipt identity independently of JSON property order and discards private error text", () => {
    const payload = fixture("failed");
    const raw = payload.entry[0].changes[0].value.statuses[0];
    Object.assign(raw, { errors: [{ code: 131026, message: "private provider details" }] });
    const [event] = parseWhatsAppStatuses(payload, config);
    assert.match(event.eventHash, /^[a-f0-9]{64}$/);
    assert.equal(event.errorCode, "meta_131026");
    assert.ok(!JSON.stringify(event).includes("private"));
    const reordered = {
      ...payload,
      entry: payload.entry.map((entry) => ({ changes: entry.changes, id: entry.id })),
    };
    assert.equal(parseWhatsAppStatuses(reordered, config)[0].eventHash, event.eventHash);
    assert.notEqual(
      parseWhatsAppStatuses(fixture("delivered"), config)[0].eventHash,
      event.eventHash,
    );
  });

  it("returns 503 after storage failure, logs a safe code and never acknowledges lost persistence", async () => {
    const errors: string[] = [];
    const handle = createWhatsAppWebhookHandler({
      env,
      getSql: async () => {
        throw new Error("secret connection string");
      },
      onError: (code) => errors.push(code),
    });
    const response = await handle(post());
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("secret"));
    assert.deepEqual(errors, ["whatsapp_receipt_storage_failed"]);
  });
});

async function database() {
  const pg = new PGlite();
  for (const migration of [
    "0003_ops.sql",
    "0004_settings.sql",
    "0008_notification_delivery.sql",
    "0009_whatsapp_receipts.sql",
  ]) {
    await pg.exec(readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
  }
  const adapter = (
    query: (statement: string, values?: unknown[]) => Promise<{ rows: unknown[] }>,
  ) => {
    const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      let statement = strings[0];
      values.forEach((_, index) => {
        statement += `$${index + 1}${strings[index + 1]}`;
      });
      return (await query(statement, values)).rows;
    }) as Sql;
    sql.query = async (statement, values) => (await query(statement, values)).rows as never[];
    sql.transaction = (work) => work(sql);
    return sql;
  };
  const sql = adapter((statement, values) => pg.query(statement, values));
  sql.transaction = (work) =>
    pg.transaction((tx) => work(adapter((statement, values) => tx.query(statement, values))));
  await pg.query(
    `insert into outbound_queue (shop_id, channel, to_addr, body, event_key, status) values ($1,'whatsapp',$2,'summary','booking:42:created:owner','processing')`,
    ["white-gloss", env.ADMIN_WHATSAPP_NUMBER],
  );
  return { pg, sql };
}

describe("durable WhatsApp delivery receipts", () => {
  it("persists one owner alert with a failed receipt, and retries all writes if alert persistence fails", async () => {
    const { pg, sql } = await database();
    try {
      const statuses = parseWhatsAppStatuses(fixture("failed"), config);
      const alert = async (tx: Sql, row: { id: number }, code: string) => {
        await tx`insert into outbound_queue (shop_id, channel, to_addr, body, event_key, status)
          values ('white-gloss', 'email', 'owner@example.invalid', ${code}, ${`notification:${row.id}:attention`}, 'queued')
          on conflict (shop_id, event_key) do nothing`;
      };
      const handle = createWhatsAppWebhookHandler({
        env,
        getSql: async () => sql,
        onDeliveryFailed: async (tx, row, code) => {
          await alert(tx, row, code);
          throw new Error("simulated alert failure");
        },
      });
      assert.equal((await handle(post(JSON.stringify(fixture("failed"))))).status, 503);
      assert.equal(
        (
          await pg.query<{ count: number }>(
            "select count(*)::int as count from whatsapp_webhook_receipts",
          )
        ).rows[0].count,
        0,
      );
      assert.equal(
        (await pg.query<{ status: string }>("select status from outbound_queue")).rows[0].status,
        "processing",
      );
      assert.equal(await applyWhatsAppStatuses(sql, statuses, alert), 1);
      assert.equal(await applyWhatsAppStatuses(sql, statuses, alert), 0);
      assert.equal(
        (
          await pg.query<{ count: number }>(
            "select count(*)::int as count from outbound_queue where channel='email'",
          )
        ).rows[0].count,
        1,
      );
    } finally {
      await pg.close();
    }
  });
  it("deduplicates concurrent receipts and preserves monotonic status despite out-of-order events", async () => {
    const { pg, sql } = await database();
    try {
      const sent = parseWhatsAppStatuses(fixture(), config);
      const results = await Promise.all([
        applyWhatsAppStatuses(sql, sent),
        applyWhatsAppStatuses(sql, sent),
      ]);
      assert.equal(
        results.reduce((sum, value) => sum + value, 0),
        1,
      );
      assert.equal(
        (
          await pg.query<{ count: number }>(
            "select count(*)::int as count from whatsapp_webhook_receipts",
          )
        ).rows[0].count,
        1,
      );
      await applyWhatsAppStatuses(
        sql,
        parseWhatsAppStatuses(fixture("read", "1788688810"), config),
      );
      await applyWhatsAppStatuses(
        sql,
        parseWhatsAppStatuses(fixture("delivered", "1788688805"), config),
      );
      await applyWhatsAppStatuses(
        sql,
        parseWhatsAppStatuses(fixture("failed", "1788688811"), config),
      );
      const [row] = (
        await pg.query<{
          status: string;
          delivery_status: string;
          provider_message_id: string;
          read_at: Date;
          delivered_at: Date;
        }>("select * from outbound_queue")
      ).rows;
      assert.equal(row.status, "sent");
      assert.equal(row.delivery_status, "read");
      assert.equal(row.provider_message_id, "wamid.test");
      assert.ok(row.read_at && row.delivered_at);
    } finally {
      await pg.close();
    }
  });

  it("reconciles an ambiguous send by callback key, accepts later delivery after failure, and never revives cancellations", async () => {
    const { pg, sql } = await database();
    try {
      await pg.exec("update outbound_queue set status='review'");
      assert.equal(
        await applyWhatsAppStatuses(sql, parseWhatsAppStatuses(fixture("failed"), config)),
        1,
      );
      assert.equal(
        (await pg.query<{ status: string }>("select status from outbound_queue")).rows[0].status,
        "failed",
      );
      assert.equal(
        await applyWhatsAppStatuses(
          sql,
          parseWhatsAppStatuses(fixture("sent", "1788688801"), config),
        ),
        0,
      );
      assert.equal(
        await applyWhatsAppStatuses(
          sql,
          parseWhatsAppStatuses(fixture("delivered", "1788688802"), config),
        ),
        1,
      );
      await pg.exec("update outbound_queue set status='cancelled'");
      assert.equal(
        await applyWhatsAppStatuses(
          sql,
          parseWhatsAppStatuses(fixture("read", "1788688803"), config),
        ),
        0,
      );
      assert.equal(
        (await pg.query<{ status: string }>("select status from outbound_queue")).rows[0].status,
        "cancelled",
      );
    } finally {
      await pg.close();
    }
  });

  it("acknowledges unknown messages and refuses callback collisions with another accepted message", async () => {
    const { pg, sql } = await database();
    try {
      const payload = fixture();
      payload.entry[0].changes[0].value.statuses[0].biz_opaque_callback_data = "unknown:event";
      assert.equal(await applyWhatsAppStatuses(sql, parseWhatsAppStatuses(payload, config)), 0);
      await pg.exec("update outbound_queue set provider_message_id='wamid.existing'");
      assert.equal(
        await applyWhatsAppStatuses(sql, parseWhatsAppStatuses(fixture("delivered"), config)),
        0,
      );
      assert.equal(
        (
          await pg.query<{ provider_message_id: string }>(
            "select provider_message_id from outbound_queue",
          )
        ).rows[0].provider_message_id,
        "wamid.existing",
      );
    } finally {
      await pg.close();
    }
  });

  it("rolls back deduplication when the outbox update fails, allowing the same receipt to succeed on retry", async () => {
    const { pg, sql } = await database();
    try {
      await pg.exec(
        "create function fail_receipt_test() returns trigger language plpgsql as $$ begin raise exception 'simulated update failure'; end $$; create trigger receipt_failure before update on outbound_queue for each row execute function fail_receipt_test();",
      );
      const statuses = parseWhatsAppStatuses(fixture(), config);
      await assert.rejects(applyWhatsAppStatuses(sql, statuses));
      assert.equal(
        (
          await pg.query<{ count: number }>(
            "select count(*)::int as count from whatsapp_webhook_receipts",
          )
        ).rows[0].count,
        0,
      );
      await pg.exec("drop trigger receipt_failure on outbound_queue");
      assert.equal(await applyWhatsAppStatuses(sql, statuses), 1);
    } finally {
      await pg.close();
    }
  });
});
