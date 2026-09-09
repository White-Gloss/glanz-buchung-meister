import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { enqueueNotification } from "./booking-notifications.ts";
import { EmailDeliveryError } from "./resend-mail.ts";
import { WhatsAppDeliveryError } from "./whatsapp-provider.ts";
import {
  cronAuthorized,
  deliveryFailure,
  MAX_DELIVERY_ATTEMPTS,
  recordNotificationAttention,
  runNotificationWorker,
  scheduleDueBookingReminders,
  type OutboundMessage,
} from "./notification-worker.ts";

function wrap(pg: Pick<PGlite, "query">, transaction?: Sql["transaction"]): Sql {
  const sql = (async (strings: TemplateStringsArray, ...args: unknown[]) => {
    const query = strings.reduce((s, part, i) => s + (i ? `$${i}` : "") + part, "");
    return (await pg.query(query, args)).rows;
  }) as Sql;
  sql.query = async <T>(query: string, args: unknown[] = []) =>
    (await pg.query<T>(query, args)).rows;
  sql.transaction = transaction ?? ((fn) => fn(sql));
  return sql;
}

async function database(beforeDeliveryMigration?: (sql: Sql) => Promise<void>) {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  const sql = wrap(pg, (fn) => pg.transaction((tx) => fn(wrap(tx))));
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    if (file === "0008_notification_delivery.sql") await beforeDeliveryMigration?.(sql);
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return { pg, sql };
}

const keys = [
  "OWNER_EMAIL",
  "OWNER_WHATSAPP",
  "ADMIN_WHATSAPP_NUMBER",
  "OWNER_TELEGRAM",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "WHATSAPP_PROVIDER",
] as const;
let previous: (string | undefined)[] = [];
let previousFetch: typeof fetch;
let unexpectedFetch = 0;
beforeEach(() => {
  previous = keys.map((key) => process.env[key]);
  keys.forEach((key) => {
    delete process.env[key];
  });
  process.env.OWNER_EMAIL = "owner@example.invalid";
  process.env.ADMIN_WHATSAPP_NUMBER = "+490000111111";
  process.env.MAIL_FROM = "Fixture <sender@example.invalid>";
  previousFetch = globalThis.fetch;
  unexpectedFetch = 0;
  globalThis.fetch = async () => {
    unexpectedFetch++;
    throw new Error("No network allowed in isolated worker tests");
  };
});
afterEach(() => {
  globalThis.fetch = previousFetch;
  keys.forEach((key, i) => {
    if (previous[i] === undefined) delete process.env[key];
    else process.env[key] = previous[i];
  });
  assert.equal(unexpectedFetch, 0);
});

async function enqueue(
  sql: Sql,
  key: string,
  channel: "email" | "whatsapp" = "email",
  eventType = "booking.created",
) {
  const id = await enqueueNotification(sql, {
    key,
    channel,
    eventType,
    to: channel === "email" ? "customer@example.invalid" : "+490000111111",
    subject: "Fixture",
    body: "Isolated test",
  });
  assert.ok(id);
  return id;
}
const fakeEmail = async () => ({ id: "email-fixture" });
const fakeWhatsApp = async () => ({ id: "wamid.fixture" });
const providers = { sendEmail: fakeEmail, sendWhatsApp: fakeWhatsApp };

test("cron authorization requires an exact strong bearer secret", () => {
  const secret = "a".repeat(32);
  assert.equal(cronAuthorized(`Bearer ${secret}`, secret), true);
  for (const header of [
    null,
    secret,
    "Bearer wrong",
    `Basic ${secret}`,
    `Bearer ${"b".repeat(32)}`,
  ]) {
    assert.equal(cronAuthorized(header, secret), false);
  }
  assert.equal(cronAuthorized("Bearer short", "short"), false);
  assert.equal(cronAuthorized(`Bearer ${secret}`, ""), false);
});

test("legacy queued and failed messages are quarantined with their original status", async () => {
  const { pg, sql } = await database(async (tx) => {
    for (const channel of ["email", "whatsapp", "telegram"]) {
      await tx`insert into outbound_queue(channel,body,status) values(${channel},'legacy','queued')`;
    }
    await tx`insert into outbound_queue(channel,body,status) values('email','legacy-failed','failed'),('email','legacy-sent','sent')`;
  });
  try {
    const result = await runNotificationWorker(sql, providers);
    assert.equal(result.sent, 0);
    const rows = await sql<{
      body: string;
      status: string;
      legacy_status: string;
      last_error_code: string;
    }>`select * from outbound_queue order by id`;
    assert.equal(rows.filter((r) => r.status === "review").length, 4);
    assert.ok(
      rows
        .slice(0, 3)
        .every(
          (r) => r.legacy_status === "queued" && r.last_error_code === "legacy_delivery_unverified",
        ),
    );
    assert.equal(rows[3].legacy_status, "failed");
    assert.equal(rows[4].status, "sent");
  } finally {
    await pg.close();
  }
});

test("overlapping workers claim each message once and record the provider id", async () => {
  const { pg, sql } = await database();
  try {
    await enqueue(sql, "concurrent:email");
    let sends = 0;
    const options = {
      ...providers,
      limit: 1,
      sendEmail: async () => {
        sends++;
        return { id: "email-once" };
      },
    };
    await Promise.all([
      runNotificationWorker(sql, options),
      runNotificationWorker(sql, options),
      runNotificationWorker(sql, options),
    ]);
    const [row] = await sql`select * from outbound_queue`;
    assert.equal(sends, 1);
    assert.equal(row.status, "sent");
    assert.equal(row.attempt_count, 1);
    assert.equal(row.provider_message_id, "email-once");
    assert.equal(row.lease_token, null);
    const [settings] = await sql`select notification_worker_last_run_at from shop_settings`;
    assert.ok(settings.notification_worker_last_run_at);
  } finally {
    await pg.close();
  }
});

test("transient retries preserve the payload and key, back off, then stop at the attempt limit", async () => {
  const { pg, sql } = await database();
  try {
    const id = await enqueue(sql, "retry:email");
    const attachments = [
      { filename: "request.pdf", content: "JVBERi0xLjc=", content_type: "application/pdf" },
    ];
    await sql`update outbound_queue set attachments=${JSON.stringify(attachments)}::jsonb where id=${id}`;
    const inputs: unknown[] = [];
    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
      const result = await runNotificationWorker(sql, {
        ...providers,
        limit: 1,
        sendEmail: async (input) => {
          assert.deepEqual(input.attachments, attachments);
          inputs.push(input);
          throw new EmailDeliveryError("email_http_503", true);
        },
      });
      const [row] = await sql<{
        status: string;
        attempt_count: number;
        delayed: boolean;
      }>`select *,next_attempt_at > now() as delayed from outbound_queue where id = ${id}`;
      assert.equal(row.attempt_count, attempt);
      if (attempt < MAX_DELIVERY_ATTEMPTS) {
        assert.equal(result.retried, 1);
        assert.equal(row.status, "queued");
        assert.equal(row.delayed, true);
        await sql`update outbound_queue set next_attempt_at = now() where id = ${id}`;
      } else {
        assert.equal(result.failed, 1);
        assert.equal(row.status, "failed");
      }
      process.env.MAIL_FROM = "Changed <changed@example.invalid>";
    }
    assert.equal(inputs.length, MAX_DELIVERY_ATTEMPTS);
    assert.ok(inputs.every((input) => JSON.stringify(input) === JSON.stringify(inputs[0])));
    const alerts = await sql`select * from outbound_queue where event_type='notification.alert'`;
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].channel, "whatsapp", "email failure uses alternate owner channel");
  } finally {
    await pg.close();
  }
});

test("ambiguous WhatsApp delivery enters review, alerts the owner once, and never loops alerts", async () => {
  const { pg, sql } = await database();
  try {
    const id = await enqueue(sql, "ambiguous:whatsapp", "whatsapp");
    let waSends = 0;
    const options = {
      limit: 1,
      sendEmail: async () => {
        throw new EmailDeliveryError("email_http_400", false);
      },
      sendWhatsApp: async () => {
        waSends++;
        throw new WhatsAppDeliveryError("whatsapp_transport_unknown", false, true);
      },
    };
    assert.equal((await runNotificationWorker(sql, options)).review, 1);
    await runNotificationWorker(sql, options);
    await runNotificationWorker(sql, options);
    const [row] = await sql`select * from outbound_queue where id=${id}`;
    assert.equal(row.status, "review");
    assert.equal(waSends, 1);
    const alerts = await sql`select * from outbound_queue where event_type='notification.alert'`;
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].channel, "email");
    assert.equal(alerts[0].status, "failed");
  } finally {
    await pg.close();
  }
});

test("expired WhatsApp leases and email idempotency windows require review without resending", async () => {
  const { pg, sql } = await database();
  try {
    const waId = await enqueue(sql, "expired:whatsapp", "whatsapp");
    const mailId = await enqueue(sql, "expired:email");
    await sql`update outbound_queue set status='processing',attempt_count=1,first_attempt_at=now()-interval '24 hours',
      lease_token='expired',locked_until=now()-interval '1 minute' where id=${waId}`;
    await sql`update outbound_queue set attempt_count=1,first_attempt_at=now()-interval '24 hours' where id=${mailId}`;
    let originalSends = 0;
    await runNotificationWorker(sql, {
      limit: 10,
      sendEmail: async (input) => {
        if (input.idempotencyKey?.startsWith("expired:")) originalSends++;
        return { id: "alert-email" };
      },
      sendWhatsApp: async (input) => {
        if (input.idempotencyKey.startsWith("expired:")) originalSends++;
        return { id: "alert-wa" };
      },
    });
    assert.equal(originalSends, 0);
    const rows = await sql`select * from outbound_queue where id in (${waId},${mailId})`;
    assert.ok(rows.every((r) => r.status === "review"));
    assert.equal(
      (await sql`select * from outbound_queue where event_type='notification.alert'`).length,
      2,
    );
  } finally {
    await pg.close();
  }
});

test("a database failure after accepted delivery propagates and leaves an auditable lease", async () => {
  const { pg, sql } = await database();
  try {
    const id = await enqueue(sql, "ack:whatsapp", "whatsapp");
    const failing = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join("").includes("provider_message_id ="))
        throw new Error("ack database unavailable");
      return sql(strings, ...values);
    }) as Sql;
    failing.query = sql.query;
    failing.transaction = sql.transaction;
    let sends = 0;
    await assert.rejects(
      runNotificationWorker(failing, {
        ...providers,
        limit: 1,
        sendWhatsApp: async () => {
          sends++;
          return { id: "wamid.accepted" };
        },
      }),
      /ack database unavailable/,
    );
    const [row] = await sql`select * from outbound_queue where id=${id}`;
    assert.equal(sends, 1);
    assert.equal(row.status, "processing");
    assert.ok(row.lease_token);
    assert.equal(
      row.last_error_code,
      null,
      "DB failure must not become an undeliverable provider result",
    );
  } finally {
    await pg.close();
  }
});

test("an early delivered webhook cannot be regressed by the provider acknowledgement", async () => {
  const { pg, sql } = await database();
  try {
    const id = await enqueue(sql, "race:whatsapp", "whatsapp");
    await runNotificationWorker(sql, {
      ...providers,
      limit: 1,
      sendWhatsApp: async () => {
        await sql`update outbound_queue set status='sent',delivery_status='read',read_at=now(),
        provider_message_id='wamid.early',lease_token=null,locked_until=null where id=${id}`;
        return { id: "wamid.early" };
      },
    });
    const [row] = await sql`select * from outbound_queue where id=${id}`;
    assert.equal(row.status, "sent");
    assert.equal(row.delivery_status, "read");
    assert.ok(row.read_at);
  } finally {
    await pg.close();
  }
});

test("stale confirmations and reminders never send and never confirm a booking", async () => {
  const { pg, sql } = await database();
  try {
    for (const type of ["booking.confirmed", "booking.reminder"]) {
      await enqueue(sql, `stale:${type}`, "email", type);
    }
    let sends = 0;
    await runNotificationWorker(sql, {
      ...providers,
      sendEmail: async () => {
        sends++;
        return { id: "unexpected" };
      },
    });
    assert.equal(sends, 0);
    assert.ok(
      (await sql`select status from outbound_queue`).every((r) => r.status === "cancelled"),
    );
    assert.equal((await sql`select * from bookings`).length, 0);
  } finally {
    await pg.close();
  }
});

test("attention persistence is transactional, uses safe context and deduplicates the owner alert", async () => {
  const { pg, sql } = await database();
  try {
    const id = await enqueue(sql, "failed:whatsapp", "whatsapp");
    const row = { id, channel: "whatsapp", event_type: "booking.created", booking_id: null };
    await assert.rejects(
      sql.transaction(async (tx) => {
        await recordNotificationAttention(tx, row, "whatsapp_delivery_failed");
        throw new Error("rollback");
      }),
      /rollback/,
    );
    assert.equal((await sql`select * from automation_events`).length, 0);
    assert.equal(
      (await sql`select * from outbound_queue where event_type='notification.alert'`).length,
      0,
    );
    await recordNotificationAttention(sql, row, "whatsapp_delivery_failed");
    await recordNotificationAttention(sql, row, "whatsapp_delivery_failed");
    assert.equal(
      (await sql`select * from outbound_queue where event_type='notification.alert'`).length,
      1,
    );
  } finally {
    await pg.close();
  }
});

test("unknown provider results require review and retry delays remain bounded", () => {
  const row = {
    channel: "whatsapp",
    attempt_count: 1,
    first_attempt_at: new Date(),
  } as OutboundMessage;
  assert.equal(deliveryFailure(new Error("unknown internal detail"), row).status, "review");
  const longDelay = new WhatsAppDeliveryError("rate_limited", true, false, 10 ** 12);
  assert.equal(deliveryFailure(longDelay, row).delayMs, 14_400_000);
  assert.equal(
    deliveryFailure(longDelay, { ...row, attempt_count: MAX_DELIVERY_ATTEMPTS }).status,
    "failed",
  );
});

test("the scheduler skips short-notice confirmations while retaining a legacy reminder opportunity", async () => {
  const { pg, sql } = await database();
  try {
    const [booking] = await sql<{ id: number }>`
      insert into bookings(customer_name,phone,email,package_id,class_id,preferred_date,preferred_slot)
      values('Fixture','+490000123456','customer@example.invalid','basis','kompakt',
        (now() at time zone 'Europe/Berlin')::date +
          case when (now() at time zone 'Europe/Berlin')::time < '09:00'::time then 0 else 1 end,
        '09:00') returning id`;
    await sql.transaction(async (tx) => {
      await tx`select set_config('white_gloss.confirm_actor','fixture-owner',true)`;
      await tx`update bookings set status='bestaetigt',confirmed_by='fixture-owner',confirmed_at=now() where id=${booking.id}`;
    });
    assert.equal(await scheduleDueBookingReminders(sql), 0);
    assert.equal((await sql`select * from outbound_queue`).length, 0);
    await sql`update bookings set confirmed_at=now()-interval '48 hours' where id=${booking.id}`;
    assert.equal(await scheduleDueBookingReminders(sql), 1);
    assert.equal(
      (await sql`select * from outbound_queue where event_type='booking.reminder'`).length,
      1,
    );
    await scheduleDueBookingReminders(sql);
    assert.equal(
      (await sql`select * from outbound_queue where event_type='booking.reminder'`).length,
      1,
    );
  } finally {
    await pg.close();
  }
});

test("an early failed receipt is not counted as successfully delivered", async () => {
  const { pg, sql } = await database();
  try {
    const id = await enqueue(sql, "earlyfailed:whatsapp", "whatsapp");
    const result = await runNotificationWorker(sql, {
      ...providers,
      limit: 1,
      sendWhatsApp: async () => {
        await sql`update outbound_queue set status='failed',delivery_status='failed',
        last_error_code='whatsapp_delivery_failed',lease_token=null,locked_until=null where id=${id}`;
        return { id: "wamid.failed" };
      },
    });
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 1);
    const [row] = await sql`select * from outbound_queue where id=${id}`;
    assert.equal(row.status, "failed");
    assert.equal(row.last_error_code, "whatsapp_delivery_failed");
  } finally {
    await pg.close();
  }
});

test("missing setup consumes no delivery attempt or idempotency window before configuration is restored", async () => {
  const { pg, sql } = await database();
  try {
    const id = await enqueue(sql, "setup:email");
    await runNotificationWorker(sql, {
      ...providers,
      limit: 1,
      sendEmail: async () => {
        throw new EmailDeliveryError("email_not_configured", false);
      },
    });
    const [blocked] = await sql`select * from outbound_queue where id=${id}`;
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.attempt_count, 0);
    assert.equal(blocked.first_attempt_at, null);
    // It can have waited for setup for days without consuming Resend's key window.
    await sql`update outbound_queue set created_at=now()-interval '3 days' where id=${id}`;
    process.env.RESEND_API_KEY = "re_fixture";
    await runNotificationWorker(sql, { ...providers, limit: 10 });
    const [sent] = await sql`select * from outbound_queue where id=${id}`;
    assert.equal(sent.status, "sent");
    assert.equal(sent.attempt_count, 1);
    assert.ok(sent.first_attempt_at);
  } finally {
    await pg.close();
  }
});

test("a setup failure after a real attempt preserves the original provider idempotency window", async () => {
  const { pg, sql } = await database();
  try {
    const id = await enqueue(sql, "setup-after-attempt:email");
    await runNotificationWorker(sql, {
      ...providers,
      limit: 1,
      sendEmail: async () => {
        throw new EmailDeliveryError("email_http_503", true);
      },
    });
    const [attempt] = await sql`select first_attempt_at from outbound_queue where id=${id}`;
    await sql`update outbound_queue set next_attempt_at=now() where id=${id}`;
    await runNotificationWorker(sql, {
      ...providers,
      limit: 1,
      sendEmail: async () => {
        throw new EmailDeliveryError("email_not_configured", false);
      },
    });
    const [blocked] = await sql`select * from outbound_queue where id=${id}`;
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.attempt_count, 1);
    assert.deepEqual(blocked.first_attempt_at, attempt.first_attempt_at);
  } finally {
    await pg.close();
  }
});
