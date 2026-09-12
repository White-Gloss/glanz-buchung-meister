import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PDFDocument } from "pdf-lib";
import { createBookingRequestPdf } from "./booking-pdf.ts";
import type { Sql } from "./db.ts";
import {
  enqueueNotification,
  queueBookingEvent,
  queueBookingReminder,
  type BookingEvent,
  type NotificationBooking,
} from "./booking-notifications.ts";

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

test("PDF handles long notes and unsupported characters without breaking a request", async () => {
  const content = await createBookingRequestPdf({
    id: 999,
    customer_name: "Müller 🚗 李",
    phone: "+490000000000",
    package_id: "premium",
    note: "Eine lange mehrzeilige Notiz.\n".repeat(65),
    total_cents: 34900,
  });
  const doc = await PDFDocument.load(Buffer.from(content, "base64"));
  assert.equal(doc.getPageCount(), 1);
  assert.equal(doc.getTitle(), "Buchungsanfrage WG-999");
  assert.ok(Buffer.from(content, "base64").length < 100_000);
});

async function booking(sql: Sql, overrides: Partial<NotificationBooking> = {}) {
  const data = {
    customer_name: "Notification test",
    phone: "+490000123456",
    email: "customer@example.invalid",
    package_id: "basis",
    preferred_date: null,
    preferred_slot: null,
    status: "neu",
    note: null,
    version: 1,
    ...overrides,
  };
  return sql.transaction(async (tx) => {
    // Fixture creation still obeys the real database trigger's explicit-actor contract.
    await tx`select set_config('white_gloss.confirm_actor','notification-test-owner',true)`;
    const [row] = await tx<NotificationBooking>`
      insert into bookings(shop_id,status,customer_name,phone,email,package_id,class_id,
        preferred_date,preferred_slot,note,version,confirmed_by,confirmed_at)
      values('white-gloss',${data.status},${data.customer_name},${data.phone},${data.email},
        ${data.package_id},'kompakt',${data.preferred_date},${data.preferred_slot},${data.note},${data.version},
        ${data.status === "bestaetigt" ? "notification-test-owner" : null},
        case when ${data.status}='bestaetigt' then now() else null end)
      returning *
    `;
    return row;
  });
}

async function event(
  sql: Sql,
  row: NotificationBooking,
  name: BookingEvent,
  before: Record<string, string> | null = null,
) {
  const [saved] = await sql<{ id: number }>`
    insert into booking_events(shop_id,booking_id,event,actor,version,before_data,after_data,created_at)
    values('white-gloss',${row.id},${name},'notification-test-owner',${row.version ?? 1},
      ${before ? JSON.stringify(before) : null}::jsonb,'{}'::jsonb,'2027-03-28T09:34:00Z')
    returning id
  `;
  return saved.id;
}

type Message = {
  attachments: { filename: string; content: string; content_type: string }[];
  id: number;
  channel: string;
  to_addr: string;
  subject: string;
  body: string;
  event_key: string;
  event_type: string;
  status: string;
  booking_version: number;
  next_attempt_at: Date | string;
};

test("booking notifications persist against all production migrations", async (t) => {
  const environment = {
    OWNER_EMAIL: "owner@example.invalid",
    OWNER_WHATSAPP: "+490000000000",
    ADMIN_WHATSAPP_NUMBER: "+490000000000",
    OWNER_TELEGRAM: "",
    MAIL_FROM: "workshop@example.invalid",
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
      throw new Error("Notification enqueue must never call the network");
    });

    await t.test(
      "one event stays idempotent and leaves both equal-address recipient roles intact",
      async () => {
        const row = await booking(sql, { email: environment.OWNER_EMAIL });
        const id = await event(sql, row, "booking.created");
        await sql.transaction(async (tx) => {
          await queueBookingEvent(tx, row, "booking.created", id, "notification-test-owner");
          await queueBookingEvent(tx, row, "booking.created", id, "notification-test-owner");
        });
        const messages =
          await sql<Message>`select * from outbound_queue where booking_id=${row.id}`;
        assert.equal(messages.length, 3);
        assert.equal(messages.filter((m) => m.channel === "email").length, 2);
        assert.equal(messages.filter((m) => m.event_key.includes(":owner:")).length, 2);
        const customer = messages.find((m) => m.event_key.includes(":customer-v2:"));
        assert.ok(customer);
        assert.match(customer.body, /noch nicht verbindlich bestätigt/);
        assert.ok(messages.every((m) => m.attachments.length === 0));
        assert.equal(fetchMock.mock.callCount(), 0);
      },
    );

    await t.test(
      "transaction failure rolls back the event and its outbox without a provider call",
      async () => {
        const row = await booking(sql);
        await assert.rejects(
          sql.transaction(async (tx) => {
            const id = await event(tx, row, "booking.created");
            await queueBookingEvent(tx, row, "booking.created", id, "notification-test-owner");
            throw new Error("Simulated commit failure");
          }),
          /Simulated commit failure/,
        );
        assert.equal(
          (await sql`select id from outbound_queue where booking_id=${row.id}`).length,
          0,
        );
        assert.equal(
          (await sql`select id from booking_events where booking_id=${row.id}`).length,
          0,
        );
        assert.equal(fetchMock.mock.callCount(), 0);
      },
    );

    await t.test(
      "appointment reminders remain disabled independently of payment reminders",
      async () => {
        const pending = await booking(sql, {
          preferred_date: "2027-03-28",
          preferred_slot: "09:00",
        });
        await queueBookingReminder(sql, pending);
        assert.equal(
          (await sql`select id from outbound_queue where booking_id=${pending.id}`).length,
          0,
        );
        for (const [date] of [
          ["2027-03-28", "2027-03-27T07:00:00.000Z"],
          ["2027-10-31", "2027-10-30T08:00:00.000Z"],
        ]) {
          const row = await booking(sql, {
            status: "bestaetigt",
            preferred_date: date,
            preferred_slot: "09:00",
          });
          await queueBookingReminder(sql, row);
          await queueBookingReminder(sql, row);
          let reminders =
            await sql<Message>`select * from outbound_queue where booking_id=${row.id}`;
          assert.equal(reminders.length, 0);
          await queueBookingReminder(sql, { ...row, version: 2 });
          reminders = await sql<Message>`select * from outbound_queue where booking_id=${row.id}`;
          assert.equal(reminders.length, 0);
        }
      },
    );

    await t.test(
      "rescheduling tells the owner the former drop-off from the audit snapshot",
      async () => {
        const row = await booking(sql, { preferred_date: "2027-04-05", preferred_slot: "11:00" });
        const id = await event(sql, row, "booking.rescheduled", {
          date: "2027-04-02",
          slot: "09:00",
        });
        await queueBookingEvent(sql, row, "booking.rescheduled", id, "notification-test-owner");
        const [message] =
          await sql<Message>`select * from outbound_queue where booking_id=${row.id} and channel='whatsapp'`;
        assert.match(message.body, /2027-04-02 09:00/);
        assert.match(message.body, /2027-04-05/);
        assert.match(message.body, /11:00/);
      },
    );

    await t.test(
      "confirmation inside the last 24 hours does not enqueue an immediate second customer email",
      async () => {
        const late = await booking(sql, {
          status: "bestaetigt",
          preferred_date: "2027-04-07",
          preferred_slot: "09:00",
        });
        await queueBookingReminder(sql, { ...late, confirmed_at: "2027-04-06T08:00:00Z" });
        assert.equal(
          (await sql`select id from outbound_queue where booking_id=${late.id}`).length,
          0,
        );
        const early = await booking(sql, {
          status: "bestaetigt",
          preferred_date: "2027-04-08",
          preferred_slot: "09:00",
        });
        await queueBookingReminder(sql, { ...early, confirmed_at: "2027-04-07T06:00:00Z" });
        const rows = await sql<Message>`select * from outbound_queue where booking_id=${early.id}`;
        assert.equal(rows.length, 0);
      },
    );

    await t.test(
      "cancellation includes original drop-off and Berlin cancellation time even with a long note",
      async () => {
        const row = await booking(sql, { status: "storniert", note: "N".repeat(1000) });
        const id = await event(sql, row, "booking.cancelled", {
          date: "2027-04-02",
          slot: "09:00",
        });
        await queueBookingEvent(sql, row, "booking.cancelled", id, "notification-test-owner");
        const [message] =
          await sql<Message>`select * from outbound_queue where booking_id=${row.id} and channel='whatsapp'`;
        assert.ok(message.body.length <= 700);
        assert.match(message.body, /2027-04-02 09:00/);
        assert.match(message.body, /Storniert am:.*28\.03\.27.*11:34/);
      },
    );

    await t.test(
      "changed revisions cancel queued reminders while preserving delivered history and an active delivery lease",
      async () => {
        const row = await booking(sql, { version: 2 });
        for (const status of ["queued", "sent", "processing"]) {
          const id = await enqueueNotification(sql, {
            key: `test:${row.id}:${status}`,
            eventType: "booking.reminder",
            channel: "email",
            to: "customer@example.invalid",
            subject: "Previous reminder",
            body: "Previous drop-off",
            bookingId: row.id,
            bookingVersion: 1,
          });
          await sql`update outbound_queue set status=${status} where id=${id}`;
        }
        const id = await event(sql, row, "booking.rescheduled", {
          date: "2027-04-02",
          slot: "09:00",
        });
        await queueBookingEvent(sql, row, "booking.rescheduled", id, "notification-test-owner");
        const messages =
          await sql<Message>`select * from outbound_queue where booking_id=${row.id} and event_type='booking.reminder' order by id`;
        assert.deepEqual(
          messages.map((message) => message.status),
          ["cancelled", "sent", "processing"],
        );
        assert.equal(fetchMock.mock.callCount(), 0);
      },
    );
  } finally {
    await pg.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
