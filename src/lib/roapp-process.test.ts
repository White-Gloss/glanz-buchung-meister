// Isolated end-to-end proof of the RO App business process. Everything runs in
// memory: an embedded PGlite database, a simulated RO App API and a simulated
// mail transport. No website server, no real RO account, no real customer, no
// real message, signature or payment. RO statuses such as "Akzeptiert" are
// fixtures of the simulated API, not a substitute for a customer's signature.
process.env.BOOKING_OPERATIONS = "roapp";
process.env.ROAPP_ACCOUNT_SCOPE = "isolated-process-test";
process.env.ROAPP_CUTOVER_AT = "2020-01-01T00:00:00Z";
process.env.ROAPP_REVIEW_STATUS_ID = "1";
process.env.ROAPP_APPROVED_STATUS_ID = "2";
process.env.ROAPP_FIRM_STATUS_ID = "4";
process.env.ROAPP_CONFIRMED_STATUS_IDS = "4,7";
process.env.ROAPP_COMPLETED_STATUS_IDS = "5,6";
process.env.ROAPP_LIFECYCLE_MAIL_ENABLED = "true";
process.env.ROAPP_INVOICE_ENABLED = "true";
process.env.ROAPP_INVOICE_FROM = "2020-01-01T00:00:00Z";
process.env.ROAPP_INVOICE_DELAY_MINUTES = "0";
process.env.ROAPP_INVOICE_BANK_HOLDER = "Testinhaber";
process.env.ROAPP_INVOICE_BANK_NAME = "Testbank";
// Public ISO 13616 example IBAN; not a real account of the business.
process.env.ROAPP_INVOICE_IBAN = "DE89370400440532013000";
process.env.ROAPP_INVOICE_BIC = "COBADEFFXXX";
process.env.BETTER_AUTH_SECRET = "isolated-test-secret-".repeat(3);

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { packages, vehicleClasses } from "../data/site.ts";
import { queueRoappBooking, runRoappSync } from "./roapp-sync.ts";
import { refreshRoOrder } from "./roapp-callback.ts";
import { roappCustomerStatus } from "./roapp-customer-status.ts";
import { runNotificationWorker } from "./notification-worker.ts";
import { isApprovedCustomerNotification } from "./billing-policy.ts";
import {
  approvedRoInvoiceMessage,
  invoiceNumber,
  recordRoInvoicePayment,
  retryRoInvoice,
  roInvoiceConfig,
  roInvoiceMessageKey,
  runRoInvoices,
  RO_INVOICE,
  validIban,
} from "./roapp-invoice.ts";
import { berlinCalendarDate } from "./calendar-date.ts";
import { RoappError, type RoappCredentials, type RoappRequest } from "./roapp.ts";

const DAY = 86_400_000;
const pack = packages.find((item) => item.id === "premium")!;
const klass = vehicleClasses.find((item) => item.id === "kompakt")!;
const inquiryCents = Math.round(pack.price * klass.factor * 100);
const creds: RoappCredentials = {
  apiKey: "unused-in-isolated-test",
  apiBase: "https://api.roapp.io/v2",
  branchId: 10,
  assigneeId: 20,
  orderTypeId: 30,
  entityMap: { premium: 100 },
  expectedCompanyCreatedAt: "2026-09-28T13:56:33Z",
};

function wrap(db: Pick<PGlite, "query">): Sql {
  const sql = (async (parts: TemplateStringsArray, ...args: unknown[]) =>
    (
      await db.query(
        parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
        args,
      )
    ).rows) as Sql;
  sql.query = async <T>(q: string, args: unknown[] = []) => (await db.query<T>(q, args)).rows;
  sql.transaction = (fn) => fn(sql);
  return sql;
}

async function database() {
  // Same driver contract as production (src/lib/db.ts): DATE stays text, INT8 is a number.
  const pg = new PGlite({
    parsers: { 1082: (value: string) => value, 20: (value: string) => Number(value) },
  });
  const sql = wrap(pg);
  sql.transaction = (fn) => pg.transaction((tx) => fn(wrap(tx)));
  for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${file}`, "utf8"));
  await sql`update shop_settings set roapp_sync_enabled=true where shop_id='white-gloss'`;
  return { pg, sql };
}

type Item = { title: string; quantity: number; price: string; discount?: Record<string, unknown> };
type Order = {
  id: number;
  clientId: number;
  status: { id: number; name: string };
  items: Item[];
  scheduled: string | null;
  modified: number;
  comments: string[];
};

/** Simulated RO App API v2 with the verified request shapes of this integration. */
function fakeRo() {
  const people: {
    id: number;
    first_name: string;
    last_name?: string;
    email?: string | null;
    address?: string | null;
  }[] = [];
  const orders = new Map<number, Order>();
  const failures = new Map<string, RoappError>();
  let clock = Date.now() - DAY;
  let nextOrder = 7000;
  const total = (order: Order) =>
    (
      order.items.reduce(
        (sum, item) =>
          sum +
          Math.round(
            Math.round(Number(item.price) * 100) *
              item.quantity *
              (1 - Number(item.discount?.percentage ?? 0) / 100),
          ),
        0,
      ) / 100
    ).toFixed(2);
  const request: RoappRequest = async <T>(
    method: string,
    path: string,
    body?: Record<string, unknown> | null,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<T> => {
    const failure = failures.get(`${method} ${path}`);
    if (failure) {
      failures.delete(`${method} ${path}`);
      throw failure;
    }
    const orderMatch = /^\/orders\/(\d+)(\/[a-z-]+)?$/.exec(path);
    const order = orderMatch ? orders.get(Number(orderMatch[1])) : undefined;
    if (method === "GET" && path === "/contacts/people") {
      const wanted = ([] as string[]).concat(query?.emails || []);
      return { data: people.filter((p) => p.email && wanted.includes(p.email)) } as T;
    }
    if (method === "POST" && path === "/contacts/people") {
      const id = people.length + 1;
      people.push({
        id,
        first_name: String(body?.first_name),
        last_name: body?.last_name as string | undefined,
        email: (body?.email as string | undefined) ?? null,
      });
      return { id } as T;
    }
    const personMatch = /^\/contacts\/people\/(\d+)$/.exec(path);
    if (method === "GET" && personMatch) {
      const person = people.find((p) => p.id === Number(personMatch[1]));
      if (!person) throw new RoappError("roapp_request_failed", { status: 404, review: true });
      return { data: person } as T;
    }
    if (method === "POST" && path === "/orders") {
      const id = nextOrder++;
      orders.set(id, {
        id,
        clientId: Number(body?.client_id),
        status: { id: 1, name: "Anfrage (Preise prüfen)" },
        items: [],
        scheduled: null,
        modified: (clock += 60_000),
        comments: [],
      });
      return { id } as T;
    }
    if (order && method === "POST" && orderMatch![2] === "/items") {
      order.items.push({
        title: String(body?.comment),
        quantity: Number(body?.quantity),
        price: Number(body?.price).toFixed(2),
      });
      order.modified = clock += 60_000;
      return { id: order.items.length } as T;
    }
    if (order && method === "POST" && orderMatch![2] === "/comments") {
      order.comments.push(String(body?.comment));
      return { id: order.comments.length } as T;
    }
    if (order && method === "GET" && !orderMatch![2])
      return {
        id: order.id,
        status: order.status,
        total: total(order),
        modified_at: new Date(order.modified).toISOString(),
        scheduled_for: order.scheduled,
      } as T;
    if (order && method === "GET" && orderMatch![2] === "/items")
      return { data: order.items.map((item, index) => ({ id: index + 1, ...item })) } as T;
    if (order && method === "GET" && orderMatch![2] === "/public-url")
      return { url: `https://web.roapp.io/public/${order.id}` } as T;
    throw new Error(`Unexpected ${method} ${path}`);
  };
  /** Owner or customer action inside RO, followed by the signed webhook refresh. */
  const change = (id: number, patch: Partial<Pick<Order, "status" | "items" | "scheduled">>) => {
    Object.assign(orders.get(id)!, patch, { modified: (clock += 60_000) });
  };
  return { request, people, orders, failures, change };
}

function mailbox() {
  const sent: {
    to: string;
    subject: string;
    text: string;
    attachments?: { filename: string }[];
  }[] = [];
  let id = 0;
  const sendEmail = async (input: (typeof sent)[number]) => {
    sent.push(input);
    return { id: `isolated-${++id}` };
  };
  return { sent, sendEmail };
}

async function insertBooking(
  sql: Sql,
  input: { email: string | null; consent?: boolean; name?: string },
): Promise<{ id: number; version: number }> {
  const [row] = await sql<{ id: number; version: number }>`insert into bookings
    (shop_id,customer_name,phone,email,package_id,class_id,extra_ids,total_cents,preferred_date,preferred_slot,review_email_consent)
    values('white-gloss',${input.name ?? "Erika Muster"},'+491700000000',${input.email},'premium','kompakt','[]',
      ${inquiryCents},'2031-06-02','09:00',${input.consent ?? false}) returning id,version`;
  return row;
}

async function transfer(
  sql: Sql,
  ro: ReturnType<typeof fakeRo>,
  booking: { id: number; version: number },
) {
  await queueRoappBooking(sql, booking);
  const result = await runRoappSync(sql, { request: ro.request, creds });
  assert.equal(
    result.synced,
    1,
    JSON.stringify(
      await sql`select status,last_error from roapp_sync_queue where booking_id=${booking.id}`,
    ),
  );
  const [queue] = await sql<{
    ro_order_id: number;
  }>`select ro_order_id from roapp_sync_queue where booking_id=${booking.id}`;
  return queue.ro_order_id;
}

/** RO state change followed by the webhook's canonical re-read. */
async function roStep(
  sql: Sql,
  ro: ReturnType<typeof fakeRo>,
  orderId: number,
  patch: Parameters<ReturnType<typeof fakeRo>["change"]>[1],
) {
  ro.change(orderId, patch);
  await refreshRoOrder(sql, orderId, ro.request);
}

const S = {
  review: { id: 1, name: "Anfrage (Preise prüfen)" },
  approved: { id: 2, name: "Fixpreis bestätigt" },
  accepted: { id: 3, name: "Akzeptiert" },
  firm: { id: 4, name: "Termin verbindlich" },
  done: { id: 5, name: "Erledigt" },
  closed: { id: 6, name: "Geschlossen" },
  cancelled: { id: 8, name: "Storniert" },
};

test("complete process: inquiry, approval, acceptance, reminder, invoice, cash receipt and review", async () => {
  const { pg, sql } = await database();
  const ro = fakeRo();
  const mail = mailbox();
  try {
    // 1. Non-binding website inquiry with optional photo, transferred as exactly one RO order.
    const booking = await insertBooking(sql, { email: "kunde@example.invalid", consent: true });
    await sql`insert into booking_photos(shop_id,booking_id,storage_path,mime,size_bytes,original_name,upload_state)
      values('white-gloss',${booking.id},'isolated/foto.jpg','image/jpeg',1024,'foto.jpg','ready')`;
    const orderId = await transfer(sql, ro, booking);
    assert.equal(ro.orders.size, 1);
    assert.equal(await runRoappSync(sql, { request: ro.request, creds }).then((r) => r.synced), 0);
    assert.ok(ro.orders.get(orderId)!.comments.some((c) => c.includes("/api/ro-photo?token=")));
    await refreshRoOrder(sql, orderId, ro.request);
    let status = await roappCustomerStatus(sql, booking.id, inquiryCents);
    assert.equal(status.fixed, false);
    assert.equal(status.publicUrl, null);

    // 2./3. Owner sets the final price; only his approval exposes the offer link.
    const fixedCents = 32_900;
    await roStep(sql, ro, orderId, {
      items: [
        { title: `${pack.name} (geprüft)`, quantity: 1, price: "279.00" },
        { title: "Abholung bis 20 km", quantity: 1, price: "50.00" },
      ],
    });
    assert.equal((await roappCustomerStatus(sql, booking.id, inquiryCents)).fixed, false);
    await roStep(sql, ro, orderId, { status: S.approved });
    status = await roappCustomerStatus(sql, booking.id, inquiryCents);
    assert.equal(status.fixed, true);
    assert.equal(status.amount, fixedCents);
    assert.equal(status.publicUrl, `https://web.roapp.io/public/${orderId}`);

    // 4. Customer acceptance (RO fixture) is not a binding appointment yet.
    const appointment = new Date(Date.now() + 2 * DAY).toISOString();
    await roStep(sql, ro, orderId, { status: S.accepted, scheduled: appointment });
    let [state] = await sql<{
      owner_confirmed_at: Date | null;
    }>`select owner_confirmed_at from roapp_order_state where booking_id=${booking.id}`;
    assert.equal(state.owner_confirmed_at, null);
    assert.equal(
      (await sql`select 1 from outbound_queue where event_type='wg.ro.reminder'`).length,
      0,
    );
    await roStep(sql, ro, orderId, { status: S.firm });
    [state] =
      await sql`select owner_confirmed_at from roapp_order_state where booking_id=${booking.id}`;
    assert.ok(state.owner_confirmed_at);

    // 5. Short-notice confirmation: reminder goes out with the next delivery run.
    await runNotificationWorker(sql, { sendEmail: mail.sendEmail, roRequest: ro.request });
    const reminder = mail.sent.find((m) => m.subject.startsWith("Erinnerung"));
    assert.ok(reminder);
    assert.equal(reminder.to, "kunde@example.invalid");
    assert.match(reminder.text, /telefonisch/);
    assert.match(reminder.text, /Übergabe/);

    // 6. Completion -> invoice with seven-day term, sent once; never marked paid by status.
    // Above 250 EUR the RO contact must carry the customer's address (§14 UStG).
    ro.people.find((p) => p.id === ro.orders.get(orderId)!.clientId)!.address =
      "Musterstraße 5, 72160 Horb am Neckar";
    await roStep(sql, ro, orderId, { status: S.done });
    const run = await runRoInvoices(sql, { request: ro.request });
    assert.equal(run.issued, 1);
    const [invoice] = await sql<{
      invoice_number: string;
      gross_cents: number;
      net_cents: number;
      vat_cents: number;
      payment_status: string;
      issued_on: string;
      payment_due_on: string;
      pdf_base64: string;
      status: string;
    }>`select invoice_number,gross_cents,net_cents,vat_cents,payment_status,issued_on::text,payment_due_on::text,pdf_base64,status
      from roapp_invoices where booking_id=${booking.id}`;
    const year = Number(berlinCalendarDate().slice(0, 4));
    assert.equal(invoice.invoice_number, invoiceNumber(year, 1));
    assert.equal(invoice.gross_cents, fixedCents);
    assert.equal(invoice.net_cents + invoice.vat_cents, fixedCents);
    assert.equal(invoice.payment_status, "offen");
    assert.equal(Date.parse(invoice.payment_due_on) - Date.parse(invoice.issued_on), 7 * DAY);
    assert.equal(Buffer.from(invoice.pdf_base64, "base64").subarray(0, 5).toString(), "%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    assert.equal(
      (await PDFDocument.load(Buffer.from(invoice.pdf_base64, "base64"))).getAuthor(),
      "White Gloss Detailing · Inhaber Lars Marco Hägele",
    );
    assert.ok(ro.orders.get(orderId)!.comments.some((c) => c.includes(invoice.invoice_number)));

    // Double-invoice protection: webhook replays, further runs and a status change to "Geschlossen".
    await refreshRoOrder(sql, orderId, ro.request);
    await roStep(sql, ro, orderId, { status: S.closed });
    await runRoInvoices(sql, { request: ro.request });
    await runRoInvoices(sql, { request: ro.request });
    assert.equal((await sql`select 1 from roapp_invoices`).length, 1);
    assert.equal(
      (await sql`select 1 from outbound_queue where event_type=${RO_INVOICE}`).length,
      1,
    );

    await runNotificationWorker(sql, { sendEmail: mail.sendEmail, roRequest: ro.request });
    const invoiceMail = mail.sent.filter((m) => m.subject.startsWith("Rechnung"));
    assert.equal(invoiceMail.length, 1);
    assert.equal(invoiceMail[0].to, "kunde@example.invalid");
    assert.equal(
      invoiceMail[0].attachments?.[0].filename,
      `Rechnung-${invoice.invoice_number}.pdf`,
    );
    assert.match(invoiceMail[0].text, /Zahlungsziel sieben Tage/);
    assert.equal(
      (await sql<{ status: string }>`select status from roapp_invoices`)[0].status,
      "versendet",
    );

    // Payments exist only when recorded; partial cash, idempotent resubmission, overpayment guard.
    const today = berlinCalendarDate();
    const first = {
      invoiceNumber: invoice.invoice_number,
      amountCents: 10_000,
      method: "bar" as const,
      paidOn: today,
      requestId: "00000000-0000-4000-8000-000000000001",
      recordedBy: "owner",
    };
    assert.equal((await recordRoInvoicePayment(sql, first)).paymentStatus, "teilbezahlt");
    assert.equal((await recordRoInvoicePayment(sql, first)).duplicate, true);
    await assert.rejects(
      recordRoInvoicePayment(sql, {
        ...first,
        requestId: "00000000-0000-4000-8000-000000000002",
        amountCents: 30_000,
      }),
      /übersteigt/,
    );
    await assert.rejects(
      recordRoInvoicePayment(sql, {
        ...first,
        requestId: "00000000-0000-4000-8000-000000000003",
        paidOn: "2099-01-01",
      }),
      /Zukunft/,
    );
    assert.equal(
      (
        await recordRoInvoicePayment(sql, {
          ...first,
          requestId: "00000000-0000-4000-8000-000000000004",
          amountCents: fixedCents - 10_000,
        })
      ).paymentStatus,
      "bezahlt",
    );
    const payments = await sql<{
      receipt_number: string;
    }>`select receipt_number from roapp_invoice_payments order by id`;
    assert.deepEqual(
      payments.map((p) => p.receipt_number),
      [`${invoice.invoice_number}-Q1`, `${invoice.invoice_number}-Q2`],
    );
    await runNotificationWorker(sql, { sendEmail: mail.sendEmail, roRequest: ro.request });
    const receipts = mail.sent.filter((m) => m.subject.startsWith("Quittung"));
    assert.equal(receipts.length, 2);
    assert.match(receipts[1].text, /vollständig bezahlt/);

    // 7. Review exactly once, seven days after the recorded completion, with consent.
    assert.equal(mail.sent.filter((m) => m.subject.startsWith("Wie war")).length, 0);
    await sql`update roapp_order_state set completed_at=now()-interval '8 days' where booking_id=${booking.id}`;
    await refreshRoOrder(sql, orderId, ro.request);
    for (let i = 0; i < 3; i++)
      await runNotificationWorker(sql, { sendEmail: mail.sendEmail, roRequest: ro.request });
    const reviews = mail.sent.filter((m) => m.subject.startsWith("Wie war"));
    assert.equal(reviews.length, 1);
    assert.match(reviews[0].text, /unabhängig davon, wie dein Erlebnis war/);
    assert.equal(mail.sent.filter((m) => m.subject.startsWith("Erinnerung")).length, 1);
  } finally {
    await pg.close();
  }
});

test("missing e-mail, missing billing address and corrected RO contact data", async () => {
  const { pg, sql } = await database();
  const ro = fakeRo();
  const mail = mailbox();
  try {
    const booking = await insertBooking(sql, { email: null, name: "Max Ohnemail" });
    const orderId = await transfer(sql, ro, booking);
    await roStep(sql, ro, orderId, {
      items: [{ title: "Aufbereitung nach Begutachtung", quantity: 1, price: "480.00" }],
    });
    await roStep(sql, ro, orderId, { status: S.approved });
    await roStep(sql, ro, orderId, {
      status: S.accepted,
      scheduled: new Date(Date.now() + 10 * DAY).toISOString(),
    });
    await roStep(sql, ro, orderId, { status: S.firm });
    // No customer reminder without an address; the owner is told to call once.
    const notices = await sql<{
      to_addr: string;
      event_key: string;
    }>`select to_addr,event_key from outbound_queue where booking_id=${booking.id}`;
    assert.equal(notices.length, 1);
    assert.match(notices[0].event_key, /:owner:ohne-email-/);
    await refreshRoOrder(sql, orderId, ro.request);
    assert.equal(
      (await sql`select 1 from outbound_queue where booking_id=${booking.id}`).length,
      1,
    );

    // Above 250 EUR a full address is mandatory: no number is consumed while it is missing.
    await roStep(sql, ro, orderId, { status: S.done });
    assert.equal((await runRoInvoices(sql, { request: ro.request })).waiting, 1);
    let [row] = await sql<{
      status: string;
      invoice_number: string | null;
    }>`select status,invoice_number from roapp_invoices`;
    assert.deepEqual(row, { status: "wartet", invoice_number: null });
    assert.equal(
      (
        await sql`select 1 from outbound_queue where event_key like '%:owner:rechnungsadresse-fehlt-%'`
      ).length,
      1,
    );
    await runRoInvoices(sql, { request: ro.request });
    assert.equal(
      (
        await sql`select 1 from outbound_queue where event_key like '%:owner:rechnungsadresse-fehlt-%'`
      ).length,
      1,
    );

    // Owner completes the RO contact: address and a corrected e-mail replace the website data.
    const person = ro.people.find((p) => p.id === ro.orders.get(orderId)!.clientId)!;
    person.address = "Musterweg 1, 72160 Horb am Neckar";
    person.email = "neu@example.invalid";
    assert.equal(await retryRoInvoice(sql, booking.id), true);
    assert.equal((await runRoInvoices(sql, { request: ro.request })).issued, 1);
    [row] = await sql`select status,invoice_number from roapp_invoices`;
    assert.equal(row.status, "ausgestellt");
    assert.equal(
      (await sql<{ email: string }>`select email from bookings where id=${booking.id}`)[0].email,
      "neu@example.invalid",
    );
    await runNotificationWorker(sql, { sendEmail: mail.sendEmail, roRequest: ro.request });
    const invoiceMail = mail.sent.find((m) => m.subject.startsWith("Rechnung"));
    assert.equal(invoiceMail?.to, "neu@example.invalid");

    // A second customer without any e-mail: invoice PDF goes to the owner for handover.
    const second = await insertBooking(sql, { email: null, name: "Ohne Adresse" });
    const secondOrder = await transfer(sql, ro, second);
    await roStep(sql, ro, secondOrder, {
      items: [{ title: "Innenreinigung", quantity: 1, price: "149.00" }],
    });
    await roStep(sql, ro, secondOrder, { status: S.approved });
    await roStep(sql, ro, secondOrder, {
      status: S.accepted,
      scheduled: new Date(Date.now() - DAY).toISOString(),
    });
    await roStep(sql, ro, secondOrder, { status: S.firm });
    await roStep(sql, ro, secondOrder, { status: S.done });
    assert.equal((await runRoInvoices(sql, { request: ro.request })).issued, 1);
    const [handover] = await sql<{
      delivery: string;
      invoice_number: string;
    }>`select delivery,invoice_number from roapp_invoices where booking_id=${second.id}`;
    assert.equal(handover.delivery, "inhaber");
    await runNotificationWorker(sql, { sendEmail: mail.sendEmail, roRequest: ro.request });
    const ownerCopy = mail.sent.find((m) => m.subject.includes("rechnung ohne email"));
    assert.equal(ownerCopy?.to, "buchung@white-gloss.de");
    assert.equal(ownerCopy?.attachments?.[0].filename, `Rechnung-${handover.invoice_number}.pdf`);
    assert.equal(mail.sent.filter((m) => m.subject.startsWith("Rechnung ")).length, 1);
  } finally {
    await pg.close();
  }
});

test("rescheduling and cancellation withdraw reminders and never create invoices", async () => {
  const { pg, sql } = await database();
  const ro = fakeRo();
  const mail = mailbox();
  try {
    const booking = await insertBooking(sql, { email: "umbuchung@example.invalid", consent: true });
    const orderId = await transfer(sql, ro, booking);
    await roStep(sql, ro, orderId, {
      items: [{ title: "Politur", quantity: 1, price: "199.00" }],
    });
    await roStep(sql, ro, orderId, { status: S.approved });
    const first = new Date(Date.now() + 10 * DAY).toISOString();
    await roStep(sql, ro, orderId, { status: S.accepted, scheduled: first });
    await roStep(sql, ro, orderId, { status: S.firm });
    const [queued] = await sql<{
      next_attempt_at: Date;
    }>`select next_attempt_at from outbound_queue where event_type='wg.ro.reminder'`;
    assert.equal(queued.next_attempt_at.getTime(), Date.parse(first) - 3 * DAY);

    // Rescheduled in RO: the old reminder is void and the status needs a new owner check.
    const second = new Date(Date.now() + 12 * DAY).toISOString();
    await roStep(sql, ro, orderId, { scheduled: second });
    assert.equal(
      (await roappCustomerStatus(sql, booking.id, inquiryCents)).status,
      "Termin wird erneut geprüft",
    );
    await sql`update outbound_queue set next_attempt_at=now() where event_type='wg.ro.reminder'`;
    await runNotificationWorker(sql, { sendEmail: mail.sendEmail, roRequest: ro.request });
    assert.equal(mail.sent.length, 0);
    assert.equal(
      (
        await sql<{
          status: string;
        }>`select status from outbound_queue where event_type='wg.ro.reminder'`
      )[0].status,
      "cancelled",
    );
    await roStep(sql, ro, orderId, { status: S.accepted });
    await roStep(sql, ro, orderId, { status: S.firm });
    const reminders = await sql<{
      next_attempt_at: Date;
      status: string;
    }>`select next_attempt_at,status from outbound_queue where event_type='wg.ro.reminder' order by id`;
    assert.equal(reminders.length, 2);
    assert.equal(reminders[1].next_attempt_at.getTime(), Date.parse(second) - 3 * DAY);

    // Cancelled: the pending reminder is withdrawn, the customer page says so, no invoice appears.
    await roStep(sql, ro, orderId, { status: S.cancelled });
    assert.match(
      (await roappCustomerStatus(sql, booking.id, inquiryCents)).customerStep.text,
      /nicht weiterbearbeitet/,
    );
    await sql`update outbound_queue set next_attempt_at=now() where status='queued'`;
    await runNotificationWorker(sql, { sendEmail: mail.sendEmail, roRequest: ro.request });
    assert.equal(mail.sent.length, 0);
    await runRoInvoices(sql, { request: ro.request });
    assert.equal((await sql`select 1 from roapp_invoices`).length, 0);
  } finally {
    await pg.close();
  }
});

test("error cases keep numbering gapless and never silently rewrite an issued invoice", async () => {
  const { pg, sql } = await database();
  const ro = fakeRo();
  const mail = mailbox();
  try {
    const booking = await insertBooking(sql, { email: "fehler@example.invalid" });
    const orderId = await transfer(sql, ro, booking);
    await roStep(sql, ro, orderId, {
      items: [
        {
          title: "Politur",
          quantity: 1,
          price: "199.00",
          discount: { type: "percentage", percentage: 10 },
        },
      ],
    });
    await roStep(sql, ro, orderId, { status: S.approved });
    await roStep(sql, ro, orderId, {
      status: S.accepted,
      scheduled: new Date(Date.now() - DAY).toISOString(),
    });
    await roStep(sql, ro, orderId, { status: S.firm });
    await roStep(sql, ro, orderId, { status: S.done });

    // Transient RO failure: retried later, nothing issued.
    ro.failures.set(
      `GET /orders/${orderId}/items`,
      new RoappError("roapp_request_failed", { status: 503, retryable: true }),
    );
    assert.equal((await runRoInvoices(sql, { request: ro.request })).retried, 1);
    await sql`update roapp_invoices set due_at=now()`;
    // Discounts are not interpreted: review instead of a possibly wrong invoice.
    assert.equal((await runRoInvoices(sql, { request: ro.request })).review, 1);
    assert.equal((await sql`select 1 from roapp_invoice_numbers`).length, 0);
    assert.equal(
      (await sql`select 1 from outbound_queue where event_key like '%:owner:rechnung-pruefung-%'`)
        .length,
      1,
    );
    // The owner rewrites the discounted RO line as a net line of the same total;
    // the approved amount is unchanged and the first number is still 0001.
    await roStep(sql, ro, orderId, {
      items: [{ title: "Politur (inkl. 10 % Nachlass)", quantity: 1, price: "179.10" }],
    });
    assert.equal(await retryRoInvoice(sql, booking.id), true);
    assert.equal((await runRoInvoices(sql, { request: ro.request })).issued, 1);
    const [invoice] = await sql<{
      invoice_number: string;
      gross_cents: number;
    }>`select invoice_number,gross_cents from roapp_invoices`;
    assert.equal(
      invoice.invoice_number,
      invoiceNumber(Number(berlinCalendarDate().slice(0, 4)), 1),
    );
    assert.equal(invoice.gross_cents, 17_910);

    // A later RO change never rewrites or cancels the issued invoice; the owner is alerted once.
    await roStep(sql, ro, orderId, { status: S.accepted });
    await runRoInvoices(sql, { request: ro.request });
    await runRoInvoices(sql, { request: ro.request });
    const [after] = await sql<{
      invoice_number: string;
      attention: string;
    }>`select invoice_number,attention from roapp_invoices`;
    assert.equal(after.invoice_number, invoice.invoice_number);
    assert.equal(after.attention, "auftrag_nach_rechnung_geaendert");
    assert.equal(
      (await sql`select 1 from outbound_queue where event_key like '%:owner:rechnung-pruefen-%'`)
        .length,
      1,
    );

    // A tampered or foreign-account invoice message is never delivered.
    const key = roInvoiceMessageKey(booking.id, "invoice", invoice.invoice_number);
    assert.equal(approvedRoInvoiceMessage(key, RO_INVOICE), true);
    assert.equal(
      isApprovedCustomerNotification(key.replace("isolated-process-test", "legacy"), RO_INVOICE),
      false,
    );
    // An operational failure during the pre-send check is retried, not parked in review.
    await pg.exec("alter table roapp_invoices rename to roapp_invoices_offline");
    await runNotificationWorker(sql, { sendEmail: mail.sendEmail, roRequest: ro.request });
    await pg.exec("alter table roapp_invoices_offline rename to roapp_invoices");
    const [retry] = await sql<{
      status: string;
      last_error_code: string;
    }>`select status,last_error_code
      from outbound_queue where event_type=${RO_INVOICE}`;
    assert.deepEqual(retry, { status: "queued", last_error_code: "ro_invoice_check_failed" });
    await sql`update outbound_queue set to_addr='fremd@example.invalid',next_attempt_at=now() where event_type=${RO_INVOICE}`;
    await runNotificationWorker(sql, { sendEmail: mail.sendEmail, roRequest: ro.request });
    assert.equal(mail.sent.filter((m) => m.subject.startsWith("Rechnung")).length, 0);
    assert.equal(
      (
        await sql<{
          status: string;
        }>`select status from outbound_queue where event_type=${RO_INVOICE}`
      )[0].status,
      "review",
    );
  } finally {
    await pg.close();
  }
});

test("orders completed before the automation start and incomplete configuration are never invoiced", async () => {
  const { pg, sql } = await database();
  const ro = fakeRo();
  try {
    const booking = await insertBooking(sql, { email: "alt@example.invalid" });
    const orderId = await transfer(sql, ro, booking);
    await roStep(sql, ro, orderId, { items: [{ title: "Politur", quantity: 1, price: "199.00" }] });
    await roStep(sql, ro, orderId, { status: S.approved });
    await roStep(sql, ro, orderId, {
      status: S.accepted,
      scheduled: new Date(Date.now() - DAY).toISOString(),
    });
    await roStep(sql, ro, orderId, { status: S.firm });
    await roStep(sql, ro, orderId, { status: S.done });
    process.env.ROAPP_INVOICE_FROM = new Date(Date.now() + 60_000).toISOString();
    assert.equal((await runRoInvoices(sql, { request: ro.request })).planned, 0);
    process.env.ROAPP_INVOICE_FROM = "2020-01-01T00:00:00Z";

    const iban = process.env.ROAPP_INVOICE_IBAN;
    process.env.ROAPP_INVOICE_IBAN = "DE89370400440532013001";
    assert.match(roInvoiceConfig().problems.join(" "), /IBAN/);
    assert.deepEqual(await runRoInvoices(sql, { request: ro.request }), {
      planned: 0,
      issued: 0,
      waiting: 0,
      review: 0,
      discarded: 0,
      retried: 0,
    });
    assert.equal((await sql`select 1 from roapp_invoices`).length, 0);
    assert.equal(
      (
        await sql`select 1 from outbound_queue where event_key like '%:owner:rechnungskonfiguration-%'`
      ).length,
      1,
    );
    process.env.ROAPP_INVOICE_IBAN = iban;
    assert.ok(validIban(iban!));
    assert.equal(roInvoiceConfig().problems.length, 0);
  } finally {
    await pg.close();
  }
});

test("unknown RO response shapes stop automation instead of guessing", async () => {
  const { parseRoappOrderLines, getPerson } = await import("./roapp.ts");
  assert.deepEqual(
    parseRoappOrderLines({ data: [{ title: "Politur", quantity: 2, price: "99.50" }] }),
    [{ name: "Politur", quantity: 2, grossCents: 19_900 }],
  );
  for (const payload of [
    null,
    { data: [] },
    { data: [{ quantity: 1, price: "10.00" }] },
    { data: [{ title: "x", quantity: 0.5, price: "10.00" }] },
    { data: [{ title: "x", quantity: 1, price: "10.001" }] },
    { data: [{ title: "x", quantity: 1, price: "10.00", discount: { amount: 5 } }] },
  ])
    assert.throws(() => parseRoappOrderLines(payload), RoappError);
  const reply =
    (value: unknown): RoappRequest =>
    async <T>() =>
      value as T;
  assert.deepEqual(
    await getPerson(
      reply({
        data: {
          id: 5,
          first_name: "Erika",
          last_name: "Muster",
          email: "E@Example.invalid",
          address: " Weg 1 ",
        },
      }),
      5,
    ),
    { id: 5, name: "Erika Muster", email: "e@example.invalid", address: "Weg 1" },
  );
  await assert.rejects(getPerson(reply({ data: { id: 6 } }), 5), RoappError);
  await assert.rejects(getPerson(reply({ data: { id: 5, email: "kein-email" } }), 5), RoappError);
  assert.equal(
    await getPerson(async () => {
      throw new RoappError("roapp_request_failed", { status: 404, review: true });
    }, 5),
    null,
  );
});

test("review follow-ups: strict contact data, late e-mail, start proof, paused automation", async () => {
  const { pg, sql } = await database();
  const ro = fakeRo();
  const person = (orderId: number) =>
    ro.people.find((p) => p.id === ro.orders.get(orderId)!.clientId)!;
  const complete = async (orderId: number, price = "199.00") => {
    await roStep(sql, ro, orderId, { items: [{ title: "Politur", quantity: 1, price }] });
    await roStep(sql, ro, orderId, { status: S.approved });
    await roStep(sql, ro, orderId, {
      status: S.accepted,
      scheduled: new Date(Date.now() - DAY).toISOString(),
    });
    await roStep(sql, ro, orderId, { status: S.firm });
    await roStep(sql, ro, orderId, { status: S.done });
  };
  try {
    // An unexpected RO contact payload stops the invoice instead of using a stale address.
    const first = await insertBooking(sql, { email: "alt@example.invalid" });
    const firstOrder = await transfer(sql, ro, first);
    await complete(firstOrder);
    person(firstOrder).email = "kein-gueltiges-format";
    assert.equal((await runRoInvoices(sql, { request: ro.request })).review, 1);
    assert.deepEqual(
      (await sql`select status,invoice_number from roapp_invoices where booking_id=${first.id}`)[0],
      { status: "pruefung", invoice_number: null },
    );

    // An e-mail added to RO after confirmation still yields the three-day reminder.
    const late = await insertBooking(sql, { email: null });
    const lateOrder = await transfer(sql, ro, late);
    await roStep(sql, ro, lateOrder, {
      items: [{ title: "Politur", quantity: 1, price: "199.00" }],
    });
    await roStep(sql, ro, lateOrder, { status: S.approved });
    const appointment = new Date(Date.now() + 10 * DAY).toISOString();
    await roStep(sql, ro, lateOrder, { status: S.accepted, scheduled: appointment });
    await roStep(sql, ro, lateOrder, { status: S.firm });
    assert.equal(
      (
        await sql`select 1 from outbound_queue where event_type='wg.ro.reminder' and booking_id=${late.id}`
      ).length,
      0,
    );
    person(lateOrder).email = "spaeter@example.invalid";
    await refreshRoOrder(sql, lateOrder, ro.request);
    const [reminder] = await sql<{
      to_addr: string;
      next_attempt_at: Date;
    }>`select to_addr,next_attempt_at
      from outbound_queue where event_type='wg.ro.reminder' and booking_id=${late.id}`;
    assert.equal(reminder.to_addr, "spaeter@example.invalid");
    assert.equal(reminder.next_attempt_at.getTime(), Date.parse(appointment) - 3 * DAY);

    // Confirmed before the start, completed after: no automatic invoice (may be billed manually).
    const straddle = await insertBooking(sql, { email: "grenze@example.invalid" });
    const straddleOrder = await transfer(sql, ro, straddle);
    await roStep(sql, ro, straddleOrder, {
      items: [{ title: "Politur", quantity: 1, price: "199.00" }],
    });
    await roStep(sql, ro, straddleOrder, { status: S.approved });
    await roStep(sql, ro, straddleOrder, {
      status: S.accepted,
      scheduled: new Date(Date.now() - DAY).toISOString(),
    });
    await roStep(sql, ro, straddleOrder, { status: S.firm });
    process.env.ROAPP_INVOICE_FROM = new Date(Date.now() + 1000).toISOString();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await roStep(sql, ro, straddleOrder, { status: S.done });
    await runRoInvoices(sql, { request: ro.request });
    assert.equal(
      (await sql`select 1 from roapp_invoices where booking_id=${straddle.id}`).length,
      0,
    );

    // A failed RO hint is surfaced once; issued invoices stay visible and receipts
    // deliverable while the automation is paused.
    const hinted = await insertBooking(sql, { email: "hinweis@example.invalid" });
    const hintedOrder = await transfer(sql, ro, hinted);
    await complete(hintedOrder, "149.00");
    ro.failures.set(
      `POST /orders/${hintedOrder}/comments`,
      new RoappError("roapp_request_failed", { status: 500, review: true }),
    );
    assert.equal((await runRoInvoices(sql, { request: ro.request })).issued, 1);
    const [hint] = await sql<{
      invoice_number: string;
      ro_comment_state: string;
    }>`select invoice_number,ro_comment_state
      from roapp_invoices where booking_id=${hinted.id}`;
    assert.equal(hint.ro_comment_state, "pruefung");
    await runRoInvoices(sql, { request: ro.request });
    assert.equal(
      (await sql`select 1 from outbound_queue where event_key like '%:owner:ro-hinweis-fehlt-%'`)
        .length,
      1,
    );
    process.env.ROAPP_INVOICE_ENABLED = "false";
    try {
      const { roInvoiceOverview } = await import("./roapp-invoice.ts");
      const overview = await roInvoiceOverview(sql);
      assert.equal(overview.enabled, false);
      assert.ok(overview.invoices.some((row) => row.invoice_number === hint.invoice_number));
      assert.equal(
        approvedRoInvoiceMessage(
          roInvoiceMessageKey(hinted.id, "invoice", hint.invoice_number),
          RO_INVOICE,
        ),
        false,
      );
      assert.equal(
        approvedRoInvoiceMessage(
          roInvoiceMessageKey(hinted.id, "receipt", `${hint.invoice_number}-Q1`),
          "wg.ro.receipt",
        ),
        true,
      );
      assert.equal(
        (
          await recordRoInvoicePayment(sql, {
            invoiceNumber: hint.invoice_number,
            amountCents: 14_900,
            method: "bar",
            paidOn: berlinCalendarDate(),
            requestId: "00000000-0000-4000-8000-000000000009",
            recordedBy: "owner",
          })
        ).paymentStatus,
        "bezahlt",
      );
    } finally {
      process.env.ROAPP_INVOICE_ENABLED = "true";
    }
  } finally {
    process.env.ROAPP_INVOICE_FROM = "2020-01-01T00:00:00Z";
    await pg.close();
  }
});

test("runtime schema setup records migration 0023 in the history", async () => {
  const pg = new PGlite();
  const sql = wrap(pg);
  try {
    for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
      if (file !== "0023_roapp_invoices.sql")
        await pg.exec(await readFile(`migrations/${file}`, "utf8"));
    await sql`create table _migrations(name text primary key, applied_at timestamptz not null default now())`;
    const { ensureRoInvoiceSchema } = await import("./roapp-invoice.ts");
    await ensureRoInvoiceSchema(sql);
    await ensureRoInvoiceSchema(sql);
    assert.deepEqual(
      (await sql<{ name: string }>`select name from _migrations`).map((row) => row.name),
      ["0023_roapp_invoices.sql"],
    );
    assert.equal(
      (await sql`select to_regclass('roapp_invoice_payments') as t`)[0].t,
      "roapp_invoice_payments",
    );
  } finally {
    await pg.close();
  }
});
